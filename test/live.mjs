// One real public research run through the production handler. Uses no account secrets.
import assert from 'node:assert/strict';
import app from '../dist/server/index.js';
import {localDB} from '../scripts/local-db.mjs';
const env={DB:localDB()},origin='https://qa.example';
async function go(body){const r=await app.fetch(new Request(origin+'/api',{method:'POST',headers:{origin,'content-type':'application/json','oai-authenticated-user-id':'qa'},body:JSON.stringify(body)}),env);const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;}
const {id:brand}=await go({action:'saveBrand',profile:{name:'Editorial QA',platforms:['LinkedIn']}});
await go({action:'research',brand,query:'marketing',days:30});
const w=await go({action:'workspace',brand});const run=w.research[0];
console.log(JSON.stringify({retrieved:run.retrieved,providers:run.providers,example:run.findings[0]},null,2));
assert.ok(run.findings.length>0,'No genuine source records retrieved');
assert.ok(run.findings.every(x=>x.url.startsWith('http')&&x.retrieved&&x.source));env.DB.close();
