import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import app,{drainAgentQueue,performanceSummary} from '../dist/server/index.js';
import {localDB} from '../scripts/local-db.mjs';

const origin='https://folio.qa';
const profile={name:'Folio QA',industry:'Project management software',products:'Task management software',audience:'Small businesses',platforms:['LinkedIn'],objectives:'Generate qualified leads',restrictions:'guaranteed'};
async function post(env,body,user='tester'){
 const res=await app.fetch(new Request(origin+'/api',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':user},body:JSON.stringify(body)}),env);
 return {status:res.status,...await res.json()};
}
async function setup(db=localDB()){
 const env={DB:db},b=await post(env,{action:'saveBrand',profile});
 const go=(action,other={})=>post(env,{action,brand:b.id,...other});
 return {env,brand:b.id,go};
}
const start=(go,objective,opts={})=>go('runStart',{requestId:crypto.randomUUID(),objective,...opts});
async function progress(env,go,id){
 for(let i=0;i<30;i++){
  const r=await go('runGet',{id});
  if(['completed','partially completed','failed','paused','cancelled'].includes(r.state))return r;
  await drainAgentQueue(env);
 }
 assert.fail('Run failed to reach a terminal checkpoint');
}
function exampleRows(){
 const [header,...lines]=readFileSync('test/data/performance-example.csv','utf8').trim().split('\n').map(s=>s.split(','));
 return lines.map(row=>Object.fromEntries(header.map((k,i)=>[k,row[i]])));
}
test('uploaded test CSV yields all seven independently expected ratios and missing-pair coverage',async()=>{
 const {env,go}=await setup();
 assert.equal((await go('metrics',{rows:exampleRows()})).count,3);
 const {id}=await start(go,'Calculate CTR, ROAS and campaign performance');
 const run=await progress(env,go,id);assert.equal(run.state,'completed');assert.deepEqual(run.tasks.map(t=>t.tool),['analytics']);assert.equal(run.usage.calls,0);
 const ex=await go('runExport',{id});const rates=ex.deliverables[0].overall;
 assert.deepEqual(Object.fromEntries(Object.entries(rates).map(([k,m])=>[k,m.value])),{engagementRate:4.6667,ctr:2.5,conversionRate:5,cpc:0.5,cpl:3.75,cpa:10,roas:4});
 assert.equal(rates.engagementRate.covered,2);
 assert.equal(performanceSummary([{metrics:{clicks:0,conversions:0}}]).overall.conversionRate.value,null);
 env.DB.close();
});
test('run survives a process restart and produces unique calendar slots after pause and replay',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'folio2-')),path=join(dir,'db');
 const {env,brand,go}=await setup(localDB(path));
 try{
 const args={requestId:crypto.randomUUID(),objective:'Prepare a 30-day calendar',frequency:3,start:'2026-12-01'};
 const {id}=await go('runStart',args);assert.equal((await go('runStart',args)).id,id);
 await drainAgentQueue(env);await go('runControl',{id,command:'pause'});await drainAgentQueue(env);
 assert.equal((await go('runGet',{id})).state,'paused');assert.equal((await post(env,{action:'runGet',brand,id},'other')).status,404);
 env.DB.close();env.DB=localDB(path);await go('runControl',{id,command:'resume'});
 const r=await progress(env,go,id);assert.equal(r.state,'completed');assert.equal(r.tasks[0].tool,'calendar');
 await drainAgentQueue(env);const ex=await go('runExport',{id});const slots=ex.deliverables.filter(x=>x.kind==='content');
 assert.equal(slots.length,13);assert.equal(new Set(slots.map(x=>x.schedule)).size,13);
 assert.equal((await go('runControl',{id,command:'resume'})).status,409);
 }finally{env.DB.close();rmSync(dir,{recursive:true,force:true});}
});
test('missing provider, missing measurements, isolation, cancelled work and scoped memory',async()=>{
 const {go,env}=await setup();
 await go('document',{name:'brand.md',text:'Workshops for small businesses use guided project management exercises.'});
 const b=await post(env,{action:'saveBrand',profile:{...profile,name:'Second brand'}});
 await post(env,{action:'document',brand:b.id,name:'private.txt',text:'Private project management exercises from second brand.'});
 const {id}=await start(go,'Compare campaign performance and prepare a calendar');let r=await progress(env,go,id);
 assert.equal(r.state,'partially completed');assert.match(r.limitations.join(' '),/No measured analytics/);assert.ok(r.memory.some(x=>x.label==='brand.md'));assert.ok(!r.memory.some(x=>x.label==='private.txt'));
 assert.equal((await post(env,{action:'runGet',id,brand:b.id})).status,404);
 const blocked=await start(go,'Write a marketing strategy',{provider:'openai'});assert.equal(blocked.status,412);
 const cancel=await start(go,'Prepare a calendar');await go('runControl',{id:cancel.id,command:'cancel'});await drainAgentQueue(env);assert.equal((await go('runGet',{id:cancel.id})).state,'cancelled');
 env.DB.close();
});
test('mocked provider contract: planning, restricted copy rejection, revision, independent review and atomic draft save',async t=>{
 const {go,env}=await setup();env.OPENAI_MODEL='fixture';env.OPENAI_API_KEY='unit-test-only';
 const draft={title:'A simpler handoff',hook:'Where is the next task?',body:'Start with one shared project list.',cta:'Request a walkthrough.',hashtags:'#ProjectManagement',audience:'Small businesses',objective:'Generate qualified leads',visual:'Show an example task board.'};
 const replies=[{tools:['content'],queries:[],assumptions:['Use LinkedIn.'],reason:'The user wants one prepared social post.'},{...draft,body:'Guaranteed results.'},draft,{pass:true,feedback:'The revision removes the unsupported promise.'}];
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(replies.shift())}}],usage:{prompt_tokens:40,completion_tokens:20,total_tokens:60}}));
 const {id}=await start(go,'Write a LinkedIn post for small business project leads',{provider:'openai'});
 const r=await progress(env,go,id);assert.equal(r.state,'completed',JSON.stringify(r.limitations));assert.equal(r.usage.calls,4);assert.equal(r.tasks[0].attempts,2);assert.equal(r.outputs.length,1);assert.equal((await go('runExport',{id})).deliverables[0].status,'Draft');
 const capped=await start(go,'Write a LinkedIn post',{provider:'openai',maxTokens:2000,maxCalls:1});await progress(env,go,capped.id);assert.ok((await go('runGet',{id:capped.id})).usage.calls<=1);
 env.DB.close();
});
test('planner restores business deliverables omitted by the model',async t=>{
 const {go,env}=await setup();env.OPENAI_MODEL='fixture';env.OPENAI_API_KEY='unit-test-only';
 t.mock.method(globalThis,'fetch',async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({tools:['research'],queries:['project management'],assumptions:[],reason:'Gather evidence.'})}}]}));
 const {id}=await start(go,'Research buying objections, develop a strategy and write a LinkedIn post.',{provider:'openai'});
 await drainAgentQueue(env);const r=await go('runGet',{id});
 assert.deepEqual(r.tasks.map(t=>t.tool),['research','audience','strategy','content']);env.DB.close();
});
