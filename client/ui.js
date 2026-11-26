const $=s=>document.querySelector(s);
const main=$('#main'),dialog=$('#dialog');
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={Dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z','Brand Workspace':'M3 7h7l2 2h9v11H3z M3 7V4h7l2 2h7','Market Research':'M4 19V9m5 10V5m5 14v-7m5 7V3','Audience Intelligence':'M15 20v-2a5 5 0 0 0-10 0v2 M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 5a4 4 0 0 1 0 7m1 3a5 5 0 0 1 3 5','Content Studio':'M4 16 16 4l4 4L8 20l-5 1z M13 7l4 4','Content Calendar':'M3 6h18v15H3z M7 3v5m10-5v5M3 11h18','Campaign Planner':'M4 21V4m0 0c6-4 9 4 15 0v10c-6 4-9-4-15 0','Publishing':'M3 11 21 3l-6 18-4-8z M11 13l10-10','Analytics and Reports':'M4 3v17h17 M8 15l4-5 4 2 5-8','Settings':'M4 7h16M4 17h16 M8 4v6m8 4v6','menu':'M3 6h18M3 12h18M3 18h18','clock':'M12 3a9 9 0 1 0 .1 0 M12 7v6l4 2','plus':'M12 4v16M4 12h16','layers':'M3 8l9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5'};
const icon=k=>'<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="'+(paths[k]||paths.layers)+'"/></svg>';
const names=Object.keys(paths).slice(0,10);
const notes={'Dashboard':'Your editorial operations at a glance.','Brand Workspace':'Manage the context your strategist uses.','Market Research':'Find current public evidence for your next brief.','Audience Intelligence':'Explore audience hypotheses and competitor positioning.','Content Studio':'Write, adapt and refine platform-specific copy.','Content Calendar':'Schedule and review your editorial workflow.','Campaign Planner':'Turn marketing objectives into a production schedule.','Publishing':'Review final copy and record publication.','Analytics and Reports':'Compare measured results from your own platform exports.','Settings':'Manage your AI connection and workspace preferences.'};
const state={boot:null,b:null,w:null,page:'Dashboard',view:'month',anchor:new Date(),platform:'All',group:'All',studio:'content',audience:'audience',busy:false};
const idate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const localTime=s=>s?new Date(new Date(s).getTime()-new Date(s).getTimezoneOffset()*60000).toISOString().slice(0,16):'';
const dateText=s=>s?new Date(s).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}):'Unscheduled';
const opt=(a,v)=>a.map(x=>'<option'+(x===v?' selected':'')+' value="'+E(x)+'">'+E(x)+'</option>').join('');
const button=(act,label,cls='',id='')=>'<button type="button" class="'+cls+'" data-act="'+act+'" data-id="'+E(id)+'">'+label+'</button>';
const nav=(p,label)=>'<a class="btn" href="#'+encodeURIComponent(p)+'">'+E(label||p)+'</a>';
const pill=(s,c='')=>'<span class="pill '+c+'">'+E(s)+'</span>';
const empty=s=>'<p class="empty">'+E(s)+'</p>';
const field=(name,label,value='',type='text',opts={})=>'<label class="field '+(opts.wide?'wide':'')+'">'+E(label)+(type==='area'?'<textarea name="'+name+'" '+(opts.required?'required ':'')+'maxlength="'+(opts.max||10000)+'">'+E(value)+'</textarea>':type==='select'?'<select name="'+name+'">'+opt(opts.values,value)+'</select>':'<input type="'+type+'" name="'+name+'" value="'+E(value)+'" '+(opts.required?'required ':'')+(opts.extra||'')+'>')+(opts.hint?'<small>'+E(opts.hint)+'</small>':'')+'</label>';
const form=(id,body,submit)=>'<form data-form="'+id+'" class="stack">'+body+'<div class="actions"><button class="primary" type="submit">'+submit+'</button></div><div class="feedback" role="status"></div></form>';
const card=(title,body,tools='')=>'<section class="card"><div class="cardhead"><h2>'+E(title)+'</h2>'+tools+'</div>'+body+'</section>';
const head=(extra='')=>'<div class="head"><div><h1>'+E(state.page)+'</h1><p class="muted">'+E(notes[state.page])+'</p></div><div class="actions">'+extra+'</div></div>';
const brand=()=>state.w?.brand;
const rows=k=>state.w?.[k]||[];
const item=(k,id)=>rows(k).find(x=>x.id===id);
const campaignName=id=>item('campaign',id)?.name||'No campaign';
const values=f=>Object.fromEntries(new FormData(f));
async function call(action,data={}){
 const res=await fetch('/api',action?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,brand:state.b,...data})}:{});
 let out;try{out=await res.json();}catch{throw Error('Workspace connection interrupted. Reload and sign in again.');}
 if(!res.ok)throw Error(out.error||'Workspace unavailable.');return out;
}
let sequence=0;
async function refresh(boot=false){
 const token=++sequence;
 if(boot||!state.boot){const b=await call();if(token!==sequence)return;state.boot=b;if(!b.brands.some(x=>x.id===state.b))state.b=b.brands.find(x=>x.id===localStorage.getItem('folio.brand'))?.id||b.brands[0]?.id||'';}
 const id=state.b,w=id?await call('workspace',{brand:id}):null;if(token!==sequence||id!==state.b)return;
 state.w=w;localStorage.setItem('folio.brand',id);render();
}
let toastTimer;
function toast(s){$('#toast').textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',4500);}
const modal=(title,body)=>{dialog.innerHTML='<div class="cardhead"><h2>'+E(title)+'</h2>'+button('close','Close','quiet')+'</div>'+body;if(!dialog.open)dialog.showModal();};
function showError(t){modal('Action needs attention','<p class="errorbox">'+E(t)+'</p>');}
const sections=[['Workspace',names.slice(0,4)],['Production',names.slice(4,9)]];
function shell(){
 $('#rail').innerHTML='<div class="brandmark"><span class="mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Folio</div>'+button('menu','Close','menuclose quiet')+sections.map(([g,ns])=>'<div class="rail-label">'+g+'</div>'+ns.map(link).join('')).join('')+'<div class="railend">'+link('Settings')+'</div>';
 $('#top').innerHTML=button('menu',icon('menu')+' Menu','mobilemenu')+'<span class="crumb">Workspace &nbsp; / &nbsp; <strong>'+E(state.page)+'</strong></span><label><span class="skip">Selected brand</span><select class="workspace-select" id="brand-select">'+(state.boot?.brands.map(x=>'<option value="'+E(x.id)+'" '+(x.id===state.b?'selected':'')+'>'+E(x.name)+'</option>').join('')||'<option>No brand selected</option>')+'<option value="__new">＋ New brand</option></select></label>';
}
function link(n){return '<a class="navlink '+(state.page===n?'active':'')+'" '+(state.page===n?'aria-current="page"':'')+' href="#'+encodeURIComponent(n)+'">'+icon(n)+E(n)+'</a>';}
function contentList(items,more=true){return items.length?items.map(x=>'<div class="item row"><div><h3>'+E(x.title)+'</h3><small>'+E(x.platform)+' · '+E(dateText(x.schedule))+' · '+E(campaignName(x.campaign))+'</small></div><div class="actions">'+pill(x.status)+(more?button('editContent','Open','quiet',x.id):'')+'</div></div>').join(''):empty('No content in this view yet.');}
function dashboard(){
 const content=rows('content'),future=content.filter(x=>x.schedule&&x.schedule>=new Date().toISOString()).sort((a,b)=>a.schedule.localeCompare(b.schedule));
 const metrics=[['Content Studio','Content items',content.length],['Campaign Planner','Active campaigns',rows('campaign').filter(x=>x.status==='Active').length],['Content Calendar','Upcoming',future.length],['Publishing','In review',content.filter(x=>x.status==='Review').length]];
 const hero='<section class="hero"><div><div class="overline">'+(brand()?E(brand().name):'Brand workspace')+'</div><h2>'+(brand()?'Brand overview':'Start with your brand.')+'</h2><p>'+E(brand()?.objectives||'Give your strategist the audience, voice and objectives behind your content.')+'</p>'+(brand()?button('studio','Open content studio'):button('newBrand',icon('plus')+' Create brand'))+'</div><div class="art" aria-hidden="true"></div></section>';
 return head()+hero+'<div class="stats">'+metrics.map(([k,l,v])=>'<div class="stat"><span>'+icon(k)+l+'</span><strong>'+v+'</strong></div>').join('')+'</div><div class="cols"><div>'+card('Upcoming content',contentList(future.slice(0,5)),nav('Content Calendar','Calendar'))+card('Campaigns',rows('campaign').length?rows('campaign').slice(0,4).map(c=>'<div class="item row"><strong>'+E(c.name)+'</strong>'+pill(c.status)+'</div>').join(''):empty('Campaigns will appear here when you create a plan.'),nav('Campaign Planner','Plan campaign'))+'</div><div>'+card('Recent activity',rows('activity').length?rows('activity').slice(0,6).map(x=>'<div class="item"><strong>'+E(x.action)+'</strong><br><small>'+E(dateText(x.updated))+'</small></div>').join(''):empty('Brand edits, saved drafts and scheduling updates will appear here.'))+'</div></div>';
}
const brandLabels={name:'Brand name',website:'Website',industry:'Industry',category:'Business category',products:'Products and services',usp:'Unique selling propositions',audience:'Target audience',geography:'Geographic market',competitors:'Competitor names and websites',voice:'Brand voice',objectives:'Marketing objectives',restrictions:'Restricted words, claims and topics',guidelines:'Brand guidelines'};
function brandForm(b={}){
 const fields=Object.entries(brandLabels).map(([k,l])=>field(k,l,b[k],['name','website','industry','category','geography'].includes(k)?(k==='website'?'url':'text'):'area',{required:k==='name',max:2500,extra:'maxlength="'+(k==='name'?100:2500)+'"',hint:k==='restrictions'?'Separate phrases with commas or line breaks.':''})).join('');
 return form('brand','<input type="hidden" name="id" value="'+E(b.id)+'"><input type="hidden" name="rev" value="'+E(b.rev)+'"><div class="formgrid">'+fields+'<div class="wide"><h3 class="subhead">Preferred platforms</h3><div class="checks">'+state.boot.platforms.map(p=>'<label><input type="checkbox" name="platforms" value="'+p+'" '+(b.platforms?.includes(p)?'checked':'')+'>'+p+'</label>').join('')+'</div></div></div>','Save brand');
}
function brandsView(){
 const b=brand();return head(button('newBrand',icon('plus')+' New brand','primary'))+(b?card(b.name,brandForm(b))+card('Reference documents','<p class="hint">Upload plain text or Markdown, up to 30,000 characters each. The strategist reads excerpts from the six latest documents.</p>'+form('uploaddoc','<input aria-label="Reference document" type="file" name="file" accept=".txt,.md" required>','Upload reference')+rows('document').map(d=>'<div class="item row"><strong>'+E(d.name)+'</strong>'+button('removeDoc','Remove','quiet danger',d.id)+'</div>').join(''))+button('deleteBrand','Delete this brand','danger'):card('Create your first brand',brandForm()));
}
function findings(r){return r.findings.map(x=>{
 const outdated=x.date&&Date.parse(x.date)<Date.now()-90*864e5;
 return '<article class="item"><small>'+E(x.provider)+' · '+E(x.source)+'</small><h3><a href="'+E(x.url)+'" target="_blank" rel="noreferrer">'+E(x.title)+'</a></h3><small>'+E(x.dateType||'Publication')+' date '+E(x.date||'unavailable')+(x.seen?' · Discovered '+E(x.seen):'')+' · Retrieved '+E(x.retrieved.slice(0,10))+'</small> '+(outdated?pill('Over 90 days old','warn'):'')+(x.original?'<div><a target="_blank" rel="noreferrer" href="'+E(x.original)+'">Linked article</a></div>':'')+'</article>';
 }).join('');}
function researchView(){
 const r=rows('research');return head()+card('Search public sources',form('research','<div class="formgrid">'+field('query','Search topic',r[0]?.query||brand()?.industry||'','text',{required:true,extra:'maxlength="160"',hint:'Use a topic or competitor name. Each source has different coverage.'})+field('days','Lookback period in days','30','select',{values:['7','30','90','365']})+'</div>','Retrieve sources'))+
 (r.length?r.map(x=>card(x.query,'<div class="actions">'+x.providers.map(p=>pill(p.name+' · '+(p.state==='Available'?p.count+' records':'Unavailable'),p.state==='Available'?'':'warn')).join('')+'</div>'+x.providers.filter(p=>p.error).map(p=>'<p class="hint">'+E(p.name)+': '+E(p.error)+'</p>').join('')+'<p class="hint">Source records · retrieved '+E(dateText(x.retrieved))+'. Titles and dates are attributed metadata. Read the original before treating a claim as verified.</p>'+(findings(x)||empty('No matching records were retrieved.')))).join(''):card('Source records',empty('Run a search to build a dated evidence trail for this brand.')))+card('Research interpretation',agentForm('interpretation'))+insights(['interpretation']);
}
const briefLabels={content:'Creative brief',repurpose:'Adaptation brief',audience:'Audience question',competitor:'Competitor question',strategy:'Strategy objective',interpretation:'Research question',report:'Reporting question'};
const briefExamples={content:'Describe the product, audience action and angle.',repurpose:'Specify the destination and what the adaptation should achieve.',audience:'Which buyers should this campaign prioritize, and why?',competitor:'Which public messages leave room for our brand to differentiate?',strategy:'Build a campaign around the selected brand’s marketing objective.',interpretation:'Which topics in the retrieved sources warrant a content experiment?',report:'Compare measured channel outcomes and suggest the next experiment.'};
function campaignSelect(value=''){return '<label class="field">Campaign<select name="campaign"><option value="">No campaign</option>'+rows('campaign').map(c=>'<option value="'+E(c.id)+'" '+(value===c.id?'selected':'')+'>'+E(c.name)+'</option>').join('')+'</select></label>';}
function agentForm(type,preset={}){
 const content=['content','repurpose'].includes(type),fmt=preset.format||Object.keys(state.boot.formats).find(f=>brand().platforms.includes(state.boot.formats[f]))||'Instagram caption';
 const provider=localStorage.getItem('folio.ai')||(state.boot.connected?'gemini':'device');
 const dest=content?field('format','Destination format',fmt,'select',{values:Object.keys(state.boot.formats)})+field('platform','Destination platform',preset.platform||state.boot.formats[fmt],'select',{values:state.boot.platforms})+field('variations','Creative variations','1','select',{values:['1','2','3','4','5']}):'';
 return form('agent','<input type="hidden" name="type" value="'+type+'"><div class="formgrid">'+field('brief',briefLabels[type],preset.brief||(content?'':briefExamples[type]),'area',{wide:true,required:true,hint:content?briefExamples[type]:'',max:4000})+(type==='repurpose'?field('original','Original article, post or transcript',preset.original||'','area',{required:true,wide:true,max:18000}):'')+dest+(content?'<div class="checks wide"><label><input type="checkbox" name="useEvidence">Use saved research in this draft</label></div>':'')+campaignSelect(preset.campaign)+field('research','Refresh source evidence first (optional)','','text',{wide:true,extra:'maxlength="160"',hint:'Enter a public search topic to retrieve new sources before generation.'})+'<label class="field">AI engine<select name="provider"><option value="device" '+(provider==='device'?'selected':'')+'>On-device · Qwen 0.5B</option><option value="gemini" '+(provider==='gemini'?'selected':'')+'>Gemini · '+(state.boot.connected?'connected':'setup required')+'</option></select></label></div><p class="hint">On-device AI downloads about 398 MB on first use and needs available memory. Gemini sends this brand’s brief, reference excerpts and selected evidence to Google.</p>','Generate '+(content?'drafts':'analysis'));
}
function insights(types){
 return rows('insight').filter(x=>types.includes(x.type)).map(x=>card(x.title,'<p class="hint">AI interpretation · '+E(x.model)+' · '+E(dateText(x.updated))+'</p>'+Object.entries(x.result).filter(([k])=>k!=='title').map(([k,v])=>'<div class="item"><h3>'+E(labelKey(k))+'</h3><div class="pre">'+E(v)+'</div></div>').join('')+sourceLinks(x.sources),button('editInsight','Edit','',x.id))).join('');
}
const labelKey=k=>(k[0].toUpperCase()+k.slice(1)).replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ');
const sourceLinks=s=>s?.length?'<details><summary>Evidence supplied to the strategist ('+s.length+')</summary>'+s.map(x=>'<p><a href="'+E(x.url)+'" rel="noreferrer" target="_blank">'+E(x.id)+' · '+E(x.title)+'</a></p>').join('')+'</details>':'';
function tabs(options,selected,act){return '<div class="toolbar tabs">'+options.map(([k,l])=>'<button data-act="'+act+'" data-id="'+k+'" aria-pressed="'+(k===selected)+'">'+l+'</button>').join('')+'</div>';}
function studioView(){return head(button('newContent',icon('plus')+' Write manually'))+tabs([['content','Generate'],['repurpose','Repurpose']],state.studio,'studioTab')+card(state.studio==='content'?'Creative brief':'Adapt existing content',agentForm(state.studio))+card('Saved drafts',contentList(rows('content')));}
function audienceView(){return head()+tabs([['audience','Audience'],['competitor','Competitors']],state.audience,'audTab')+card(state.audience==='audience'?'Audience brief':'Competitor brief',agentForm(state.audience))+insights([state.audience]);}
function campaignForm(c={}){const d=idate(new Date());return form('campaign','<input type="hidden" name="id" value="'+E(c.id)+'"><input type="hidden" name="rev" value="'+E(c.rev)+'"><div class="formgrid">'+field('name','Campaign name',c.name,'text',{required:true,wide:true})+field('objective','Campaign objective',c.objective||brand().objectives,'area',{required:true,wide:true})+field('start','Start date',c.start||d,'date',{required:true})+field('end','End date',c.end||d,'date',{required:true})+field('status','Campaign status',c.status||'Planning','select',{values:['Planning','Active','Complete']})+'</div>','Save campaign');}
function plannerView(){return head(button('newCampaign',icon('plus')+' New campaign','primary'))+card('Campaigns',rows('campaign').length?rows('campaign').map(c=>'<div class="item"><div class="row"><h3>'+E(c.name)+'</h3>'+pill(c.status)+'</div><p>'+E(c.objective)+'</p><small>'+E(c.start)+' – '+E(c.end)+' · '+rows('content').filter(x=>x.campaign===c.id).length+' content items</small><div class="actions">'+button('planCalendar','Generate calendar','',c.id)+button('editCampaign','Edit','quiet',c.id)+'</div></div>').join(''):empty('Create a campaign to define its objective, dates and publishing cadence.'))+card('Content strategy',agentForm('strategy'))+insights(['strategy']);}
function scheduleForm(c){return form('schedule','<input type="hidden" name="campaign" value="'+E(c.id)+'"><div class="formgrid">'+field('frequency','Posts per week','3','number',{required:true,extra:'min="1" max="7"'})+field('time','Chosen local time','10:00','time',{required:true})+'</div><p class="hint">'+E(c.start)+' through '+E(c.end)+' · '+E(Intl.DateTimeFormat().resolvedOptions().timeZone)+'. Slots are spaced across each week using your chosen time.</p><h3 class="subhead">Rotate these formats</h3><div class="checks">'+Object.entries(state.boot.formats).map(([f,p])=>'<label><input type="checkbox" name="formats" value="'+E(f)+'" '+(brand().platforms.includes(p)?'checked':'')+'>'+E(f)+'</label>').join('')+'</div>','Create draft slots');}
const ck=['title','hook','body','cta','hashtags','audience','objective','visual'];
function editor(x={},duplicate=false){
 if(['Published','Awaiting confirmation'].includes(x.status)&&!duplicate){preview(x);return;}
 const value=duplicate?{...x,id:'',rev:'',title:x.title+' (copy)',status:'Draft',schedule:''}:x;
 const fmt=value.format||'Instagram caption';
 modal(duplicate?'Duplicate content':x.id?'Edit content':'New content',form('content','<input type="hidden" name="id" value="'+E(value.id)+'"><input type="hidden" name="rev" value="'+E(value.rev)+'"><div class="formgrid">'+field('title','Title',value.title,'text',{required:true,wide:true})+field('format','Format',fmt,'select',{values:Object.keys(state.boot.formats)})+field('platform','Platform',value.platform||state.boot.formats[fmt],'select',{values:state.boot.platforms})+ck.slice(1).map(k=>field(k,k==='cta'?'Call to action':labelKey(k),value[k],'area',{wide:['body','hook'].includes(k)})).join('')+campaignSelect(value.campaign)+field('schedule','Publish at (local time)',localTime(value.schedule),'datetime-local')+field('status','Workflow status',value.status==='Approved'?'Review':value.status||'Draft','select',{values:['Draft','Review']})+'</div>','Save content')+(x.id&&!duplicate?'<div class="actions">'+button('dup','Duplicate','',x.id)+button('refine','Refine with AI','',x.id)+'</div>':'')+sourceLinks(x.sources));
}
function selectedItems(){return rows('content').filter(x=>(state.platform==='All'||x.platform===state.platform)&&(state.group==='All'||x.campaign===state.group));}
function calendarView(){
 const a=new Date(state.anchor),month=state.view==='month';
 const first=month?new Date(a.getFullYear(),a.getMonth(),1):new Date(a);first.setHours(0,0,0,0);const offset=(first.getDay()+6)%7;first.setDate(first.getDate()-offset);
 const days=month?Math.ceil((offset+new Date(a.getFullYear(),a.getMonth()+1,0).getDate())/7)*7:7;
 const end=new Date(first);end.setDate(end.getDate()+days);
 const list=selectedItems(),cells=Array.from({length:days},(_,i)=>{
 const day=new Date(first);day.setDate(day.getDate()+i);const key=idate(day);
 return '<div class="day '+(key===idate(new Date())?'today':'')+'" data-day="'+key+'"><time datetime="'+key+'">'+day.getDate()+'</time>'+list.filter(x=>x.schedule&&idate(new Date(x.schedule))===key).map(x=>'<button draggable="'+(x.status!=='Published')+'" data-act="editContent" data-id="'+E(x.id)+'" title="'+E(x.title)+'">'+E(x.platform)+'<span class="itemtitle"> · '+E(x.title)+'</span></button>').join('')+'</div>';}).join('');
 const range=month?a.toLocaleDateString(undefined,{month:'long',year:'numeric'}):'Week of '+idate(first);
 return head(button('newContent',icon('plus')+' New content','primary'))+'<div class="sheet"><div class="toolbar">'+button('prev','Previous')+'<strong>'+E(range)+'</strong>'+button('next','Next')+button('today','Today','quiet')+'<span class="spacer"></span>'+tabs([['week','Week'],['month','Month']],state.view,'calView')+'</div><div class="toolbar"><label>Platform <select id="platform-filter">'+opt(['All',...state.boot.platforms],state.platform)+'</select></label><label>Campaign <select id="group-filter"><option value="All">All</option>'+rows('campaign').map(c=>'<option value="'+E(c.id)+'" '+(c.id===state.group?'selected':'')+'>'+E(c.name)+'</option>').join('')+'</select></label>'+button('exportCalendar','Export filtered CSV')+'</div><div class="cal">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<div class="weekday">'+d+'</div>').join('')+cells+'</div></div>'+card('Scheduled this period',contentList(list.filter(x=>x.schedule&&new Date(x.schedule)>=first&&new Date(x.schedule)<end).sort((a,b)=>a.schedule.localeCompare(b.schedule))))+card('Unscheduled',contentList(list.filter(x=>!x.schedule)));
}
const channels={Instagram:'https://www.instagram.com/',Facebook:'https://business.facebook.com/',LinkedIn:'https://www.linkedin.com/feed/',YouTube:'https://studio.youtube.com/',X:'https://x.com/compose/post'};
const publishCopy=x=>[x.hook,x.body,x.cta,x.hashtags].filter(Boolean).join('\n\n');
function preview(x){
 const approved=x.status==='Approved',published=x.status==='Published';
 modal('Publication preview','<div class="actions">'+pill(x.platform)+pill(published?(x.confirmation||x.status):x.status)+'</div><h3>'+E(x.title)+'</h3><div class="sheet pre">'+E(publishCopy(x)||'No copy has been written.')+'</div><small>Visual direction · '+E(x.visual||'Unspecified')+'</small><div class="actions">'+(published?'<a class="btn" href="'+E(x.permalink)+'" target="_blank" rel="noreferrer">Open recorded post</a>':approved?(x.platform==='LinkedIn'&&state.w.linkedin?button('sendLinkedin','Publish publicly as '+E(state.w.linkedin.name),'primary',x.id):'')+button('copy','Copy approved text','',x.id)+button('txt','Download copy','',x.id)+(channels[x.platform]?'<a class="btn" target="_blank" rel="noreferrer" href="'+channels[x.platform]+'">Open '+E(x.platform)+'</a>':''):x.status==='Awaiting confirmation'?'':button('approve','Approve this version','primary',x.id))+(published?button('dup','Duplicate','',x.id):button('editContent','Edit','quiet',x.id))+'</div>'+(x.publishError?'<p class="errorbox">'+E(x.publishError)+'</p>':'')+((approved||x.status==='Awaiting confirmation')?form('receipt','<input type="hidden" name="id" value="'+E(x.id)+'">'+field('url','Published post or campaign URL','','url',{required:true,hint:'After publishing in the destination account, record its URL here. This is a manual confirmation.'}),'Record manual publication'):''));
}
function publishingView(){const c=state.w.linkedin;return head()+card('LinkedIn member account',c?'<p>Connected as '+E(c.name)+' · token expires '+E(dateText(c.expires))+'</p>'+button('disconnectLinkedin','Disconnect account'):state.boot.linkedinConfigured?button('connectLinkedin','Authorize LinkedIn','primary'): '<p class="hint">Direct posting needs an authorized LinkedIn developer app. Approved copy can be exported and published manually.</p>')+card('Approval queue','<p class="hint">Review the exact copy, approve it, then publish in the destination account. A manual receipt and a LinkedIn API confirmation are labeled separately.</p>'+ (rows('content').length?rows('content').map(x=>'<div class="item row"><div><h3>'+E(x.title)+'</h3><small>'+E(x.platform)+' · '+E(x.format)+'</small></div><div class="actions">'+pill(x.confirmation||x.status)+button('preview','Preview','',x.id)+'</div></div>').join(''):empty('Saved content will appear here for review.')));}
function reportRows(){return rows('metric').filter(r=>!state.reportCampaign||r.campaign===state.reportCampaign);}
function analyticsView(){
 const all=rows('metric'),rs=reportRows(),metrics=state.boot.metricNames;
 const table=rs.length?'<div class="tablewrap"><table><thead><tr>'+['Date','Content','Platform','Campaign',...metrics.map(labelKey)].map(k=>'<th>'+E(k)+'</th>').join('')+'</tr></thead><tbody>'+rs.map(x=>'<tr>'+[x.date,x.label,x.platform,x.campaign,...metrics.map(k=>x.metrics[k]??'—')].map(v=>'<td>'+E(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':empty('Import a platform or campaign export to compare measured results.');
 const groups=[...new Set(rs.map(r=>r.platform))];
 const summary=groups.map(p=>{const rr=rs.filter(x=>x.platform===p);return '<div class="item"><h3>'+E(p)+' · '+rr.length+' rows</h3><div>'+metrics.flatMap(k=>{const vals=rr.flatMap(r=>k in r.metrics?[r.metrics[k]]:[]);return vals.length?[E(labelKey(k))+' '+vals.reduce((a,b)=>a+b,0).toLocaleString()+' ('+vals.length+' measured)']:[]}).join(' · ')+'</div></div>';}).join('');
 return head(button('reportCsv','Export measured CSV')+button('print','Print / PDF'))+card('Import measurements','<p class="hint">Required columns: date, label, platform, and one metric. Optional campaign. Empty metric cells remain unknown. Reimporting a matching date, label, platform and campaign replaces its measurements.</p>'+form('metrics','<input aria-label="Analytics CSV" type="file" name="file" accept=".csv,text/csv" required>','Import CSV')+button('csvTemplate','Download blank template','quiet'))+card('Measured performance','<div class="toolbar"><label>Campaign <select id="report-filter"><option value="">All campaigns</option>'+opt([...new Set(all.map(x=>x.campaign).filter(Boolean))],state.reportCampaign)+'</select></label></div>'+summary+'<p class="hint">Sums reflect reported rows. Reach may overlap across posts. A dash represents an unreported measurement.</p>'+table)+card('Campaign analysis',agentForm('report'))+insights(['report']);
}
function settingsView(){return head()+card('AI engine','<p>On-device AI runs the Qwen2.5 0.5B model in your browser. It uses about 398 MB of storage and can take several minutes on a phone. Gemini uses a server-side API key and the quota from your Google project.</p>'+field('defaultAI','Preferred engine',localStorage.getItem('folio.ai')||(state.boot.connected?'gemini':'device'),'select',{values:['device','gemini']})+'<p class="hint">Gemini connection · '+E(state.boot.connected?'Connected: '+state.boot.model:'No account connected')+'</p>')+card('Connect Gemini','<p class="hint">Use a key from a project with an eligible free model. Google may use unpaid-service inputs and outputs to improve products. Use public brand material under those terms.</p><p><a target="_blank" rel="noreferrer" href="https://aistudio.google.com/apikey">Open Google AI Studio</a></p>'+form('connect','<div class="formgrid">'+field('key','Gemini API key','','password',{required:true,extra:'autocomplete="off"',hint:'Sent over HTTPS and encrypted server-side. The app never returns the saved key.'})+field('model','Model ID (optional)',state.boot.model,'text',{hint:'Leave empty to select an available Flash text model.'})+'</div>','Verify and connect')+(state.boot.personal?button('disconnect','Disconnect personal key','danger'):''))
 +card('Appearance',button('theme',document.documentElement.classList.contains('dark')?'Use light theme':'Use dark theme'));
}
function render(){
 shell();if(!state.boot)return;
 const pages={'Dashboard':dashboard,'Brand Workspace':brandsView,'Market Research':researchView,'Audience Intelligence':audienceView,'Content Studio':studioView,'Content Calendar':calendarView,'Campaign Planner':plannerView,'Publishing':publishingView,'Analytics and Reports':analyticsView,'Settings':settingsView};
 main.innerHTML=(!brand()&&!['Dashboard','Brand Workspace','Settings'].includes(state.page))?head()+card('Create a brand first','<p>This workflow uses your selected brand’s audience and objectives.</p>'+button('newBrand',icon('plus')+' Create brand','primary')):pages[state.page]();
}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function csv(name,keys,records){download(name,'\ufeff'+Papa.unparse({fields:keys,data:records.map(r=>keys.map(k=>r[k]??''))},{escapeFormulae:/^[\s]*[=+@-]|^[\t\r]/}),'text/csv;charset=utf-8');}
async function readFile(f,max){if(!f||f.size>max||!f.size)throw Error('Select a nonempty file within the size limit.');try{return new TextDecoder('utf-8',{fatal:true}).decode(await f.arrayBuffer());}catch{throw Error('Save the file as UTF-8 text and try again.');}}
let controller;
async function runAgent(v,f,progress){
 const selected=state.b;controller=new AbortController();const sig=controller.signal;
 f.querySelector('.feedback').insertAdjacentHTML('afterend',button('cancel','Cancel generation','quiet'));
 try{
 if(v.provider==='gemini'&&!state.boot.connected)throw Error('Connect your Gemini key in Settings or select On-device AI.');
 if(v.research?.trim()){progress('Retrieving fresh evidence…');await call('research',{brand:selected,query:v.research,days:30});}
 let n=0;for(let i=1;i<=Number(v.variations||1);i++){
 sig.throwIfAborted();progress('Preparing variation '+i+'…');const o=await call('start',{...v,brand:selected,variation:i,reportCampaign:state.reportCampaign||''});
 if(v.provider==='device'){const {generate}=await import('/device.js');const result=await generate(o.plan,progress,sig);sig.throwIfAborted();await call('finish',{brand:selected,id:o.id,result});}
 n++;
 }toast(n+' result'+(n===1?'':'s')+' saved.');}
 finally{controller=null;f.querySelector('[data-act=cancel]')?.remove();}
}
function generateSlots(c,f,time){
 const slots=[],start=new Date(c.start+'T12:00:00'),end=new Date(c.end+'T12:00:00');let d=new Date(start),index=0;
 const offsets=new Set(Array.from({length:f},(_,i)=>Math.floor(i*7/f)));
 while(d<=end){if(offsets.has(index%7)){const day=idate(d);slots.push({day,time:new Date(day+'T'+time).toISOString()});if(slots.length>90)throw Error('This campaign exceeds 90 slots. Shorten its dates or reduce the frequency.');}d.setDate(d.getDate()+1);index++;}return slots;
}
document.addEventListener('submit',async event=>{
 const f=event.target.closest('form[data-form]');if(!f)return;event.preventDefault();if(state.busy)return;
 const name=f.dataset.form,v=values(f),status=f.querySelector('.feedback'),submit=f.querySelector('button[type=submit]');
 const progress=t=>{status.className='feedback busyline';status.textContent=t;};
 state.busy=true;submit.disabled=true;progress('Working…');
 try{
 let boot=false,notice='Saved.';
 if(name==='brand'){const id=await call('saveBrand',{brand:v.id||'',rev:Number(v.rev),profile:{...v,platforms:new FormData(f).getAll('platforms')}});state.b=id.id;boot=true;}
 else if(name==='uploaddoc'){const file=f.elements.file.files[0];await call('document',{name:file.name,text:await readFile(file,120000)});}
 else if(name==='deleteBrand'){await call('deleteBrand',{confirm:v.confirm});state.b='';boot=true;}
 else if(name==='research'){await call('research',{query:v.query,days:Number(v.days)});notice='Research run saved. See source availability below.';}
 else if(name==='agent'){await runAgent(v,f,progress);notice='';}
 else if(name==='campaign'){await call('campaign',{...v,rev:Number(v.rev)});}
 else if(name==='schedule'){const freq=Number(v.frequency);const x=await call('calendar',{campaign:v.campaign,frequency:freq,slots:generateSlots(item('campaign',v.campaign),freq,v.time),formats:new FormData(f).getAll('formats')});state.anchor=new Date(item('campaign',v.campaign).start+'T12:00:00');notice=x.count+' draft slots created.';}
 else if(name==='content'){await call('saveContent',{id:v.id,rev:Number(v.rev),item:{...v,schedule:v.schedule?new Date(v.schedule).toISOString():''}});}
 else if(name==='insight'){await call('saveInsight',{id:v.id,rev:Number(v.rev),result:v});}
 else if(name==='receipt'){const x=item('content',v.id);await call('receipt',{id:x.id,rev:x.rev,url:v.url});notice='Manual publication recorded.';}
 else if(name==='metrics'){
  const t=await readFile(f.elements.file.files[0],300000);const parsed=Papa.parse(t,{header:true,skipEmptyLines:'greedy',transformHeader:s=>s.trim().toLowerCase()});
  if(parsed.errors.length)throw Error('CSV row '+((parsed.errors[0].row??0)+2)+': '+parsed.errors[0].message);
  if(!['date','label','platform'].every(k=>parsed.meta.fields.includes(k)))throw Error('CSV requires date, label and platform columns.');
  if(!state.boot.metricNames.some(k=>parsed.meta.fields.includes(k)))throw Error('Include at least one supported metric from the template.');
  const r=await call('metrics',{rows:parsed.data});notice=r.count+' measurement rows imported.';}
 else if(name==='connect'){await call('connect',{key:v.key,model:v.model});f.reset();localStorage.setItem('folio.ai','gemini');boot=true;notice='Gemini key verified.';}
 if(dialog.open)dialog.close();await refresh(boot);if(notice)toast(notice);
 }catch(e){status.className='feedback errorbox';status.textContent=e.name==='AbortError'?'Generation cancelled. Previously saved variations remain available.':e.message;}
 finally{state.busy=false;submit.disabled=false;}
});
async function act(a,id){
 const x=item('content',id);
 if(a==='cancel'){controller?.abort();return;}if(state.busy){toast('A workspace operation is in progress.');return;}
 if(a==='menu'){$('#rail').classList.toggle('open');return;}
 if(a==='close'){dialog.close();return;}
 if(a==='newBrand'){modal('New brand',brandForm());return;}
 if(a==='deleteBrand'){modal('Delete brand',form('deleteBrand',field('confirm','Type '+brand().name+' to permanently delete this brand and its records','','text',{required:true}),'Delete brand and records'));return;}
 if(a==='removeDoc'){await call('removeDocument',{id});await refresh();return;}
 if(a==='studio'){location.hash=encodeURIComponent('Content Studio');return;}
 if(a==='studioTab'||a==='audTab'||a==='calView'){state[{studioTab:'studio',audTab:'audience',calView:'view'}[a]]=id;render();return;}
 if(a==='newCampaign'||a==='editCampaign'){modal(a==='newCampaign'?'New campaign':'Edit campaign',campaignForm(item('campaign',id)));return;}
 if(a==='planCalendar'){modal('Generate calendar',scheduleForm(item('campaign',id)));return;}
 if(a==='editContent'||a==='newContent'||a==='dup'){editor(x,a==='dup');return;}
 if(a==='editInsight'){const o=item('insight',id);modal('Edit analysis',form('insight','<input type="hidden" name="id" value="'+E(id)+'"><input type="hidden" name="rev" value="'+o.rev+'">'+Object.entries(o.result).map(([k,v])=>field(k,labelKey(k),v,'area',{required:true})).join(''),'Save changes'));return;}
 if(a==='refine'){modal('Refine into a new draft',agentForm('repurpose',{original:publishCopy(x)||x.brief||x.title,format:x.format,platform:x.platform,campaign:x.campaign,brief:'Refine this '+x.format+' for '+(x.audience||brand().audience)+'. '+(x.objective||brand().objectives)}));return;}
 if(a==='prev'||a==='next'||a==='today'){if(a==='today')state.anchor=new Date();else{const n=a==='prev'?-1:1;if(state.view==='week')state.anchor.setDate(state.anchor.getDate()+n*7);else state.anchor=new Date(state.anchor.getFullYear(),state.anchor.getMonth()+n,1);}render();return;}
 if(a==='exportCalendar'){const cols=['title','platform','format','campaign','schedule','status','hook','body','cta','hashtags','audience','objective','visual','permalink'];csv('folio-calendar.csv',cols,selectedItems().map(i=>({...i,campaign:campaignName(i.campaign)})));return;}
 if(a==='preview'){preview(x);return;}
 if(a==='approve'){await call('saveContent',{id,rev:x.rev,approve:true,item:{...x,status:'Approved'}});await refresh();preview(item('content',id));return;}
 if(a==='connectLinkedin'){const out=await call('linkedinBegin');window.top.location.href=out.url;return;}
 if(a==='disconnectLinkedin'){await call('linkedinDisconnect');await refresh();return;}
 if(a==='sendLinkedin'){try{await call('linkedinPublish',{id,rev:x.rev,recipient:state.w.linkedin.sub,confirm:true});}finally{await refresh();preview(item('content',id));}return;}
 if(a==='copy'){await navigator.clipboard.writeText(publishCopy(x));toast('Approved copy copied.');return;}
 if(a==='txt'){download('approved-content.txt',publishCopy(x),'text/plain');return;}
 if(a==='csvTemplate'||a==='reportCsv'){csv(a==='csvTemplate'?'folio-metrics-template.csv':'folio-measured-report.csv',['date','label','platform','campaign',...state.boot.metricNames],a==='csvTemplate'?[]:reportRows().map(r=>({...r,...r.metrics})));return;}
 if(a==='print'){window.print();return;}
 if(a==='disconnect'){await call('disconnect');localStorage.setItem('folio.ai','device');await refresh(true);return;}
 if(a==='theme'){const b=document.documentElement.classList.toggle('dark');localStorage.setItem('folio.theme',b?'dark':'light');render();}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)act(b.dataset.act,b.dataset.id).catch(er=>showError(er.message));});
document.addEventListener('change',async e=>{
 const s=e.target;try{
 if(s.id==='brand-select'){if(state.busy){s.value=state.b;return;}if(s.value==='__new'){s.value=state.b;modal('New brand',brandForm());return;}state.b=s.value;state.w=null;state.group='All';state.reportCampaign='';main.textContent='Opening brand…';await refresh();return;}
 if(s.id==='platform-filter'||s.id==='group-filter'||s.id==='report-filter'){state[{'platform-filter':'platform','group-filter':'group','report-filter':'reportCampaign'}[s.id]]=s.value;render();}
 if(s.name==='format'){const p=s.form?.elements.platform;if(p)p.value=state.boot.formats[s.value];}
 if(s.name==='defaultAI'){localStorage.setItem('folio.ai',s.value);toast('Default AI engine saved.');}
 }catch(er){showError(er.message);}
});
document.addEventListener('dragstart',e=>{const b=e.target.closest('[draggable=true]');if(b)e.dataTransfer.setData('text/plain',b.dataset.id);});
document.addEventListener('dragover',e=>{if(e.target.closest('[data-day]'))e.preventDefault();});
document.addEventListener('drop',async e=>{
 const day=e.target.closest('[data-day]');if(!day||state.busy)return;e.preventDefault();const x=item('content',e.dataTransfer.getData('text/plain'));if(!x||x.status==='Published')return;
 try{const time=localTime(x.schedule).slice(11)||'10:00';await call('saveContent',{id:x.id,rev:x.rev,item:{...x,status:x.status==='Approved'?'Review':x.status,schedule:new Date(day.dataset.day+'T'+time).toISOString()}});await refresh();toast('Schedule updated.');}catch(er){showError(er.message);}
});
function route(){let p;try{p=decodeURIComponent(location.hash.slice(1));}catch{}state.page=names.includes(p)?p:'Dashboard';$('#rail').classList.remove('open');if(dialog.open&&!state.busy)dialog.close();if(state.boot)render();window.scrollTo(0,0);}
window.addEventListener('hashchange',route);document.documentElement.classList.toggle('dark',localStorage.getItem('folio.theme')==='dark');route();refresh(true).catch(e=>{main.innerHTML='<h1>Workspace unavailable</h1><p class="errorbox">'+E(e.message)+'</p><a class="btn" target="_top" href="/signin-with-chatgpt?returnTo=%2F">Sign in</a> <a class="btn" href="/">Retry</a>';});
