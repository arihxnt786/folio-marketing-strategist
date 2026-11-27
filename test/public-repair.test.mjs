import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../dist/server/index.js';
import {localDB} from '../scripts/local-db.mjs';

test('public repair-guide campaign with live sources and measured discussion comments', {timeout:120000}, async t => {
 const origin='https://qa.example', DB=localDB();
 t.after(()=>DB.close());
 async function send(action,data={},user='reviewer'){
  const response=await app.fetch(new Request(origin+'/api',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':user},body:JSON.stringify({action,...data})}),{DB});
  return {status:response.status,body:await response.json()};
 }
 async function ok(action,data){const r=await send(action,data);assert.equal(r.status,200,JSON.stringify(r.body));return r.body;}
 const profile={name:'iFixit public-material QA',website:'https://www.ifixit.com/Guide',products:'Step-by-step repair guides',audience:'First-time repairers',objectives:'Invite readers to find a repair guide',platforms:['Instagram','LinkedIn'],competitors:'Repair Café International — repaircafe.org'};
 const {id:brand}=await ok('saveBrand',{profile});
 await ok('document',{brand,name:'public-source.md',text:'iFixit lists guides for phones, laptops and game consoles. Source: https://www.ifixit.com/Guide'});
 const {id:campaign}=await ok('campaign',{brand,name:'Find a repair guide',objective:profile.objectives,start:'2026-11-26',end:'2026-12-03',status:'Planning'});
 const slot={day:'2026-12-01',time:'2026-12-01T10:00:00+05:30'};
 const plan={brand,campaign,frequency:1,formats:['Instagram caption'],slots:[slot]};
 assert.equal((await ok('calendar',plan)).count,1);
 assert.equal((await ok('calendar',plan)).count,0);
 await ok('research',{brand,query:'repair',days:90});
 const workspace=()=>ok('workspace',{brand});let w=await workspace();
 const run=w.research[0];t.diagnostic(JSON.stringify(run.providers));
 assert.ok(run.findings.length>0);assert.ok(run.findings.every(f=>f.url&&f.retrieved&&f.source));
 for(const type of ['strategy','audience','competitor','interpretation','content','repurpose']){
  const job=await ok('start',{brand,campaign,type,provider:'device',brief:'Help first-time repairers find an appropriate guide.',original:'iFixit offers step-by-step repair guides for phones and laptops.',platform:'Instagram',format:'Instagram caption'});
  assert.equal(JSON.parse(job.plan.prompt).brand.name,profile.name);assert.ok(job.plan.keys.length);
 }
 assert.equal((await send('workspace',{brand},'different-reviewer')).status,404);
 const listing=await fetch('https://hn.algolia.com/api/v1/search?tags=story&query=iFixit&hitsPerPage=5',{signal:AbortSignal.timeout(15000)});
 assert.ok(listing.ok);const hit=(await listing.json()).hits.find(h=>Number.isInteger(h.num_comments));assert.ok(hit);
 const row={date:new Date().toISOString().slice(0,10),label:hit.title,platform:'Web',campaign:'Public discussion observation',comments:hit.num_comments};
 t.diagnostic(JSON.stringify({url:'https://news.ycombinator.com/item?id='+hit.objectID,measuredComments:hit.num_comments,observed:row.date}));
 await ok('metrics',{brand,rows:[row]});await ok('metrics',{brand,rows:[row]});
 w=await workspace();assert.equal(w.metric.length,1);assert.deepEqual(w.metric[0].metrics,{comments:hit.num_comments});
 const report=await ok('start',{brand,type:'report',provider:'device',brief:'Summarize available measurements and identify missing metrics.'});
 assert.equal(JSON.parse(report.plan.prompt).measuredRows[0].metrics.comments,hit.num_comments);
});