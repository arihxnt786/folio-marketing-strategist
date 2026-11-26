class Problem extends Error {
  constructor(status,message) { super(message); this.status=status; }
}
const stop=(status,message)=>{throw new Problem(status,message)};
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
const maxBody=350_000;
const truth=(condition,message)=>{if(!condition) stop(400,message)};
function str(value,max=1500,required=false) {
  if(value===undefined||value===null)value='';
  truth(typeof value==='string'&&value.length<=max,'A text field exceeds its limit or has an invalid type.');
  const s=value.trim(); if(required&&!s)stop(422,'Complete all required fields.'); return s;
}
function choice(value,allowed) {
  truth(allowed.includes(value),'Choose a supported option.');return value;
}
function integer(v,min,max) {
  truth(Number.isInteger(v)&&v>=min&&v<=max,'Number outside the supported range.'); return v;
}
function webUrl(s) {
  if(!s)return '';
  try{const u=new URL(s);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)return u.href;}catch{}
  stop(400,'Enter a full HTTP or HTTPS URL.');
}
async function payload(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json'))stop(415,'Send JSON.');
  const reader=request.body?.getReader(); if(!reader)stop(400,'Request body required.');
  let size=0, parts=[];const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBody){await reader.cancel();stop(413,'File or request is too large.');}parts.push(decoder.decode(value,{stream:true}));}
  try{const v=JSON.parse(parts.join('')+decoder.decode());if(v&&typeof v==='object'&&!Array.isArray(v))return v;}catch{}
  stop(400,'Invalid JSON request.');
}
const platforms=['Instagram','Facebook','LinkedIn','YouTube','X','Email','Web'];
const formats={'Instagram caption':'Instagram','Instagram Reel script':'Instagram','Instagram carousel':'Instagram','Facebook post':'Facebook','LinkedIn post':'LinkedIn','YouTube title and description':'YouTube','YouTube Shorts script':'YouTube','X post':'X','X thread':'X','Promotional announcement':'Web','Product launch campaign':'Web','Educational content':'Web','Brand storytelling':'Web','Email marketing copy':'Email','Advertisement copy':'Web','Landing-page copy':'Web'};
const metricNames=['reach','impressions','engagement','likes','comments','shares','clicks','conversions','audience_growth','saves','leads','revenue','spend'];
const brandFields=['name','website','industry','category','products','usp','audience','geography','competitors','voice','objectives','restrictions','guidelines'];
function profile(input){
 const p={};for(const k of brandFields)p[k]=str(input[k],k==='name'?100:2500,k==='name');
 p.website=webUrl(p.website);truth(Array.isArray(input.platforms)&&input.platforms.length<=7,'Select valid platforms.');
 p.platforms=[...new Set(input.platforms.map(x=>choice(x,platforms)))];return p;
}
function properDate(v){const x=str(v,10,true);truth(/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().startsWith(x),'Enter a valid date.');return x;}
function timestamp(v){if(!v)return '';truth(typeof v==='string'&&v.length<=32&&!isNaN(Date.parse(v))&&/Z$|[+-]\d\d:\d\d$/.test(v),'Include a timezone in scheduled times.');return new Date(v).toISOString();}
function recordRow(r){return {id:r.id,kind:r.kind,rev:r.rev,updated:r.updated,...JSON.parse(r.data)};}
function brandRow(r){return {id:r.id,rev:r.rev,...JSON.parse(r.profile)};}
const sql=(db,s,...args)=>db.prepare(s).bind(...args);
const list=async(q)=>(await q.all()).results;
async function brandBy(db,user,id){
 const r=await sql(db,'SELECT * FROM brands WHERE owner=? AND id=?',user,id).first();if(!r)stop(404,'Brand not found.');return brandRow(r);
}
async function rowsBy(db,user,brand,kind,limit=1000){return (await list(sql(db,'SELECT * FROM records WHERE owner=? AND brand=? AND kind=? ORDER BY updated DESC LIMIT ?',user,brand,kind,limit))).map(recordRow);}
async function recordBy(db,user,brand,id,kind){const r=await sql(db,'SELECT * FROM records WHERE owner=? AND brand=? AND id=?',user,brand,id).first();if(!r||(kind&&r.kind!==kind))stop(404,'Item not found in this brand.');return recordRow(r);}
function insert(db,user,brand,kind,data,id=uid()) {return sql(db,'INSERT INTO records(owner,brand,id,kind,data,updated) VALUES(?,?,?,?,?,?)',user,brand,id,kind,JSON.stringify(data),now());}
function activity(db,user,brand,action){return insert(db,user,brand,'activity',{action});}
async function update(db,user,brand,id,rev,data,action) {
 const result=await sql(db,'UPDATE records SET data=?,rev=rev+1,updated=? WHERE owner=? AND brand=? AND id=? AND rev=?',JSON.stringify(data),now(),user,brand,id,integer(rev,1,1e8)).run();
 if(!result.meta.changes)stop(409,'This version has changed. Refresh before editing again.');
 await activity(db,user,brand,action).run();
}
async function limit(db,user,bucket,max){
 const window=Math.floor(Date.now()/60000);
 const result=await sql(db,'INSERT INTO quotas(owner,bucket,window,calls) VALUES(?,?,?,1) ON CONFLICT(owner,bucket) DO UPDATE SET calls=CASE WHEN window=excluded.window THEN calls+1 ELSE 1 END, window=excluded.window WHERE window<>excluded.window OR calls<?',user,bucket,window,max).run();
 if(!result.meta.changes)stop(429,'Too many requests. Try again in one minute.');
}
