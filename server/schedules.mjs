// Periodic internal measurement analysis. Enabled only when the operator provisions a Cron trigger.
async function configureAnalysis(env,user,b,v){
 if(env.ANALYSIS_CRON!=='enabled'||user.startsWith(trialPrefix))stop(412,'This deployment requires a configured Cron trigger for scheduled analysis.');
 const days=integer(v.days,0,30);truth([0,1,7,30].includes(days),'Choose daily, weekly, monthly (30 days) or off.');
 if(!days){await sql(env.DB,"DELETE FROM records WHERE owner=? AND brand=? AND kind='analysisSchedule' AND id='performance-schedule'",user,b.id).run();return {ok:true};}
 const data={days,next:Date.now()+days*86400000};
 await sql(env.DB,"INSERT INTO records(owner,brand,id,kind,data,updated) VALUES(?,?,'performance-schedule','analysisSchedule',?,?) ON CONFLICT(owner,brand,id) DO UPDATE SET data=excluded.data,rev=records.rev+1,updated=excluded.updated",user,b.id,JSON.stringify(data),now()).run();
 return {ok:true};
}
async function runDueAnalyses(env){
 if(env.ANALYSIS_CRON!=='enabled')return;
 const db=env.DB;
 const due=await list(sql(db,"SELECT * FROM records WHERE kind='analysisSchedule' AND json_extract(data,'$.next')<=? ORDER BY updated LIMIT 8",Date.now()));
 for(const row of due){
  const schedule=JSON.parse(row.data),rows=await rowsBy(db,row.owner,row.brand,'metric',1500);
  const date=now(),id='scheduled-report-'+schedule.next,latest=rows.map(r=>r.updated).sort().at(-1);
  const next={...schedule,next:Date.now()+schedule.days*86400000,lastChecked:date,lastMeasured:latest||null};
  const batch=[];
  if(latest&&latest!==schedule.lastMeasured){
   const report={title:'Scheduled performance report · '+date.slice(0,10),...performanceSummary(rows)};
   batch.push(sql(db,"INSERT OR IGNORE INTO records(owner,brand,id,kind,data,updated) SELECT ?,?,?,'measurementReport',?,? WHERE EXISTS(SELECT 1 FROM records WHERE owner=? AND brand=? AND kind='analysisSchedule' AND id=? AND rev=?)",row.owner,row.brand,id,JSON.stringify(report),date,row.owner,row.brand,row.id,row.rev));
  }
  batch.push(sql(db,"UPDATE records SET data=?,updated=?,rev=rev+1 WHERE owner=? AND brand=? AND id=? AND rev=?",JSON.stringify(next),date,row.owner,row.brand,row.id,row.rev));
  await db.batch(batch);
 }
}
