// An explicit, bounded browser demo. Its signed cookie can never select an authenticated user's ID.
const trialPrefix='demo/';
const trialDay=86400000;
const trialTTL=7*trialDay;
async function trialKey(env){
 return crypto.subtle.importKey('raw',un64(env.KEY_ENCRYPTION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
async function trialIdentity(request,env){
 const raw=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-folio-test=([^;]+)/)?.[1];
 if(!raw||raw.length>170||!env.KEY_ENCRYPTION_SECRET)return null;
 const [expiry,nonce,tag]=raw.split('.');
 if(!/^\d{13}$/.test(expiry)||Number(expiry)<Date.now()||Number(expiry)>Date.now()+trialTTL+60000||!/^[-a-f\d]{36}$/.test(nonce)||!tag)return null;
 try{
  const data=new TextEncoder().encode('test:'+expiry+'.'+nonce);
  if(await crypto.subtle.verify('HMAC',await trialKey(env),un64(tag),data))return trialPrefix+expiry+'/'+nonce;
 }catch{}
 return null;
}
function trialEnv(env){return {DB:env.DB,KEY_ENCRYPTION_SECRET:env.KEY_ENCRYPTION_SECRET};}
async function createTrial(request,env){
 if(request.method!=='POST'||request.headers.get('origin')!==new URL(request.url).origin)stop(403,'Open the workspace on its own origin.');
 if(!env.KEY_ENCRYPTION_SECRET)stop(503,'Browser test workspaces require a host encryption key.');
 const existing=await trialIdentity(request,env);if(existing)return Response.json({ok:true},{headers:baseHeaders});
 const hmac=await trialKey(env);
 const network=b64(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode('test-network:'+(request.headers.get('cf-connecting-ip')||'shared'))));
 await limit(env.DB,'test-creation','per-minute',60);
 await limit(env.DB,'test-creation',network,6);
 const expiry=String(Date.now()+trialTTL),nonce=uid(),data=new TextEncoder().encode('test:'+expiry+'.'+nonce);
 const signature=b64(await crypto.subtle.sign('HMAC',hmac,data));
 await sweepTrials(env.DB);
 return Response.json({ok:true},{headers:{...baseHeaders,'set-cookie':'__Host-folio-test='+expiry+'.'+nonce+'.'+signature+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800'}});
}
async function sweepTrials(db){
 const cutoff=trialPrefix+String(Date.now())+'/';
 await db.batch(['brands','quotas'].map(table=>sql(db,'DELETE FROM '+table+' WHERE rowid IN (SELECT rowid FROM '+table+' WHERE owner>=? AND owner<? LIMIT 30)',trialPrefix,cutoff)));
}
