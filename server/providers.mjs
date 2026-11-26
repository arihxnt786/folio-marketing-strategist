async function fetchData(url,init={},timeout=12000) {
 for(let attempt=0;attempt<2;attempt++){
  let r;try{r=await fetch(url,{...init,signal:AbortSignal.timeout(timeout)});}catch{if(!attempt)continue;stop(503,'Provider connection timed out.');}
  if(r.ok){try{return await r.json();}catch{stop(502,'Provider returned unreadable data.');}}
  if(!attempt&&[502,503,504].includes(r.status)){await new Promise(ok=>setTimeout(ok,450));continue;}
  if(r.status===429) stop(429,'Provider quota reached. Retry after '+(r.headers.get('retry-after')||'a cooling-off period')+'.');
  stop(502,'Provider returned HTTP '+r.status+'. Check availability, credentials and model access.');
 }
}
const labelDate=parts=>Array.isArray(parts)?parts.map((v,i)=>i?String(v).padStart(2,'0'):String(v)).join('-'):'';
function publicLink(value){try{return webUrl(value)}catch{return ''}}
async function research(query,days) {
 const until=now().slice(0,10), since=new Date(Date.now()-days*86400000).toISOString().slice(0,10);
 const sources={
  'Hacker News':async()=>{
   const p=new URLSearchParams({query,tags:'story',hitsPerPage:'8',restrictSearchableAttributes:'title',typoTolerance:'false',numericFilters:'created_at_i>='+Math.floor(Date.parse(since)/1000)});
   const j=await fetchData('https://hn.algolia.com/api/v1/search_by_date?'+p);return j.hits.map(x=>({title:x.title,url:'https://news.ycombinator.com/item?id='+encodeURIComponent(x.objectID),original:publicLink(x.url),date:x.created_at?.slice(0,10),dateType:'Discussion posted',source:'Hacker News'}));
  },
  'Crossref':async()=>{
   const p=new URLSearchParams({'query.bibliographic':query,filter:'from-pub-date:'+since+',until-pub-date:'+until,rows:'6',select:'title,URL,published,publisher'});
   const j=await fetchData('https://api.crossref.org/works?'+p);return j.message.items.map(x=>({title:x.title?.[0],url:publicLink(x.URL),date:labelDate(x.published?.['date-parts']?.[0]),dateType:'Publication',source:x.publisher||'Crossref'}));
  },
  'GDELT News':async()=>{
   const p=new URLSearchParams({query,mode:'artlist',format:'json',maxrecords:'8',sort:'datedesc',timespan:Math.min(days,90)+'d'});
   const j=await fetchData('https://api.gdeltproject.org/api/v2/doc/doc?'+p,{},6500);
   return (j.articles||[]).map(x=>({title:x.title,url:publicLink(x.url),seen:x.seendate?.replace(/^(\d{4})(\d{2})(\d{2}).*$/,'$1-$2-$3'),date:'',dateType:'Publication',source:x.domain}));
  }
 };
 const retrieved=now(),findings=[],providers=[];
 await Promise.all(Object.entries(sources).map(async([name,run])=>{
  try{const items=(await run()).filter(x=>x.title&&x.url);providers.push({name,state:'Available',count:items.length});for(const x of items)findings.push({...x,provider:name,retrieved,id:uid()});}
  catch(e){providers.push({name,state:'Unavailable',error:e.message});}
 }));
 findings.sort((a,b)=>(b.date||b.seen||'').localeCompare(a.date||a.seen||''));
 return {query,days,retrieved,providers,findings:findings.slice(0,22)};
}
async function cryptKey(env){
 if(!env.KEY_ENCRYPTION_SECRET)stop(503,'The host must configure KEY_ENCRYPTION_SECRET before connecting a personal Gemini key.');
 const raw=Uint8Array.from(atob(env.KEY_ENCRYPTION_SECRET),x=>x.charCodeAt(0));return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
const un64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function seal(env,user,value){
 const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(user)},await cryptKey(env),new TextEncoder().encode(value));return b64(iv)+'.'+b64(ct);
}
async function geminiAccount(env,user){
 const pref=await sql(env.DB,'SELECT sealed_key,model FROM preferences WHERE owner=?',user).first();
 if(pref?.sealed_key){const [iv,c]=pref.sealed_key.split('.');const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:new TextEncoder().encode(user)},await cryptKey(env),un64(c));return {key:new TextDecoder().decode(raw),model:pref.model};}
 if(!env.GEMINI_API_KEY)stop(412,'Connect Gemini in Settings, or select On-device AI.');
 return {key:env.GEMINI_API_KEY,model:env.GEMINI_MODEL||''};
}
async function models(key){
 const j=await fetchData('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{headers:{'x-goog-api-key':key}});
 return (j.models||[]).filter(x=>x.supportedGenerationMethods?.includes('generateContent')&&x.name.startsWith('models/gemini-')&&!/image|audio|robot|embedding|tts|live|computer-use/i.test(x.name)).map(x=>x.name.slice(7));
}
async function gemini(env,user,plan){
 const account=await geminiAccount(env,user);const available=account.model?[]:await models(account.key);
 const model=account.model||available.find(x=>x.includes('flash-lite'))||available.find(x=>x.includes('flash'));
 if(!model)stop(422,'Select a text model available to your Google project in Settings.');
 const props=Object.fromEntries(plan.keys.map(k=>[k,{type:'STRING'}]));
 const j=await fetchData('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':account.key},body:JSON.stringify({systemInstruction:{parts:[{text:plan.system}]},contents:[{role:'user',parts:[{text:plan.prompt}]}],generationConfig:{temperature:0.65,responseMimeType:'application/json',responseSchema:{type:'OBJECT',properties:props,required:plan.keys}}})},55000);
 try{return {result:JSON.parse(j.candidates[0].content.parts.filter(x=>!x.thought).map(x=>x.text).join('')),model};}catch{stop(502,'Gemini returned no usable draft. Revise the brief and retry.');}
}
