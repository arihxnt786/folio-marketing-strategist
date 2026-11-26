import {localDB} from '../scripts/local-db.mjs';
import app,{drainAgentQueue} from '../dist/server/index.js';
import {readFileSync} from 'node:fs';
const scenarios=[
 ['fitness','Affordable home fitness','Working professionals aged 22–35 in India','Develop a 30-day organic marketing strategy for an Indian home fitness startup. Research the industry and competitors, analyze audience needs, write a LinkedIn post and prepare a calendar.'],
 ['saas','Project management SaaS','Small business project leads','Research the buying objections for a small-business project management SaaS, develop a lead-generation strategy and write a LinkedIn post.'],
 ['fashion','Sustainable fashion','Consumers seeking substantiated environmental claims','Research sustainable fashion and competitor positioning, develop a product-launch strategy and write an Instagram caption. Do not describe garments as carbon neutral without substantiation.'],
 ['performance','Workshop promotions','First-time commuters','Compare measured campaign performance, calculate CTR and ROAS and revise the marketing strategy.'],
 ['organize','Small business software','Operations leads','Help our team organize next month.'],
 ['rates','Small business software','Operations leads','Calculate CTR and ROAS from uploaded data.']
];
const name=process.argv[2],provider=process.env.FOLIO_LIVE_MODEL_PROVIDER||'evidence';
const summarize=process.env.FOLIO_EVAL_FULL!=='1';
async function scenario([key,industry,audience,objective]){
 const env={...process.env,DB:localDB()};
 const go=async(action,body)=>{const r=await app.fetch(new Request('https://folio.test/api',{method:'POST',headers:{origin:'https://folio.test','content-type':'application/json','oai-authenticated-user-id':'evaluation'},body:JSON.stringify({action,...body})}),env);
 const result=await r.json();if(!r.ok)throw Error(r.status+' '+result.error);return result;};
 try{
 const {id:brand}=await go('saveBrand',{profile:{name:'Labelled test brand · '+key,industry,audience,objectives:objective,platforms:[key==='fashion'?'Instagram':'LinkedIn'],products:industry,restrictions:'carbon neutral,guaranteed results'}});
 if(['performance','rates'].includes(key)){
  const [keys,...data]=readFileSync('test/data/performance-example.csv','utf8').trim().split('\n').map(x=>x.split(','));
  await go('metrics',{brand,rows:data.map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]])))});
 }
 const {id}=await go('runStart',{brand,requestId:crypto.randomUUID(),objective,provider,depth:'quick',maxCalls:20,maxTokens:180000});
 for(let i=0;i<60;i++){
  const r=await go('runGet',{id,brand});
  if(['completed','partially completed','failed','paused','cancelled'].includes(r.state)){
   const ex=await go('runExport',{brand,id});
   return summarize?{key,objective,provider,model:r.model,status:r.state,usage:r.usage,plan:r.tasks.map(t=>({tool:t.tool,status:t.status,attempts:t.attempts,note:t.note})),limitations:r.limitations,deliverables:ex.deliverables.map(d=>({kind:d.kind,title:d.title||d.query||d.name,sources:d.findings?.length})),firstSource:ex.deliverables.find(d=>d.findings)?.findings[0]?.url}:ex;
  }
  await drainAgentQueue(env);
 }
 throw Error('Execution exceeded test deadline.');
 }finally{env.DB.close();}
}
for(const row of scenarios.filter(x=>!name||x[0]===name))console.log(JSON.stringify(await scenario(row)));
