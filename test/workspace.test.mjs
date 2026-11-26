import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import app from '../dist/server/index.js';
import {localDB} from '../scripts/local-db.mjs';
const origin='https://qa.example';
async function request(env,user,body,originHeader=origin){
 const r=await app.fetch(new Request(origin+'/api',{method:body?'POST':'GET',headers:{...(user?{'oai-authenticated-user-id':user}:{}),origin:originHeader,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 return {status:r.status,data:await r.json()};
}
const profile={name:'Folio field test',industry:'Bicycle maintenance',audience:'First-time commuters',objectives:'Encourage workshop enquiries',products:'Saturday repair workshops',restrictions:'guaranteed',platforms:['LinkedIn']};
test('durable brand lifecycle, scoped reads and editing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'folio-')),file=join(dir,'qa.sqlite');let env={DB:localDB(file)};
 try{
 assert.equal((await request(env,null)).status,401);
 const p={action:'saveBrand',profile};
 assert.equal((await request(env,'a',p,'https://elsewhere.example')).status,403);
 const {id}= (await request(env,'a',p)).data;
 assert.ok(id);assert.equal((await request(env,'b')).data.brands.length,0);
 assert.equal((await request(env,'b',{action:'workspace',brand:id})).status,404);
 assert.equal((await request(env,'a',{...p,brand:id,rev:1,profile:{...profile,voice:'Welcoming'}})).status,200);
 assert.equal((await request(env,'a',{...p,brand:id,rev:1})).status,409);
 env.DB.close();env.DB=localDB(file);const get=async()=>(await request(env,'a',{action:'workspace',brand:id})).data;
 assert.equal((await get()).brand.voice,'Welcoming');
 const ref=(await request(env,'a',{action:'document',brand:id,name:'guidelines.md',text:'Use clear everyday language.'})).data;
 assert.ok(ref.id);assert.equal((await request(env,'a',{action:'document',brand:id,name:'unsafe.exe',text:'No'})).status,400);
 const other=(await request(env,'a',{action:'saveBrand',profile:{...profile,name:'Other brand'}})).data.id;
 assert.equal((await request(env,'a',{action:'workspace',brand:other})).data.document.length,0);
 assert.equal((await request(env,'a',{action:'removeDocument',id:ref.id,brand:other})).status,404);
 assert.equal((await request(env,'a',{action:'deleteBrand',brand:id,confirm:profile.name})).status,200);
 assert.equal((await request(env,'a',{action:'workspace',brand:id})).status,404);assert.equal((await request(env,'a')).data.brands.length,1);
 }finally{env.DB.close();rmSync(dir,{recursive:true,force:true});}
});
test('campaign, calendar, revision control, preview approval and manual receipt',async()=>{
 const env={DB:localDB()};const id=(await request(env,'a',{action:'saveBrand',profile})).data.id;
 const go=async(action,v={})=>request(env,'a',{action,brand:id,...v});
 const c=(await go('campaign',{name:'Commuter workshop',objective:profile.objectives,start:'2026-11-26',end:'2026-11-30',status:'Active'})).data;
 const args={campaign:c.id,frequency:1,formats:['LinkedIn post'],slots:[{day:'2026-11-27',time:'2026-11-27T10:00:00+05:30'}]};
 assert.equal((await go('calendar',args)).data.count,1);assert.equal((await go('calendar',args)).data.count,0);
 let x=(await go('workspace')).data.content[0];assert.equal(x.schedule,'2026-11-27T04:30:00.000Z');
 const save=(item,approve=false)=>go('saveContent',{id:x.id,rev:x.rev,item,approve});
 assert.equal((await save({...x,body:'Guaranteed results'})).status,422);
 assert.equal((await save({...x,body:'Join our Saturday workshop.',status:'Review'})).status,200);
 assert.equal((await save({...x,body:'Old revision'})).status,409);
 x=(await go('workspace')).data.content[0];assert.equal((await go('receipt',{id:x.id,rev:x.rev,url:'https://example.org/workshop'})).status,400);
 assert.equal((await save({...x,status:'Approved'},true)).status,200);
 x=(await go('workspace')).data.content[0];assert.equal(x.status,'Approved');
 assert.equal((await go('receipt',{id:x.id,rev:x.rev,url:'https://example.org/workshop'})).status,200);
 const receipt=(await go('workspace')).data.content[0];assert.equal(receipt.confirmation,'Manually recorded');
 assert.equal((await go('receipt',{id:x.id,rev:x.rev,url:'https://example.org/workshop'})).status,400);
 env.DB.close();
});
test('agent context, required fields, provider unavailability, measurements and import idempotency',async()=>{
 const env={DB:localDB()};const id=(await request(env,'a',{action:'saveBrand',profile})).data.id;
 const go=(action,v={})=>request(env,'a',{action,brand:id,...v});
 const brief={type:'repurpose',format:'LinkedIn post',platform:'LinkedIn',brief:'Invite beginners.',provider:'device',original:'Saturday bicycle repair workshops welcome first-time commuters.'};
 assert.equal((await go('start',{...brief,original:''})).status,422);
 assert.equal((await go('start',{...brief,provider:'gemini'})).status,412);
 const job=(await go('start',brief)).data;
 assert.equal(JSON.parse(job.plan.prompt).original,brief.original);assert.ok(job.plan.system.includes('Preserve'));
 assert.equal((await go('finish',{id:job.id,result:{}})).status,422);
 assert.equal((await go('linkedinBegin')).status,404);
 const measurement={date:'2026-11-26',label:'QA browser: Retrieve sources button',platform:'Web',campaign:'Acceptance testing',clicks:'1'};
 assert.equal((await go('metrics',{rows:[measurement]})).status,200);
 assert.equal((await go('metrics',{rows:[measurement]})).status,200);
 const w=(await go('workspace')).data;assert.equal(w.metric.length,1);assert.deepEqual(w.metric[0].metrics,{clicks:1});
 assert.equal((await go('metrics',{rows:[measurement,{...measurement,label:'Invalid',reach:'-1'}]})).status,400);
 assert.equal((await go('workspace')).data.metric.length,1);env.DB.close();
});
test('CSV roundtrip preserves multiline text, missing measures and neutralizes formula cells',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const box={};runInNewContext(await readFile('vendor/papaparse.min.js','utf8'),box);
 const csv=box.Papa.unparse([['title','body','reach'],['=pending','line one,\nline two','']],{escapeFormulae:true});const rows=box.Papa.parse(csv,{header:true}).data;
 assert.equal(rows[0].title,"'=pending");assert.equal(rows[0].body,'line one,\nline two');assert.equal(rows[0].reach,'');
});
