async function api(request,env,ctx) {
 const authenticated=request.headers.get('oai-authenticated-user-id');
 const visitor=authenticated?null:await trialIdentity(request,env);
 const user=authenticated||visitor;
 if(visitor)env=trialEnv(env);
 if(!user)stop(401,'Sign in with ChatGPT to open your private workspace.');
 const db=env.DB;if(!db)stop(503,'The workspace database is unavailable.');
 if(request.method==='GET'){
  const brands=(await list(sql(db,'SELECT * FROM brands WHERE owner=? ORDER BY created',user))).map(brandRow);
  const pref=await sql(db,'SELECT model,sealed_key IS NOT NULL AS connected FROM preferences WHERE owner=?',user).first();
  return {trial:!!visitor,accounts:await agentAccounts(env,user),brands,formats,platforms,metricNames,connected:!!(pref?.connected||env.GEMINI_API_KEY),model:pref?.model||env.GEMINI_MODEL||'',personal:!!pref?.connected};
 }
 if(request.method!=='POST')stop(405,'Unsupported request method.');
 if(request.headers.get('origin')!==new URL(request.url).origin)stop(403,'Open the workspace on its own origin.');
 const v=await payload(request);const action=str(v.action,40,true);
 if(visitor){
  if(['modelAccount','connect'].includes(action))stop(403,'Sign in to connect a model to a permanent brand workspace.');
  await limit(db,user,'test-requests',100);
  if(action==='saveBrand'&&!v.brand){const count=await sql(db,'SELECT COUNT(*) AS n FROM brands WHERE owner=?',user).first();if(count.n>=2)stop(429,'A browser test workspace supports two brands.');}
  if(['runStart','research','metrics','document','calendar','start'].includes(action)){
   const use=await sql(db,'SELECT COUNT(*) AS n, COALESCE(SUM(length(data)),0) AS bytes FROM records WHERE owner=?',user).first();
   if(use.n>=400||use.bytes>=750000)stop(429,'This test workspace has reached its storage allowance. Sign in for permanent work.');
   if(action==='runStart')await limit(db,user,'test-runs',3);
   if(action==='metrics')truth(Array.isArray(v.rows)&&v.rows.length<=100,'A test workspace supports 100 measurements per import.');
  }
 }
 if(action==='modelAccount')return agentAccountAction(env,user,v);
 if(action==='saveBrand'){
  const p=profile(v.profile);const id=v.brand||uid();
  if(v.brand){const r=await sql(db,'UPDATE brands SET profile=?,rev=rev+1 WHERE owner=? AND id=? AND rev=?',JSON.stringify(p),user,id,integer(v.rev,1,1e8)).run();if(!r.meta.changes)stop(409,'Brand changed or is no longer accessible. Refresh it.');}
  else await sql(db,'INSERT INTO brands(owner,id,profile,created) VALUES(?,?,?,?)',user,id,JSON.stringify(p),now()).run();
  await activity(db,user,id,v.brand?'Updated brand profile':'Created brand workspace').run();return {id};
 }
 if(action==='connect'){
  await limit(db,user,'connect',4);const key=str(v.key,300,true),available=await models(key);
  const model=choice(str(v.model,120)||available.find(x=>x.includes('flash-lite'))||available.find(x=>x.includes('flash'))||'',available);
  await sql(db,'INSERT INTO preferences(owner,sealed_key,model) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET sealed_key=excluded.sealed_key,model=excluded.model',user,await seal(env,user,key),model).run();return {model};
 }
 if(action==='disconnect'){await sql(db,'DELETE FROM preferences WHERE owner=?',user).run();return {ok:true};}
 const b=await brandBy(db,user,str(v.brand,64,true)),bid=b.id;
 if(action==='workspace'){
  const kinds=['content','campaign','research','insight','document','activity','metric','measurementReport'];
  const vals=await Promise.all(kinds.map(k=>rowsBy(db,user,bid,k,k==='activity'?30:k==='research'?20:1500)));
  const recentRuns=await list(sql(db,"SELECT id,updated,json_extract(data,'$.objective') AS objective,json_extract(data,'$.state') AS state FROM records WHERE owner=? AND brand=? AND kind='run' ORDER BY updated DESC LIMIT 80",user,bid));
  return {run:recentRuns,brand:b,...Object.fromEntries(kinds.map((k,i)=>[k,vals[i]]))};
 }
 if(action==='deleteBrand'){truth(v.confirm===b.name,'Type the brand name to confirm deletion.');await sql(db,'DELETE FROM brands WHERE owner=? AND id=? AND rev=?',user,bid,b.rev).run();return {ok:true};}
 const add=async(kind,data,message)=>{const id=uid();await db.batch([insert(db,user,bid,kind,data,id),activity(db,user,bid,message)]);return {id};};
 if(action.startsWith('run'))return runAction(env,ctx,user,b,{...v,origin:new URL(request.url).origin});
 if(action==='document'){
  const name=str(v.name,140,true),text=str(v.text,30000,true);
  truth(/\.(txt|md|csv|pdf|docx)$/i.test(name)&&!(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)),'Upload a supported reference containing readable text.');
  return add('document',{name,text},'Added '+name);
 }
 if(action==='removeDocument'){await recordBy(db,user,bid,v.id,'document');await sql(db,'DELETE FROM records WHERE owner=? AND brand=? AND id=? AND kind=?',user,bid,v.id,'document').run();return {ok:true};}
 if(action==='research'){
  await limit(db,user,'research',5);const result=await research(str(v.query,160,true),integer(v.days,1,365));return add('research',result,'Researched '+result.query);
 }
 if(action==='start'){
  await limit(db,user,'ai',12);
  const provider=choice(v.provider,['device','gemini']);
  const plan=await makePlan(env,user,b,v);
  if(provider==='gemini')await geminiAccount(env,user);
  const jobId=uid();await insert(db,user,bid,'job',{plan,provider},jobId).run();
  if(provider==='device')return {id:jobId,plan:{keys:plan.keys,system:plan.system,prompt:plan.prompt}};
  try{const {result,model}=await gemini(env,user,plan);return await finishJob(db,user,await brandBy(db,user,bid),{id:jobId,plan},result,model);}
  catch(e){await activity(db,user,bid,'Generation failed: '+(e instanceof Problem?e.message:'Provider unavailable.')).run();throw e;}
 }
 if(action==='finish'){const job=await recordBy(db,user,bid,v.id,'job');truth(job.provider==='device','Invalid generation provider.');return finishJob(db,user,b,job,v.result,'Qwen2.5-0.5B-Instruct · device');}
 if(action==='saveInsight'){
  const old=await recordBy(db,user,bid,v.id,'insight');const result={};for(const k of guides[old.type].keys)result[k]=str(v.result[k],10000,true);
  await update(db,user,bid,old.id,v.rev,{approval:'Review',type:old.type,title:result.title,result,sources:old.sources,brief:old.brief,model:old.model},'Edited '+result.title);return {id:old.id};
 }
 if(action==='reviewInsight'){const old=await recordBy(db,user,bid,v.id,'insight');const {id,rev,kind,updated,...data}=old;await update(db,user,bid,id,v.rev,{...data,approval:choice(v.decision,['Approved','Rejected'])},'Reviewed '+old.title);return {id};}
 if(action==='campaign'){
  const data={name:str(v.name,140,true),objective:str(v.objective,2000,true),start:properDate(v.start),end:properDate(v.end),status:choice(v.status,['Planning','Active','Complete'])};
  truth(data.start<=data.end,'End date must follow the start date.');
  if(v.id){await recordBy(db,user,bid,v.id,'campaign');await update(db,user,bid,v.id,v.rev,data,'Edited campaign '+data.name);return {id:v.id};}
  return add('campaign',data,'Created campaign '+data.name);
 }
 if(action==='calendar'){
  const c=await recordBy(db,user,bid,v.campaign,'campaign'),freq=integer(v.frequency,1,7);
  truth(Array.isArray(v.slots)&&v.slots.length>=1&&v.slots.length<=90,'Choose 1–90 calendar slots.');
  truth(Array.isArray(v.formats)&&v.formats.length>0&&v.formats.length<=16,'Choose content formats.');
  const selected=[...new Set(v.formats.map(f=>choice(f,Object.keys(formats))))];
  const used=(await rowsBy(db,user,bid,'content',1500)).filter(x=>x.campaign===c.id);
  const topics=[...(await rowsBy(db,user,bid,'insight',20)).filter(x=>x.type==='strategy').slice(0,1).flatMap(x=>x.result.pillars.split(/\n/)),...b.products.split(/[\n;]/),b.usp,c.objective].filter(Boolean);
  const stmts=[],seen=new Set();
  for(let i=0;i<v.slots.length;i++){
   const slot=v.slots[i],schedule=timestamp(slot.time),day=properDate(slot.day);truth(day>=c.start&&day<=c.end&&schedule,'Slot falls outside the campaign.');
   const format=selected[i%selected.length],platform=formats[format],key=platform+'|'+schedule;
   if(seen.has(key)||used.some(x=>x.platform===platform&&x.schedule===schedule))continue;seen.add(key);
   const title=(topics[i%topics.length]+' · '+format).slice(0,350);
   const data={title,format,platform,campaign:c.id,schedule,status:'Draft',audience:b.audience,objective:c.objective,body:'',cta:'',hook:'',hashtags:'',visual:'',brief:'Develop '+format+' about '+topics[i%topics.length]+' for '+b.audience+'. Objective: '+c.objective,planningFrequency:freq,sources:[]};
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(c.id+'|'+key));const id='slot-'+Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
   stmts.push(sql(db,'INSERT OR IGNORE INTO records(owner,brand,id,kind,data,updated) VALUES(?,?,?,?,?,?)',user,bid,id,'content',JSON.stringify(data),now()));
  }
  if(!stmts.length)return {count:0};
  const result=await db.batch([...stmts,activity(db,user,bid,'Planned calendar slots for '+c.name)]);return {count:result.slice(0,-1).reduce((n,x)=>n+x.meta.changes,0)};
 }
 if(action==='saveContent'){
  const data=cleanItem(v.item,b);
  if(data.campaign)await recordBy(db,user,bid,data.campaign,'campaign');
  if(v.id){const old=await recordBy(db,user,bid,v.id,'content');if(['Published','Awaiting confirmation'].includes(old.status))stop(409,'Duplicate this published record to draft an update.');
   const copyChanged=contentKeys.some(k=>old[k]!==data[k])||old.platform!==data.platform||old.format!==data.format;
   if(data.status==='Approved'&&(!v.approve||copyChanged))stop(422,'Save the current copy, then review and explicitly approve it in Publishing.');
   await update(db,user,bid,old.id,v.rev,{...data,model:old.model||'',sources:old.sources||[],brief:old.brief||''},'Updated '+data.title);return {id:old.id};}
  truth(data.status!=='Approved','Create a draft, then approve it in Publishing.');return add('content',data,'Created '+data.title);
 }
 if(action==='receipt'){
  const old=await recordBy(db,user,bid,v.id,'content');truth(['Approved','Awaiting confirmation'].includes(old.status),'Approve the current version first.');
  const url=webUrl(str(v.url,2000,true));truth(url.startsWith('https://'),'Supply an HTTPS publication link.');
  const {id,rev,updated,kind,...content}=old;
  await update(db,user,bid,id,v.rev,{...content,status:'Published',confirmation:'Manually recorded',permalink:url,recorded:now()},'Recorded manual publication of '+old.title);return {id};
 }
 if(action==='metrics'){
  truth(Array.isArray(v.rows)&&v.rows.length&&v.rows.length<=250,'Import 1–250 rows at a time.');
  const stmts=[],seen=new Set();for(const row of v.rows){
   const d={date:properDate(row.date),label:str(row.label,200,true),platform:choice(row.platform,platforms),campaign:str(row.campaign,140),metrics:{}};
   if(row.engagement===undefined&&row.engagements!==undefined)row.engagement=row.engagements;
   for(const k of metricNames){if(row[k]===''||row[k]===null||row[k]===undefined)continue;const s=String(row[k]);if(['revenue','spend'].includes(k)){truth(/^\d{1,10}(?:\.\d{1,4})?$/.test(s),'Enter a nonnegative monetary amount in the same currency for all rows.');d.metrics[k]=Number(s);continue;}truth(/^-?\d+$/.test(s),'Metrics must be whole numbers.');d.metrics[k]=integer(Number(s),k==='audience_growth'?-1e10:0,1e10);}
   truth(Object.keys(d.metrics).length,'Each row requires a measured metric.');
   const key=JSON.stringify([d.date,d.platform,d.campaign,d.label]);truth(!seen.has(key),'Duplicate measurement key in this file.');seen.add(key);
   const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key));const id='m-'+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
   stmts.push(sql(db,'INSERT INTO records(owner,brand,id,kind,data,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(owner,brand,id) DO UPDATE SET data=excluded.data,rev=rev+1,updated=excluded.updated',user,bid,id,'metric',JSON.stringify(d),now()));
  }
  await db.batch([...stmts,activity(db,user,bid,'Imported '+stmts.length+' measured rows')]);return {count:stmts.length};
 }
 stop(404,'Unknown operation.');
}
