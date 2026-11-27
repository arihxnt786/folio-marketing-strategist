// Part of the workspace module, bundled by scripts/build.mjs.
const toolLabels={research:'Market research',analytics:'Measured performance',audience:'Audience intelligence',competitor:'Competitive intelligence',strategy:'Marketing strategy',content:'Content drafts',calendar:'Content calendar'};
const activeStates=['pending','executing','researching','evaluating','planning'];
const scenarios={
 'Indian fitness startup':'Develop a 30-day organic marketing strategy for an affordable Indian home fitness service for working professionals aged 22–35. Research competitors and audience needs, develop a strategy, write Instagram and LinkedIn content, and prepare a calendar.',
 'B2B SaaS':'Develop a lead-generation strategy for a project management SaaS for small businesses. Research buying objections, segment customers, recommend a conversion funnel and write LinkedIn content.',
 'Sustainable fashion':'Research the sustainable fashion market and develop a launch strategy for environmentally conscious customers. Compare publicly documented competitor positioning and flag environmental claims that need substantiation.',
 'Performance review':'Calculate engagement rate, CTR, conversion rate, CPC, CPL, CPA and ROAS from uploaded campaign measurements. Compare campaigns and show missing denominators.',
 'Public research':'Research recent published work on sustainable fashion consumer purchase intentions. Keep publication dates and source excerpts.'
};
let centralRequestId=null, centralSignature='', activeRun=null, runLoading=false;
function agentSettings(){
 if(state.boot.trial)return card('Permanent model connections','<p>Sign in to save provider keys and permanent brands. Your temporary workspace supports public research and uploaded measurements.</p>');
 const research=card('General web search','<p>'+E(state.boot.searchConfigured?'Tavily is configured.':'Public indexes are available. Connect Tavily to add general web results and competitor website excerpts.')+'</p>'+form('researchAccount',field('key','Tavily API key','','password',{required:true,extra:'autocomplete="off"',hint:'Verification uses one basic search against the provider quota.'}),'Verify and save search key')+(state.boot.personalSearch?button('dropSearch','Disconnect search key','quiet'):''));
 return research+card('Agent model connections',(state.boot.accounts||[]).map(a=>'<div class="item row"><div><strong>'+E(a.provider)+'</strong> · '+E(a.model)+'</div>'+(!a.hosted&&!a.legacy?button('dropProvider','Disconnect','quiet',a.provider):'')+'</div>').join('')+
 '<p>Choose a provider you have access to. Load its current models, then save your choice. The selected provider receives the objective and relevant brand evidence. Its quota and pricing apply.</p>'+
 form('agentAccount','<div class="formgrid">'+field('provider','Provider','gemini','select',{values:['gemini','openai','groq','openrouter']})+field('key','Provider API key','','password',{required:true,extra:'autocomplete="off"'})+'<label class="field wide">Model<select name="model" required><option value="">Load models with your key first</option></select></label></div>'+button('loadModels','Load available models'),'Save model connection')+
 '<p class="hint">Public research and measured calculations work without a model. Strategy, content and independent review require a connected cloud model.</p>');
}
function centralView(){
 const connections=state.boot.accounts||[];
 const controls='<label class="field">Example objective<select id="agent-example"><option value="">Choose an example</option>'+Object.keys(scenarios).map(x=>'<option>'+E(x)+'</option>').join('')+'</select></label>'+
 field('objective','Business objective','','area',{required:true,wide:true,max:3000,hint:'Describe the outcome, audience and any constraints.'})+
 '<div class="formgrid"><label class="field">Intelligence engine<select name="provider">'+connections.map(x=>'<option value="'+E(x.provider)+'">'+E(x.provider+' · '+x.model)+'</option>').join('')+'<option value="evidence">Research and calculations only</option></select></label>'+field('depth','Research depth','standard','select',{values:['quick','standard','deep']})+'</div>'+
 (!connections.length?'<p class="hint">To generate strategy and copy, connect a model in '+nav('Settings','Settings')+'.</p>':'')+
 '<details><summary>Deliverables, scheduling and budgets</summary><label class="field">Optional fallback provider<select name="fallback"><option value="">None</option>'+connections.map(a=>'<option value="'+E(a.provider)+'">'+E(a.provider+' · '+a.model)+'</option>').join('')+'</select><small>Allow this provider to receive the same context if the selected provider is overloaded or rate-limited.</small></label><p class="hint">Leave tools unchecked for automatic selection. Formats specify the channels to prepare. Dates are UTC.</p><div class="checks">'+Object.entries(toolLabels).map(([k,l])=>'<label><input type="checkbox" name="tools" value="'+k+'">'+l+'</label>').join('')+'</div><h3>Content formats</h3><div class="checks">'+Object.keys(state.boot.formats).map(k=>'<label><input type="checkbox" name="formats" value="'+E(k)+'">'+E(k)+'</label>').join('')+'</div><div class="formgrid">'+field('start','Campaign start (UTC)',new Date().toISOString().slice(0,10),'date')+field('days','Duration in days','','number',{extra:'min="1" max="90"',hint:'Defaults to the objective’s day count, or 30.'})+field('frequency','Draft slots per week','','number',{extra:'min="1" max="7"'})+field('maxCalls','Maximum model calls','16','number',{extra:'min="1" max="40"'})+field('maxTokens','Maximum token allowance','100000','number',{extra:'min="2000" max="500000"'})+'</div></details>'+
 '<label class="field">Optional knowledge document<input type="file" name="knowledge" accept=".txt,.md,.csv,.pdf,.docx"></label>';
 return head()+card('Start an objective',form('centralRun',controls,'Start run'))+
 card('Execution monitor','<div id="run-monitor" aria-live="polite">'+empty('Open a run from history to see its tasks and results.')+'</div>')+
 card('Execution history','<label class="field">Search objectives<input type="search" id="run-search"></label><div id="run-history"></div>')+
 '<details class="card"><summary>Using Folio</summary><p>Save your business, audience, restrictions and preferred channels in Brand Workspace. Select the brand at the top. Add measured campaign CSVs under Analytics and Reports. Start an objective here, follow each recorded task, and review its sources, limitations and drafts. Approve copy in Publishing and record the URL after you publish it yourself.</p></details>';
}
function drawHistory(){
 const target=$('#run-history');if(!target)return;
 const query=($('#run-search')?.value||'').toLowerCase();
 const runs=rows('run').filter(r=>r.objective.toLowerCase().includes(query));
 target.innerHTML=runs.length?runs.map(r=>'<div class="item row"><div><strong>'+E(r.objective)+'</strong><br><small>'+E(dateText(r.updated))+'</small></div>'+pill(r.state)+button('openRun','Open','',r.id)+'</div>').join(''):empty('No matching runs for this brand.');
}
const outputPage={audience:'Audience Intelligence',competitor:'Audience Intelligence',strategy:'Campaign Planner',content:'Content Studio',calendar:'Content Calendar',analytics:'Analytics and Reports',research:'Market Research'};
function drawMonitor(r){
 const target=$('#run-monitor');if(!target)return;
 const ongoing=activeStates.includes(r.state);
 const controls=(ongoing?button('run-pause','Pause','',r.id)+button('run-recover','Recover stalled run','quiet',r.id):['paused','awaiting clarification'].includes(r.state)?button('run-resume','Resume','',r.id):'')+
 (ongoing||['paused','awaiting clarification'].includes(r.state)?button('run-cancel','Cancel','quiet',r.id):'');
 const list=items=>items.length?'<ul>'+items.map(x=>'<li>'+E(x)+'</li>').join('')+'</ul>':'';
 const ended=activeStates.includes(r.state)?Date.now():Date.parse(r.updated);
 const elapsed=Math.max(0,Math.floor((ended-Date.parse(r.created))/1000));
 target.innerHTML='<div class="row"><h3>'+E(r.objective)+'</h3>'+pill(r.state)+'</div>'+(r.executiveSummary?'<h3>Executive summary</h3><p>'+E(r.executiveSummary)+'</p>':'')+'<p>'+E(r.decision||'Waiting for a planning checkpoint.')+'</p><p class="hint">'+elapsed+' seconds elapsed · '+E(r.provider)+' · '+r.usage.calls+' model calls · '+r.usage.inputTokens+' reported input / '+r.usage.outputTokens+' reported output tokens · '+(r.usage.chargedEstimate==null?'cost unavailable':'reported cost $'+E(r.usage.chargedEstimate))+'</p><div class="actions">'+controls+button('run-md','Download report','',r.id)+button('run-docx','Download Word','',r.id)+button('run-json','Download JSON','',r.id)+button('run-print','Print / PDF','',r.id)+'</div>'+
 r.tasks.map(t=>'<div class="item"><div class="row"><strong>'+E(t.tool==='interpretation'?'Research synthesis':toolLabels[t.tool])+(t.tool==='content'?' · '+E(r.options.formats[Number(t.id.split('-')[1])]):'')+'</strong>'+pill(t.status)+'</div><small>'+E(t.deps.length?'Depends on '+t.deps.join(', '):'Independent task')+' · '+t.attempts+' execution attempts</small><p>'+E(t.note||t.feedback||'')+'</p></div>').join('')+
 (r.outputs.length?'<h3>Saved deliverables</h3>'+r.outputs.map(x=>'<div class="item row"><strong>'+E(x.title)+'</strong>'+button('result-'+x.kind,'Open','',x.id)+'</div>').join(''):'')+
 (r.assumptions.length?'<h3>Assumptions</h3>'+list(r.assumptions):'')+(r.limitations.length?'<h3>Limitations</h3>'+list(r.limitations):'')+
 (r.memory?.length?'<details><summary>Retrieved brand knowledge</summary>'+r.memory.map(m=>'<p><strong>'+E(m.label)+'</strong> · '+E(m.authority)+'<br>'+E(m.excerpt)+'</p>').join('')+'</details>':'')+
 '<details><summary>Execution log</summary>'+list(r.events.map(e=>dateText(e.time)+' · '+e.message))+'</details>';
}
async function loadMonitor(id){
 const bid=state.b;const r=await call('runGet',{id,brand:bid});
 if(bid!==state.b||state.page!=='Agent Workspace'||activeRun!==id)return;
 const entry=rows('run').find(x=>x.id===id);if(entry){entry.state=r.state;entry.updated=r.updated;}
 drawMonitor(r);drawHistory();
}
function drawAgent(){
 drawHistory();
 if(!activeRun||!rows('run').some(x=>x.id===activeRun))activeRun=rows('run')[0]?.id;
 if(activeRun)loadMonitor(activeRun).catch(e=>{if($('#run-monitor'))$('#run-monitor').textContent=e.message;});
}
async function centralSubmit(name,v,f){
 if(name==='analysisSchedule'){await call('analysisSchedule',{days:Number(v.days)});return true;}
 if(name==='researchAccount'){await call('researchAccount',{key:v.key});f.reset();return true;}
 if(name==='agentAccount'){await call('modelAccount',{mode:'save',provider:v.provider,model:v.model,key:v.key});f.reset();return true;}
 if(name!=='centralRun')return false;
 const data=new FormData(f);
 const options={objective:v.objective,provider:v.provider,fallback:v.fallback,depth:v.depth,start:v.start,...(v.frequency?{frequency:+v.frequency}:{}),maxCalls:+v.maxCalls,maxTokens:+v.maxTokens,tools:data.getAll('tools'),formats:data.getAll('formats'),...(v.days?{days:+v.days}:{})};
 const file=f.elements.knowledge.files[0];const signature=JSON.stringify([state.b,options,file?.name,file?.size]);
 if(signature!==centralSignature){centralRequestId=crypto.randomUUID();centralSignature=signature;}
 if(file){await call('document',{name:file.name,text:await referenceText(file)});}
 const out=await call('runStart',{...options,requestId:centralRequestId});activeRun=out.id;centralSignature='';return true;
}
async function reportBundle(id){
 const r=await call('runExport',{id});return r;
}
function markdownReport(bundle){
 const lines=['# '+bundle.run.objective,'','Status · '+bundle.run.state,'','## Executive summary',bundle.run.executiveSummary||bundle.run.state,'','## Decision',bundle.run.decision||'','',...bundle.run.assumptions.map(s=>'- '+s),'','## Limitations',...bundle.run.limitations.map(s=>'- '+s)];
 for(const d of bundle.deliverables){lines.push('','## '+(d.title||d.name||d.query||d.kind));
  if(d.findings)for(const s of d.findings)lines.push('','['+s.id+'] '+s.title,s.url,s.excerpt||'', 'Published '+(s.date||'unknown')+' · retrieved '+s.retrieved);
  else if(d.overall)for(const [k,m] of Object.entries(d.overall))lines.push(k+' = '+(m.value??'unavailable')+' '+m.unit+' ('+m.numerator+' / '+m.denominator+', '+m.covered+'/'+m.total+' paired rows)');
  else for(const [k,v] of Object.entries(d.result||d))if(typeof v==='string'&&!['id','kind','model','updated','title'].includes(k))lines.push('','### '+k,v);
  for(const s of d.sources||[])lines.push('['+s.id+'] '+s.title+' — '+s.url);
 }
 return lines.join('\n');
}
async function centralAction(a,id){
 if(a==='loadModels'){
  const f=$('form[data-form="agentAccount"]'),v=values(f);if(!v.key)throw Error('Enter your provider key first.');
  const el=f.querySelector('[data-act="loadModels"]');el.disabled=true;try{const result=await call('modelAccount',{mode:'list',provider:v.provider,key:v.key});f.elements.model.innerHTML=opt(result.models,'');f.querySelector('.feedback').textContent=result.models.length+' available models.';}finally{el.disabled=false;}return true;
 }
 if(a==='dropSearch'){await call('researchAccount',{mode:'remove'});await refresh(true);return true;}
 if(a==='dropProvider'){await call('modelAccount',{mode:'remove',provider:id});await refresh(true);return true;}
 if(a==='acceptInsight'||a==='rejectInsight'){const x=item('insight',id);await call('reviewInsight',{id,rev:x.rev,decision:a==='acceptInsight'?'Approved':'Rejected'});await refresh();return true;}
 if(a==='openRun'){activeRun=id;await loadMonitor(id);$('#run-monitor')?.scrollIntoView();return true;}
 if(['run-pause','run-cancel','run-resume','run-recover'].includes(a)){await call('runControl',{id,command:a.slice(4)});await refresh();return true;}
 if(['run-md','run-json','run-print','run-docx'].includes(a)){
  const bundle=await reportBundle(id),md=markdownReport(bundle);
  if(a==='run-docx'){download('folio-'+id+'.docx',wordReport(md),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');return true;}
  if(a==='run-print'){modal('Run report','<div class="sheet pre">'+E(md)+'</div>'+button('print','Print / PDF'));return true;}
  download('folio-'+id+(a==='run-json'?'.json':'.md'),a==='run-json'?JSON.stringify(bundle,null,2):md,a==='run-json'?'application/json':'text/markdown');return true;
 }
 if(a.startsWith('result-')){
  const kind=a.slice(7);await refresh();
  if(kind==='content'){modal('Content deliverable',editor(item('content',id)));return true;}
  if(kind==='insight'){await act('editInsight',id);return true;}
  if(kind==='campaign'){modal('Campaign',campaignForm(item('campaign',id)));return true;}
  if(kind==='research'){const r=item('research',id);if(r){modal(r.query,findings(r)||empty('No sources returned.'));return true;}}
  if(kind==='measurementReport'){const r=item(kind,id);if(r){modal(r.title,ratioTable(r));return true;}}
  throw Error('Open the run export to view older saved results.');
 }
 return false;
}
function ratioTable(r){
 const table=o=>'<div class="tablewrap"><table><thead><tr><th>Metric</th><th>Result</th><th>Calculation</th><th>Paired rows</th></tr></thead><tbody>'+Object.entries(o).map(([k,m])=>'<tr><td>'+E(k)+'</td><td>'+E(m.value==null?'—':m.value+' '+m.unit)+'</td><td>'+E(m.numerator+' / '+m.denominator)+'</td><td>'+m.covered+' / '+m.total+'</td></tr>').join('')+'</tbody></table></div>';
 return table(r.overall)+(r.ctrOutliers?.length?'<h3>Unusual CTR observations</h3>'+r.ctrOutliers.map(x=>'<p>'+E(x.date)+' · '+E(x.label)+' · '+E(x.ctr.toFixed(2))+'%</p>').join(''):'')+r.campaigns.map(c=>'<details><summary>'+E(c.campaign)+'</summary>'+table(c.metrics)+'</details>').join('');
}
document.addEventListener('input',e=>{if(e.target.id==='run-search')drawHistory();});
document.addEventListener('change',e=>{if(e.target.id==='agent-example'&&scenarios[e.target.value])e.target.form.elements.objective.value=scenarios[e.target.value];if(e.target.name==='provider'&&e.target.form?.dataset.form==='agentAccount')e.target.form.elements.model.innerHTML='';});
setInterval(async()=>{
 if(document.hidden||runLoading||state.busy||dialog.open||state.page!=='Agent Workspace'||!activeRun)return;
 const current=rows('run').find(x=>x.id===activeRun);if(!current||!activeStates.includes(current.state))return;
 runLoading=true;try{const bid=state.b,id=activeRun,r=await call('runGet',{id});if(bid!==state.b||id!==activeRun||state.page!=='Agent Workspace')return;Object.assign(current,{state:r.state,updated:r.updated});drawMonitor(r);drawHistory();}catch(e){if($('#run-monitor'))$('#run-monitor').textContent=e.message;}finally{runLoading=false;}
},4000);

function analysisScheduleView(){
 if(!state.boot.canSchedule)return '';
 const saved=rows('analysisSchedule')[0];
 return card('Scheduled performance reports',form('analysisSchedule','<p>Compare measured rows when new uploads are available. Reports use no model calls.</p><label class="field">Report frequency<select name="days">'+[[0,'Off'],[1,'Daily'],[7,'Weekly'],[30,'Every 30 days']].map(([n,l])=>'<option value="'+n+'" '+(n===(saved?.days||0)?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+(saved?'<p>Next check · '+E(dateText(new Date(saved.next).toISOString()))+'</p>':''),'Save report schedule'));
}
