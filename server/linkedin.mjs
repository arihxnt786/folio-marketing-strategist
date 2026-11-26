function linkedinReady(env){return !!(env.LINKEDIN_CLIENT_ID&&env.LINKEDIN_CLIENT_SECRET&&env.KEY_ENCRYPTION_SECRET);}
async function linkedinBegin(env,user,bid,origin){
 if(!linkedinReady(env))stop(412,'The host must configure the LinkedIn developer application.');
 await limit(env.DB,user,'oauth',4);const state=uid()+uid();
 await insert(env.DB,user,bid,'oauth',{expires:Date.now()+600000},state).run();
 return {url:'https://www.linkedin.com/oauth/v2/authorization?'+new URLSearchParams({response_type:'code',client_id:env.LINKEDIN_CLIENT_ID,redirect_uri:origin+'/oauth/linkedin',state,scope:'openid profile w_member_social'})};
}
async function linkedinCallback(req,env){
 const u=new URL(req.url),user=req.headers.get('oai-authenticated-user-id');
 if(!user)stop(401,'Sign in to the workspace to connect LinkedIn.');
 const state=str(u.searchParams.get('state'),100,true);
 const pending=await sql(env.DB,"DELETE FROM records WHERE owner=? AND id=? AND kind='oauth' RETURNING brand,data",user,state).first();
 if(!pending||JSON.parse(pending.data).expires<Date.now())stop(403,'Connection request expired. Restart in Publishing.');
 if(u.searchParams.has('error'))stop(400,'LinkedIn authorization was declined. Return to Publishing.');
 const code=str(u.searchParams.get('code'),4000,true),bid=pending.brand;
 const r=await fetch('https://www.linkedin.com/oauth/v2/accessToken',{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',code,client_id:env.LINKEDIN_CLIENT_ID,client_secret:env.LINKEDIN_CLIENT_SECRET,redirect_uri:u.origin+'/oauth/linkedin'}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)stop(502,'LinkedIn token exchange failed (HTTP '+r.status+').');
 const token=await r.json(),person=await fetchData('https://api.linkedin.com/v2/userinfo',{headers:{authorization:'Bearer '+token.access_token}});
 const data={name:str(person.name,180,true),sub:str(person.sub,200,true),sealed:await seal(env,user+':'+bid,token.access_token),expires:Date.now()+integer(token.expires_in,1,31536000)*1000};
 await sql(env.DB,"INSERT INTO records(owner,brand,id,kind,data,updated) VALUES(?,?,'linkedin','connection',?,?) ON CONFLICT(owner,brand,id) DO UPDATE SET data=excluded.data,rev=rev+1,updated=excluded.updated",user,bid,JSON.stringify(data),now()).run();
 return new Response(null,{status:303,headers:{...baseHeaders,location:'/#Publishing'}});
}
async function linkedinPublish(env,user,b,v){
 if(!linkedinReady(env))stop(412,'LinkedIn developer app is not configured.');
 const db=env.DB,x=await recordBy(db,user,b.id,v.id,'content'),conn=await recordBy(db,user,b.id,'linkedin','connection');
 truth(v.confirm===true&&v.recipient===conn.sub&&v.rev===x.rev&&x.status==='Approved'&&x.platform==='LinkedIn','Review the current approved copy and connected account first.');
 if(conn.expires<=Date.now())stop(412,'Reconnect LinkedIn to renew the access token.');
 const copy=[x.hook,x.body,x.cta,x.hashtags].filter(Boolean).join('\n\n');truth(copy.length&&copy.length<=3000,'LinkedIn text must fit 3,000 characters.');checkCopy(b,[copy]);
 const {id,rev,kind,updated,...data}=x,[iv,c]=conn.sealed.split('.');
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:new TextEncoder().encode(user+':'+b.id)},await cryptKey(env),un64(c));
 const sent={...data,status:'Awaiting confirmation',attempted:now(),destination:conn.name};
 await update(db,user,b.id,id,rev,sent,'Requested LinkedIn publication of '+x.title);
 let response;try{response=await fetch('https://api.linkedin.com/v2/ugcPosts',{method:'POST',headers:{authorization:'Bearer '+new TextDecoder().decode(raw),'content-type':'application/json','X-Restli-Protocol-Version':'2.0.0'},body:JSON.stringify({author:'urn:li:person:'+conn.sub,lifecycleState:'PUBLISHED',specificContent:{'com.linkedin.ugc.ShareContent':{shareCommentary:{text:copy},shareMediaCategory:'NONE'}},visibility:{'com.linkedin.ugc.MemberNetworkVisibility':'PUBLIC'}}),signal:AbortSignal.timeout(20000)});}catch{}
 const remote=response?.headers.get('x-restli-id');
 if(response?.status===201&&remote){
  await update(db,user,b.id,id,rev+1,{...sent,status:'Published',confirmation:'LinkedIn API confirmed',externalId:remote,permalink:'https://www.linkedin.com/feed/update/'+encodeURIComponent(remote)+'/',recorded:now()},'LinkedIn confirmed publication of '+x.title);return {id,remote};
 }
 const reason=response?'LinkedIn returned HTTP '+response.status+(response.status===201?' without a post ID.':'.'):'LinkedIn timed out before confirmation.';
 const rejected=response&&[400,401,403,422,429].includes(response.status);
 await update(db,user,b.id,id,rev+1,{...sent,status:rejected?'Review':'Awaiting confirmation',publishError:reason},reason+' '+x.title);
 stop(response?.status===429?429:502,reason+(rejected?' Review/reapprove before another attempt.':' Check the account for a post before recording the outcome.'));
}
