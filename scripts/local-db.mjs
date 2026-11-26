import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function localDB(file=':memory:'){
 const connection=new DatabaseSync(file);connection.exec('PRAGMA foreign_keys=ON;');
 if(!connection.prepare("SELECT 1 FROM sqlite_master WHERE name='brands'").get())connection.exec(readFileSync('drizzle/0000_workspace.sql','utf8'));
 const wrap=(text,args=[])=>({bind:(...a)=>wrap(text,a),run:async()=>({meta:connection.prepare(text).run(...args)}),first:async()=>connection.prepare(text).get(...args),all:async()=>({results:connection.prepare(text).all(...args)})});
 return {prepare:wrap,batch:async(stmts)=>{connection.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());connection.exec('COMMIT');return r;}catch(e){connection.exec('ROLLBACK');throw e;}},close:()=>connection.close()};
}
