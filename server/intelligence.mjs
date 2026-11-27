// Pairwise coverage prevents a missing numerator on one row from borrowing a denominator on another.
const ratioDefinitions = {
 engagementRate:['engagement','impressions',100], ctr:['clicks','impressions',100],
 conversionRate:['conversions','clicks',100], cpc:['spend','clicks',1],
 cpl:['spend','leads',1], cpa:['spend','conversions',1], roas:['revenue','spend',1]
};
export function performanceSummary(rows){
 const summarize=group=>Object.fromEntries(Object.entries(ratioDefinitions).map(([name,[n,d,multiplier]])=>{
  const pairs=group.map(x=>x.metrics).filter(m=>Number.isFinite(m[n])&&Number.isFinite(m[d]));
  const sum=k=>pairs.reduce((total,m)=>total+m[k],0);
  return [name,{value:sum(d)>0?Number((sum(n)*multiplier/sum(d)).toFixed(4)):null,numerator:n,denominator:d,unit:multiplier===100?'%':name==='roas'?'×':'currency',covered:pairs.length,total:group.length}];
 }));
 const groups=[...new Set(rows.map(x=>x.campaign||'Unassigned'))];
 const comparable=rows.filter(row=>Number.isFinite(row.metrics.clicks)&&row.metrics.impressions>0);
 const sorted=comparable.map(row=>100*row.metrics.clicks/row.metrics.impressions).sort((a,b)=>a-b);
 const median=a=>a.length%2?a[Math.floor(a.length/2)]:(a[a.length/2-1]+a[a.length/2])/2;
 const middle=sorted.length?median(sorted):null;
 const mad=sorted.length?median(sorted.map(x=>Math.abs(x-middle)).sort((a,b)=>a-b)):0;
 const unusual=comparable.filter(row=>sorted.length>=5&&mad>0&&Math.abs(100*row.metrics.clicks/row.metrics.impressions-middle)>3*1.4826*mad).map(row=>({label:row.label,date:row.date,ctr:100*row.metrics.clicks/row.metrics.impressions}));
 return {rows:rows.length,ctrOutliers:unusual,overall:summarize(rows),campaigns:groups.slice(0,40).map(campaign=>({campaign,metrics:summarize(rows.filter(x=>(x.campaign||'Unassigned')===campaign))})),limitations:['Missing pairs are excluded independently for each metric. Zero denominators yield no rate. Compare spending in one currency. Differences are descriptive.']};
}
const memoryWords=s=>[...new Set(String(s||'').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])];
export async function retrieveMemory(db,user,brand,objective){
 const query=memoryWords(objective+' '+brand.industry+' '+brand.audience);
 const records=(await Promise.all(['document','insight','campaign','research','content','run'].map(kind=>rowsBy(db,user,brand.id,kind,30)))).flat();
 const chunks=[];
 for(const r of records){
  let source=r.text||r.body||r.objective||r.result&&Object.values(r.result).join('\n')||r.findings?.map(x=>x.title).join('\n')||'';
  if(r.kind==='run')source=['completed','partially completed'].includes(r.state)?r.objective+' '+(r.assumptions||[]).join(' '):'';
  for(let i=0;i<Math.min(source.length,30000);i+=750){
   const excerpt=source.slice(i,i+900),terms=new Set(memoryWords(excerpt)),score=query.reduce((s,t)=>s+Number(terms.has(t)),0);
   if(score)chunks.push({record:r.id,kind:r.kind,label:r.name||r.title||r.query||r.kind,offset:i,excerpt,score,authority:r.kind==='document'?'user-supplied reference':r.kind==='research'?'attributed metadata':'historical work'});
  }
 }
 return chunks.sort((a,b)=>b.score-a.score).filter((v,i,a)=>a.findIndex(x=>x.excerpt===v.excerpt)===i).slice(0,6);
}

export function verifyBrandOffers(draft,brand,memory=[]){
 const approved=[brand.products,brand.usp,brand.guidelines,...memory.filter(m=>m.kind==='document').map(m=>m.excerpt)].join(' ').normalize('NFKC').toLowerCase();
 const copy=[draft.hook,draft.body,draft.cta].join(' ').normalize('NFKC').toLowerCase();
 const offers=copy.match(/\bfree (?:trial|shipping|delivery|consultation|returns)|\bmoney.back guarantee|\blifetime warranty|\b(?:iso[- ]?\d{4,5}|certified organic|clinically proven)|(?:[$₹€£]\s?\d[\d,.]*|\d+(?:\.\d+)?% (?:off|discount))/g)||[];
 const unsupported=offers.find(x=>!approved.includes(x));
 if(unsupported)stop(422,'Remove the unsupported offer or claim “'+unsupported+'”. Use a CTA supported by this brand.');
}
