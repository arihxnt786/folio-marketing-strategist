// Server-only provider adapter. Endpoints cannot be configured by a visitor.
const modelGateways = Object.freeze({
  local: null,
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1'
});

export class ModelProviderError extends Error {
  constructor(status, code, message, retryAfter = null) {
    super(message);
    this.name = 'ModelProviderError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

function modelFailure(status, code, message, retryAfter) {
  throw new ModelProviderError(status, code, message, retryAfter);
}

function modelSettings(env, config) {
  const provider = config.provider || env.AI_PROVIDER || 'gemini';
  if (!Object.hasOwn(modelGateways, provider)) {
    modelFailure(422, 'unsupported_provider', 'Select a supported model provider.');
  }
  const prefix = provider.toUpperCase();
  const key = config.key || env[prefix + '_API_KEY'] || '';
  const model = config.model || env[prefix + '_MODEL'] || '';
  if (typeof key !== 'string' || key.length > 2048 || /[^!-~]/.test(key)) {
    modelFailure(422, 'invalid_key', 'The configured credential is invalid.');
  }
  if (model && (typeof model !== 'string' || !/^[a-z0-9][a-z0-9._:/-]{0,159}$/i.test(model) || model.includes('..'))) {
    modelFailure(422, 'invalid_model', 'Choose a model ID from the provider catalog.');
  }
  let base=modelGateways[provider];
  if(provider==='local'){
    let url;
    try{url=new URL(env.LOCAL_AI_BASE_URL);}catch{modelFailure(412,'missing_endpoint','The operator must configure a trusted local inference endpoint.');}
    const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
    if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||url.protocol==='http:'&&loopback))modelFailure(422,'invalid_endpoint','Local inference requires trusted HTTPS or a loopback server.');
    base=url.href.replace(/\/$/,'');
  }
  return {provider,key,model,base};
}

function modelAuth(settings) {
  if (!settings.key) return {};
  if (settings.provider === 'gemini') return {'x-goog-api-key':settings.key};
  return {Authorization:'Bearer ' + settings.key};
}

function modelRetrySeconds(header) {
  if (!header) return null;
  const seconds = /^\d+$/.test(header) ? Number(header) : (Date.parse(header) - Date.now()) / 1000;
  return Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : null;
}

async function modelReadBody(response, maximum) {
  const reader = response.body?.getReader();
  if (!reader) modelFailure(502, 'empty_response', 'The model service returned an empty response.');
  const parts = [], decoder = new TextDecoder();
  let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximum) {
        await reader.cancel();
        modelFailure(502, 'response_too_large', 'The provider returned more data than this workflow accepts.');
      }
      parts.push(decoder.decode(value, {stream:true}));
    }
    return JSON.parse(parts.join('') + decoder.decode());
  } catch (error) {
    if (error instanceof ModelProviderError) throw error;
    modelFailure(502, 'unreadable_response', 'The provider returned incomplete or unreadable data.');
  } finally {
    reader.releaseLock();
  }
}

// Model providers specify data-only SSE. Ignore comments and event metadata.
async function* modelEvents(response) {
  if (!response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
    await response.body?.cancel();
    modelFailure(502,'invalid_stream','The provider did not return an event stream.');
  }
  const reader = response.body?.getReader();
  if (!reader) modelFailure(502,'empty_stream','The provider returned an empty stream.');
  const decoder = new TextDecoder();
  let pending = '', data = [], rawBytes = 0, ended = false;
  try {
    while (!ended) {
      const {value, done} = await reader.read();
      ended = done;
      rawBytes += value?.byteLength || 0;
      if (rawBytes > 3_000_000) modelFailure(502,'stream_too_large','The model stream exceeded the workspace limit.');
      pending += done ? decoder.decode() + '\n\n' : decoder.decode(value,{stream:true});
      // A CR at the last position can be the start of CRLF in the next chunk.
      let match;
      while ((match = /[\r\n]/.exec(pending))) {
        const i = match.index, cr = pending[i] === '\r';
        if (cr && i === pending.length - 1 && !done) break;
        const line = pending.slice(0,i);
        pending = pending.slice(i + (cr && pending[i+1] === '\n' ? 2 : 1));
        if (!line) {
          if (data.length) { const event = data.join('\n'); data = []; yield event; }
        } else if (line === 'data' || line.startsWith('data:')) {
          data.push(line.slice(5).replace(/^ /,''));
        }
      }
    }
  } finally {
    if (!ended) await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}

async function modelStreamData(response, provider, onChunk) {
  const gemini = provider === 'gemini', encoder = new TextEncoder();
  let text = '', size = 0, reason, usage, complete = false;
  try {
    for await (const event of modelEvents(response)) {
      if (event === '[DONE]') { complete = true; break; }
      let frame;
      try { frame = JSON.parse(event); } catch { modelFailure(502,'invalid_stream','The provider sent an unreadable stream event.'); }
      if (!frame || frame.error) modelFailure(502,'stream_interrupted','The provider interrupted this generation.');
      const candidate = gemini ? frame.candidates?.[0] : frame.choices?.[0];
      const delta = gemini ? candidate?.content?.parts?.filter(part=>!part.thought).map(part=>part.text || '').join('') : candidate?.delta?.content;
      const finish = gemini ? candidate?.finishReason : candidate?.finish_reason;
      if (finish) reason = finish;
      usage = (gemini ? frame.usageMetadata : frame.usage || frame.x_groq?.usage) ?? usage;
      if (delta) {
        if (typeof delta !== 'string') modelFailure(502,'invalid_stream','The provider returned a non-text response.');
        size += encoder.encode(delta).length;
        if (size > 250_000) modelFailure(502,'response_too_large','The provider exceeded the output size limit.');
        text += delta;
        await onChunk(delta);
      }
    }
  } catch (error) {
    if (error instanceof ModelProviderError) throw error;
    modelFailure(502,'stream_interrupted','The generation stream ended unexpectedly. No result was accepted.');
  }
  if (!gemini && !complete) modelFailure(502,'stream_interrupted','The provider closed the connection before completing its stream.');
  // Normalize assembled streams to the same final validation path as ordinary responses.
  return gemini
    ? {candidates:[{finishReason:reason,content:{parts:[{text}]}}],usageMetadata:usage}
    : {choices:[{finish_reason:reason,message:{content:text}}],usage};
}

async function modelRequest(url, init, {catalog = false, attemptsLimit = 2, streamReader} = {}) {
  const timeout = catalog ? 10000 : 45000;
  for (let attempts = 1; attempts <= attemptsLimit; attempts++) {
    let response;
    try {
      response = await fetch(url, {...init, redirect:'error', signal:AbortSignal.timeout(timeout)});
    } catch {
      // A POST may already have run; automatically repeating it could incur a second charge.
      if (catalog && attempts < attemptsLimit) continue;
      modelFailure(503, 'provider_unreachable', 'The provider connection failed or timed out. Try again later.');
    }
    if (response.ok) {
      const data = streamReader ? await streamReader(response) : await modelReadBody(response, catalog ? 5_000_000 : 250_000);
      return {data,attempts};
    }
    const http = response.status;
    const retryAfter = modelRetrySeconds(response.headers.get('retry-after'));
    if (http === 400 && new URL(url).hostname === 'generativelanguage.googleapis.com') {
      // Google sometimes returns 400 for credential errors. Read only known reason codes;
      // the free-form provider message may echo input and is never logged or returned.
      let details;
      try { details = (await modelReadBody(response, 16000))?.error?.details; } catch {}
      if (Array.isArray(details) && details.some(item => ['API_KEY_INVALID','API_KEY_EXPIRED','API_KEY_SERVICE_BLOCKED'].includes(item?.reason))) {
        modelFailure(403, 'provider_denied', 'Google rejected this API credential. Check its validity and API restrictions.');
      }
    } else {
      await response.body?.cancel();
    }
    const retriable = catalog ? [429,502,503,504] : [429,503];
    if (retriable.includes(http) && attempts < attemptsLimit && (retryAfter === null || retryAfter <= 2)) {
      await new Promise(resolve => setTimeout(resolve, retryAfter === null ? 450 : retryAfter * 1000));
      continue;
    }
    if (http === 429) modelFailure(429, 'provider_rate_limit', 'Provider quota reached. Check the project limits and retry later.', retryAfter);
    if ([401,403].includes(http)) modelFailure(403, 'provider_denied', 'The provider denied access. Check the API credential, model access and region.');
    if (http === 402) modelFailure(402, 'provider_credit_limit', 'The provider requires additional credit for this request.');
    if ([400,404,422].includes(http)) modelFailure(422, 'provider_rejected', 'The provider rejected the model or request format. Select a compatible text model and check the input length.');
    if (http === 503) modelFailure(503,'provider_overloaded','The model service is temporarily unavailable.',retryAfter);
    modelFailure(502, 'provider_error', 'The provider returned HTTP ' + http + '. Try again later.', retryAfter);
  }
}

function modelRequireKey(settings) {
  if (!settings.key && settings.provider!=='local') modelFailure(412, 'missing_key', 'Configure a server-side API credential for ' + settings.provider + ' first.');
}

function modelTextId(provider, id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9._:/-]{0,159}$/i.test(id) || id.includes('..')) return false;
  if (/embedding|moderation|whisper|transcrib|speech|(?:^|[-/])tts(?:[-/]|$)|audio|realtime|image-generation|computer-use|(?:^|[-/])image(?:[-/]|$)|sora|dall-e/i.test(id)) return false;
  if (provider === 'gemini') return id.startsWith('gemini-') && !/robot|native-audio|live|deep-research/i.test(id);
  if (provider === 'openai') return /^(?:gpt-|chatgpt-|o[1-9](?:$|-))/.test(id);
  return true;
}

export async function listModels({env = {}, config = {}} = {}) {
  const settings = modelSettings(env, config);
  if (settings.provider !== 'openrouter') modelRequireKey(settings);
  const found = new Set();
  let page = '';
  const more = new Set();
  do {
    const url = new URL(settings.base + '/models');
    if (settings.provider === 'gemini') url.searchParams.set('pageSize','1000');
    if (page) url.searchParams.set('pageToken', page);
    const {data} = await modelRequest(url, {headers:modelAuth(settings)}, {catalog:true});
    const rows = settings.provider === 'gemini' ? data?.models : data?.data;
    if (!Array.isArray(rows)) modelFailure(502, 'invalid_catalog', 'The provider returned an unreadable model catalog.');
    for (const row of rows) {
      if (!row || row.active === false) continue;
      if (settings.provider === 'gemini' && !row.supportedGenerationMethods?.includes('generateContent')) continue;
      if (settings.provider === 'openrouter' && row.architecture?.output_modalities && !row.architecture.output_modalities.includes('text')) continue;
      const id = settings.provider === 'gemini' ? row.name?.replace(/^models\//,'') : row.id;
      if (modelTextId(settings.provider, id)) found.add(id);
    }
    page = settings.provider === 'gemini' ? data.nextPageToken : '';
    if (page && (typeof page !== 'string' || page.length > 2048 || more.has(page) || more.size >= 5)) {
      modelFailure(502, 'invalid_catalog', 'The provider returned an incomplete model catalog.');
    }
    if (page) more.add(page);
  } while (page);
  return [...found].sort();
}

// This deliberately small JSON Schema vocabulary is shared with the workflow planner.
const modelSchemaKeywords = new Set(['type','description','title','enum','const','properties','additionalProperties','items','required','minItems','maxItems','minLength','maxLength','minimum','maximum','anyOf']);
const modelJsonKinds = ['object','array','string','integer','number','boolean','null'];

function modelInspectSchema(schema, depth = 0) {
  const invalid = () => modelFailure(500, 'invalid_schema', 'The workflow uses an unsupported model response schema.');
  if (!schema || typeof schema !== 'object' || Array.isArray(schema) || depth > 14) invalid();
  for (const key of Object.keys(schema)) if (!modelSchemaKeywords.has(key)) invalid();
  const types = [].concat(schema.type ?? []);
  if (types.some(type => !modelJsonKinds.includes(type))) invalid();
  if (!types.length && !schema.anyOf && !schema.enum && !Object.hasOwn(schema,'const')) invalid();
  if (schema.additionalProperties !== undefined && typeof schema.additionalProperties !== 'boolean') invalid();
  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.length || schema.enum.some(x => x !== null && typeof x === 'object'))) invalid();
  if (Object.hasOwn(schema,'const') && schema.const !== null && typeof schema.const === 'object') invalid();
  if (schema.required && (!Array.isArray(schema.required) || !schema.required.every(k=>typeof k === 'string'))) invalid();
  if (schema.properties) {
    if (typeof schema.properties !== 'object' || Array.isArray(schema.properties)) invalid();
    for (const child of Object.values(schema.properties)) modelInspectSchema(child, depth + 1);
  }
  if (schema.items) modelInspectSchema(schema.items, depth + 1);
  if (schema.anyOf) {
    if (!Array.isArray(schema.anyOf) || !schema.anyOf.length) invalid();
    for (const child of schema.anyOf) modelInspectSchema(child, depth + 1);
  }
  for (const key of ['minItems','maxItems','minLength','maxLength']) {
    if (schema[key] !== undefined && (!Number.isSafeInteger(schema[key]) || schema[key] < 0)) invalid();
  }
  for (const key of ['minimum','maximum']) if (schema[key] !== undefined && !Number.isFinite(schema[key])) invalid();
}

function modelValueMatches(value, schema) {
  if (schema.anyOf && !schema.anyOf.some(s => modelValueMatches(value, s))) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (Object.hasOwn(schema,'const') && schema.const !== value) return false;
  const kind = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const types = [].concat(schema.type ?? []);
  if (types.length && !types.includes(kind) && !(types.includes('integer') && Number.isSafeInteger(value))) return false;
  if (kind === 'object') {
    if ((schema.required || []).some(key => !Object.hasOwn(value,key))) return false;
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(schema.properties || {},key)) {
        if (!modelValueMatches(child, schema.properties[key])) return false;
      } else if (schema.additionalProperties === false) return false;
    }
  }
  if (kind === 'array') return value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) && (!schema.items || value.every(item=>modelValueMatches(item,schema.items)));
  if (kind === 'string') {
    const length = [...value].length;
    return length >= (schema.minLength ?? 0) && length <= (schema.maxLength ?? Infinity);
  }
  if (kind === 'number') return Number.isFinite(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity);
  return true;
}

export function validateModelValue(value, schema) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) modelFailure(502, 'invalid_output', 'The model returned an invalid result. Review the brief and try again.');
  if (schema) {
    modelInspectSchema(schema);
    if (!modelValueMatches(value, schema)) modelFailure(502, 'schema_mismatch', 'The model returned fields outside the expected format. No action was taken.');
  }
  return value;
}

function modelBody(settings, system, input, maxTokens, schema) {
  if (settings.provider === 'gemini') return {
    systemInstruction:{parts:[{text:system}]},
    contents:[{role:'user',parts:[{text:input}]}],
    generationConfig:{maxOutputTokens:maxTokens,responseMimeType:'application/json',...(schema ? {responseJsonSchema:schema} : {})}
  };
  // JSON object mode also works on models without native strict-schema support.
  const instructions = system + '\nReturn one JSON object.' + (schema ? '\nRequired JSON schema: ' + JSON.stringify(schema) : '');
  return {
    model:settings.model,
    messages:[{role:'system',content:instructions},{role:'user',content:input}],
    response_format:settings.provider==='local'&&schema?{type:'json_schema',json_schema:{name:'folio_result',strict:true,schema}}:{type:'json_object'},
    ...(settings.provider==='local'?{max_tokens:maxTokens}:settings.provider === 'openrouter' ? {max_tokens:maxTokens,provider:{require_parameters:true}} : {max_completion_tokens:maxTokens})
  };
}

function modelMeasuredUsage(data, provider) {
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const gemini = provider === 'gemini', usage = (gemini ? data.usageMetadata : data.usage) || {};
  return {
    inputTokens:count(gemini ? usage.promptTokenCount : usage.prompt_tokens),
    outputTokens:count(gemini ? usage.candidatesTokenCount : usage.completion_tokens),
    totalTokens:count(gemini ? usage.totalTokenCount : usage.total_tokens),
    costUsd:provider === 'openrouter' && typeof usage.cost === 'number' && Number.isFinite(usage.cost) && usage.cost >= 0 ? usage.cost : null
  };
}

export async function askModel({env = {}, config = {}, system, input, maxTokens = 1200, schema, onChunk, maxAttempts = 2}) {
  if (![1,2].includes(maxAttempts)) modelFailure(422,'invalid_attempts','Allow one or two provider attempts.');
  if (onChunk !== undefined && typeof onChunk !== 'function') modelFailure(422,'invalid_stream_callback','The stream recipient is invalid.');
  const settings = modelSettings(env, config);
  modelRequireKey(settings);
  if (typeof system !== 'string' || !system.trim()) modelFailure(422,'invalid_input','Provide a workflow instruction.');
  let inputText;
  try { inputText = typeof input === 'string' ? input : JSON.stringify(input); } catch { modelFailure(422,'invalid_input','The workflow input could not be serialized.'); }
  if (!inputText || !inputText.trim()) modelFailure(422,'missing_input','Provide a brief or source material.');
  if (schema) modelInspectSchema(schema);
  const instructionBytes = new TextEncoder().encode(system + inputText + (schema ? JSON.stringify(schema) : '')).length;
  if (instructionBytes > 96000) modelFailure(413,'context_limit','The model context is too long. Narrow the research window or shorten source material.');
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 16 || maxTokens > 8192) modelFailure(422,'invalid_budget','Choose an output limit between 16 and 8192 tokens.');
  if (!settings.model) {
    if (settings.provider !== 'gemini') modelFailure(412,'missing_model','Select a text model in Settings before running this workflow.');
    const ids = await listModels({env,config});
    settings.model = ids.find(id=>id.includes('flash-lite') && !id.includes('preview')) || ids.find(id=>id.includes('flash-lite')) || ids.find(id=>id.includes('flash'));
    if (!settings.model) modelFailure(412,'missing_model','Select a text model available to this project.');
  }
  const gemini = settings.provider === 'gemini';
  const action = onChunk ? ':streamGenerateContent?alt=sse' : ':generateContent';
  const url = settings.base + (gemini ? '/models/' + encodeURIComponent(settings.model) + action : '/chat/completions');
  const body = modelBody(settings,system,inputText,maxTokens,schema);
  if (onChunk && !gemini) {
    body.stream = true;
    body.stream_options = {include_usage:true};
  }
  const {data,attempts} = await modelRequest(url, {
    method:'POST',
    headers:{...modelAuth(settings),'content-type':'application/json'},
    body:JSON.stringify(body)
  },{attemptsLimit:maxAttempts,streamReader:onChunk ? response=>modelStreamData(response,settings.provider,onChunk) : undefined});
  const candidate = gemini ? data?.candidates?.[0] : data?.choices?.[0];
  const reason = gemini ? candidate?.finishReason : candidate?.finish_reason;
  if (!candidate || !['STOP','stop'].includes(reason)) modelFailure(502,'incomplete_result','The model declined or stopped before completing its result. Revise the brief or adjust the token limit.');
  const output = gemini ? candidate.content?.parts?.filter(p=>!p.thought)?.map(p=>p.text || '').join('') : candidate.message?.content;
  let value;
  try { value = JSON.parse(output); } catch { modelFailure(502,'invalid_json','The model returned unreadable JSON. Try a compatible text model or refine the brief.'); }
  return {value:validateModelValue(value,schema), provider:settings.provider, model:settings.model, usage:modelMeasuredUsage(data,settings.provider), attempts};
}

// Only an explicitly supplied alternate can receive the same context. A single
// reserved inference disables both retries and fallback.
export async function askModelWithFallback(options) {
  const alternate = options.fallbackConfig || options.config?.fallback;
  if (!alternate || options.maxAttempts === 1) return askModel(options);
  if (!alternate.provider || !Object.hasOwn(modelGateways,alternate.provider)) modelFailure(422,'invalid_fallback','Choose a fallback provider explicitly.');
  if (options.maxAttempts !== undefined && options.maxAttempts !== 2) modelFailure(422,'invalid_attempts','Allow one or two provider attempts.');
  try {
    return await askModel({...options,maxAttempts:1});
  } catch (error) {
    if (!(error instanceof ModelProviderError) || !['provider_rate_limit','provider_overloaded'].includes(error.code)) throw error;
    // Carry only alternate settings. A primary credential must never reach another provider.
    const result = await askModel({...options,config:alternate,maxAttempts:1});
    return {...result,attempts:2,fallbackFrom:options.config?.provider || options.env?.AI_PROVIDER || 'gemini',fallbackReason:error.code};
  }
}
