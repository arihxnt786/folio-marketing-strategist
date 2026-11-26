const baseHeaders={'x-content-type-options':'nosniff','referrer-policy':'no-referrer','cache-control':'private, no-store','permissions-policy':'camera=(), microphone=(), geolocation=()'};
export default {async scheduled(event,env,ctx){ctx.waitUntil(drainAgentQueue(env));},async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 if(path==='/health'&&request.method==='GET'){try{await env.DB.prepare('SELECT 1 FROM brands LIMIT 1').first();return Response.json({service:'Folio',database:'ready'},{headers:baseHeaders});}catch{return Response.json({service:'Folio',database:'unavailable'},{status:503,headers:baseHeaders});}}
 if(path==='/internal/advance'){try{return await acceptAgentPulse(request,env,ctx);}catch{return new Response(null,{status:400});}}
 if(path==='/api'){
  try{return Response.json(await api(request,env,ctx),{headers:baseHeaders});}
  catch(e){const status=e instanceof Problem||e instanceof ModelProviderError?e.status:500;return Response.json({error:status===500?'The operation could not be completed. Reload your workspace before retrying.':e.message},{status,headers:{...baseHeaders,...(status===429?{'retry-after':'60'}:{})}});}
 }
 const asset=ASSETS[path];if(!asset||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404});
 const headers={...baseHeaders,'content-type':asset.type,'content-security-policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' https://huggingface.co https://*.huggingface.co https://*.hf.co https://*.xethub.hf.co; img-src 'self' data:; style-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'"};
 let body=asset.body;if(asset.binary){const bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0));body=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));}
 return new Response(request.method==='HEAD'?null:body,{headers});
}};
