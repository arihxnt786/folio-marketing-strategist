import test from 'node:test';
import assert from 'node:assert/strict';
import {askModel, listModels, validateModelValue, ModelProviderError} from '../server/models.mjs';

const decision = {
  type:'object', additionalProperties:false, required:['action','ids','confidence'],
  properties:{
    action:{type:'string',enum:['research','draft','review']},
    ids:{type:'array',minItems:1,maxItems:2,items:{type:'string',minLength:2,maxLength:24}},
    confidence:{type:['number','null'],minimum:0,maximum:1}
  }
};
const good = {action:'research',ids:['S1'],confidence:null};
const errorCode = code => error => error instanceof ModelProviderError && error.code === code;

test('workflow schema accepts a bounded named action and nullable confidence',()=>{
  assert.deepEqual(validateModelValue(good,decision),good);
  assert.equal(validateModelValue({...good,confidence:0},decision).confidence,0);
});

test('workflow rejects unknown actions, extra and missing fields, bad types and out-of-bound values',()=>{
  for (const invalid of [
    {...good,action:'publish'}, {...good,run:true}, {action:'research',ids:['S1']},
    {...good,ids:[]}, {...good,ids:['S1','S2','S3']}, {...good,ids:[5]},
    {...good,ids:['S']}, {...good,ids:['S'.repeat(25)]}, {...good,confidence:1.01},
    {...good,confidence:'1'}, JSON.parse('{"action":"research","ids":["S1"],"confidence":0,"__proto__":{}}')
  ]) assert.throws(()=>validateModelValue(invalid,decision),errorCode('schema_mismatch'));
});

test('unsupported schema keywords fail closed',()=>{
  assert.throws(()=>validateModelValue(good,{...decision,not:{}}),errorCode('invalid_schema'));
});

test('provider configuration fails before network access for missing credentials or unknown providers',async()=>{
  await assert.rejects(()=>listModels({config:{provider:'constructor'}}),errorCode('unsupported_provider'));
  await assert.rejects(()=>askModel({system:'Plan',input:'Seasonal launch'}),errorCode('missing_key'));
  await assert.rejects(()=>askModel({config:{provider:'groq',key:'local-test-only'},system:'Plan',input:'New collection'}),errorCode('missing_model'));
});

test('control characters, invalid paths, empty briefs and invalid token budgets are rejected',async()=>{
  const args={config:{provider:'gemini',key:'local-input-check',model:'gemini-example'},system:'Select next step',input:'Increase repeat orders'};
  await assert.rejects(()=>askModel({...args,config:{...args.config,key:'value\nheader'}}),errorCode('invalid_key'));
  await assert.rejects(()=>askModel({...args,config:{...args.config,model:'../unexpected'}}),errorCode('invalid_model'));
  await assert.rejects(()=>askModel({...args,input:' '}),errorCode('missing_input'));
  await assert.rejects(()=>askModel({...args,input:'x'.repeat(96001)}),errorCode('context_limit'));
  await assert.rejects(()=>askModel({...args,maxTokens:99999}),errorCode('invalid_budget'));
});

test('JSON root must be an object',()=>{
  for(const value of [null,42,[],true]) assert.throws(()=>validateModelValue(value),errorCode('invalid_output'));
});

const liveProvider = process.env.FOLIO_LIVE_MODEL_PROVIDER;
test('live discovery and genuine structured decision with provider-supplied usage', {skip:!liveProvider}, async()=>{
  const config={provider:liveProvider};
  const models=await listModels({env:process.env,config});
  assert.ok(models.length,'Provider must return at least one text model.');
  const target=process.env[liveProvider.toUpperCase()+'_MODEL'];
  if(target) assert.ok(models.includes(target),'Configured model must appear in its catalog.');
  const result=await askModel({
    env:process.env,config,schema:decision,maxTokens:1000,
    system:'Select a next marketing action. Use research if information is needed and draft if ready. Cite only supplied IDs.',
    input:{objective:'Help a neighborhood bookstore introduce a reading club',evidence:[{id:'S1',text:'The club schedule has not been confirmed.'}]}
  });
  assert.equal(validateModelValue(result.value,decision),result.value);
  assert.ok(result.value.ids.every(id=>id==='S1'));
  assert.equal(result.provider,liveProvider);
  assert.ok(result.usage.totalTokens === null || result.usage.totalTokens > 0);
});
test('provider request uses Worker-compatible manual redirects and rejects redirections',async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async(_,options)=>{
  calls++;assert.equal(options.redirect,'manual');
  return new Response(null,{status:307,headers:{location:'https://different.example/'}});
 });
 await assert.rejects(askModel({config:{provider:'openai',key:'fixture',model:'gpt-test'},system:'Return JSON.',input:'Check.'}),errorCode('provider_error'));
 assert.equal(calls,1);
});
