import {Wllama} from '/wllama.js';
const modelUrl='https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/41ba88dbac95fed2528c92514c131d73eb5a174b/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf';
let runtime, loading;
async function engine(progress,signal){
 if(runtime?.isModelLoaded())return runtime;
 if(!loading)loading=(async()=>{
  runtime=new Wllama({'single-thread/wllama.wasm':location.origin+'/wllama.wasm'},{suppressNativeLog:true});
  const bytes=397808192, options={n_ctx:6144,n_threads:1,n_batch:128,signal,progressCallback:({loaded,total})=>progress('Loading on-device AI · '+Math.round(loaded/1e6)+' / '+Math.round((total||bytes)/1e6)+' MB')};
  const storage=await navigator.storage?.estimate?.().catch(()=>null);
  let cached=false;
  if(storage&&storage.quota-storage.usage>bytes*1.15){
   try{await runtime.loadModelFromUrl(modelUrl,options);cached=true;}
   catch(e){if(signal.aborted||!/space|quota|storage|file system/i.test(String(e?.message||e)))throw e;}
  }
  if(!cached){
   progress('Loading the model in memory for this session…');
   const response=await fetch(modelUrl,{signal});if(!response.ok)throw Error('Model download returned HTTP '+response.status);
   const reader=response.body.getReader(), chunks=[];let loaded=0;
   while(true){const part=await reader.read();if(part.done)break;chunks.push(part.value);loaded+=part.value.byteLength;options.progressCallback({loaded,total:bytes});}
   if(loaded!==bytes)throw Error('Model download was incomplete. Retry with a stable connection.');
   const blob=new Blob(chunks);chunks.length=0;await runtime.loadModel([blob],options);
  }
  return runtime;
 })().catch(e=>{loading=null;runtime=null;throw new Error('Device model could not load. Check available storage and your connection, or connect Gemini in Settings. '+e.message);});
 return loading;
}
export async function generate(plan,progress,signal){
 const m=await engine(progress,signal),context=JSON.parse(plan.prompt),result={};
 for(const [index,key] of plan.keys.entries()){
  signal.throwIfAborted();
  progress('Writing '+key+' · field '+(index+1)+' of '+plan.keys.length);
  const prompt=await m.formatChat([{role:'system',content:plan.system.split('Return a JSON object')[0]+' Return only the requested field as plain text.'},{role:'user',content:JSON.stringify({context,previous:result,field:key})}],true);
  const tokens=await m.tokenize(prompt,true);
  if(tokens.length>5600)throw Error('This brief exceeds the device model context. Shorten it or use a hosted model.');
  result[key]=(await m.createCompletion(prompt,{nPredict:Math.min(340,6000-tokens.length),sampling:{temp:.55,top_p:.9,penalty_repeat:1.1},abortSignal:signal})).trim();
 }
 return result;
}
