// Independent Workers deployments must verify identity before forwarding to Folio.
import {createRemoteJWKSet,jwtVerify} from 'jose';
import app from '../dist/server/index.js';
let keySet,issuerInCache;
export default {async fetch(req,env,ctx){
 const issuer=env.ACCESS_TEAM_URL,audience=env.ACCESS_AUD;
 if(!issuer||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)||!audience)
  return new Response('Configure Cloudflare Access for this deployment.',{status:503});
 let subject;
 try{
  if(!keySet||issuerInCache!==issuer){keySet=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));issuerInCache=issuer;}
  const token=req.headers.get('Cf-Access-Jwt-Assertion');
  const {payload}=await jwtVerify(token,keySet,{algorithms:['RS256'],issuer,audience,requiredClaims:['sub','exp','iat']});
  subject=payload.sub;if(typeof subject!=='string'||!subject)throw Error();
 }catch{return new Response('Sign in through the configured Cloudflare Access application.',{status:401,headers:{'cache-control':'no-store'}});}
 const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id',subject);
 return app.fetch(new Request(req,{headers}),env,ctx);
}};
