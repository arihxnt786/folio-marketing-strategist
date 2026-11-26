import assert from 'node:assert/strict';
import test from 'node:test';
import {researchEvidence,evidenceLink,evidencePublication,evidenceRecord,evidenceDedupe,evidenceNextQuery,evidenceCompetitorHosts,evidenceEligiblePages,evidenceWebDate} from '../server/evidence.mjs';

const start='2026-11-26T00:00:00Z';
test('only attributable public links are retained and tracking parameters are removed',()=>{
  assert.equal(evidenceLink('https://doi.org/10.123/abc?utm_source=hn#report'),'https://doi.org/10.123/abc');
  assert.equal(evidenceLink('https://news.ycombinator.com/item?id=50625738'),'https://news.ycombinator.com/item?id=50625738');
  for(const value of ['javascript:alert(1)','file:///etc/hosts','https://user:secret@site.com/x','http://127.0.0.1/','http://a.local/','http://[::1]/']) assert.equal(evidenceLink(value),'');
});
test('publication dates preserve supplied precision',()=>{
  assert.equal(evidencePublication([2026]),'2026');
  assert.equal(evidencePublication([2026,6]),'2026-06');
  assert.equal(evidencePublication([2026,6,25]),'2026-06-25');
  for(const parts of [[],[2026,13],[2025,2,29],null]) assert.equal(evidencePublication(parts),null);
});
test('source records distinguish text, metadata, discovery dates and stale publication dates',()=>{
  const raw={title:'Social Media Marketing',url:'https://doi.org/10.1093/9780197859063.003.0045',published_at:'2026-06-25',type:'Scholarly metadata'};
  const work=evidenceRecord(raw,'Crossref','social media marketing',start,'social marketing');
  assert.equal(work.freshness,'Potentially outdated');
  assert.equal(work.excerpt_type,'Title only');
  const listing=evidenceRecord({...raw,published_at:null,discovered_at:'2026-11-22T03:00:00Z'},'GDELT','marketing',start,'marketing');
  assert.equal(listing.published_at,null);
  assert.equal(listing.freshness,'Publication date unknown');
  assert.equal(evidenceRecord(raw,'Crossref','bicycle commuting',start,'marketing'),null);
  assert.equal(evidenceRecord({...raw,published_at:'2030-06-25'},'Crossref','marketing',start,'marketing'),null);
});
test('same URL deduplicates across queries while provenance survives',()=>{
  const raw={title:'Social Media Marketing',url:'https://doi.org/10.1093/9780197859063.003.0045'};
  const a=evidenceRecord(raw,'Crossref','social media',start,'marketing');
  const b=evidenceRecord({...raw,url:raw.url+'?utm_source=one'},'Hacker News','marketing',start,'marketing');
  const rows=evidenceDedupe([a,b]);
  assert.equal(rows.length,1);
  assert.deepEqual(new Set(rows[0].queries),new Set(['marketing','social media']));
  assert.deepEqual(new Set(rows[0].found_via),new Set(['Crossref','Hacker News']));
});
test('follow-up uses unused planned topics, broadens sparse results and terminates',()=>{
  assert.equal(evidenceNextQuery(['electric bikes'],['electric bikes','battery recycling'],7,''),'battery recycling');
  assert.equal(evidenceNextQuery(['electric bikes'],['electric bikes'],1,''),'electric');
  assert.equal(evidenceNextQuery(['electric bikes'],['electric bikes'],5,''),null);
  assert.equal(evidenceNextQuery(['retail'],[],0,'retail'),null);
});
test('empty topic returns a missing-input explanation and makes no provider request',async()=>{
  const r=await researchEvidence({objective:'research a market',brand:{guidelines:'Private guideline'}});
  assert.equal(r.providers.length,0);assert.equal(r.sources.length,0);assert.match(r.limitations.join(' '),/public research topic/);
});
test('live search retrieves genuine citations, tracks provider failures and enforces the search budget',
 {skip:process.env.FOLIO_LIVE_EVIDENCE!=='1'},async()=>{
  const r=await researchEvidence({objective:'Social media marketing research',queries:['social media marketing','advertising'],depth:'standard'});
  assert.ok(r.sources.length>0,JSON.stringify(r.providers));
  assert.ok(r.queries.length<=2);assert.ok(r.sources.length<=10);
  assert.equal(new Set(r.sources.map(s=>s.url)).size,r.sources.length);
  for(const [i,s] of r.sources.entries()){
    assert.equal(s.id,'S'+(i+1));assert.ok(s.publisher && s.type && s.excerpt_type && s.freshness);
    assert.ok(evidenceLink(s.url));assert.ok(Number.isFinite(Date.parse(s.retrieved_at)));
  }
  assert.ok(r.providers.filter(p=>p.status==='unavailable').every(p=>r.limitations.some(l=>l.includes(p.name))));
});

test('competitor extraction is restricted to HTTPS pages returned by the provider on declared competitor sites',()=>{
  const hosts=evidenceCompetitorHosts('Acme (https://www.acme.com/), Beta Limited beta.co.uk; http://127.0.0.1/ hello@private-supplier.com');
  assert.deepEqual(hosts,['acme.com','beta.co.uk']);
  const pages=evidenceEligiblePages([
    {provider:'Hacker News',url:'https://www.acme.com/feed'},
    {provider:'Tavily',url:'https://beta.co.uk.other.net/docs'},
    {provider:'Tavily',url:'https://acme.com:1234/'},
    {provider:'Tavily',url:'http://acme.com/public'},
    {provider:'Tavily',url:'https://www.acme.com/stories?utm_source=foo'},
    {provider:'Tavily',url:'https://www.acme.com/stories'},
    {provider:'Tavily',url:'https://news.beta.co.uk/docs'},
    {provider:'Tavily',url:'https://beta.co.uk/another'}
  ],hosts);
  assert.deepEqual(pages,['https://www.acme.com/stories','https://news.beta.co.uk/docs']);
});
test('web result dates preserve missing and partial dates, and parse RFC and ISO timestamps',()=>{
  assert.equal(evidenceWebDate('2026-03'),'2026-03');
  assert.equal(evidenceWebDate('Tue, 03 Mar 2026 00:00:00 GMT'),'2026-03-03');
  assert.equal(evidenceWebDate('2026-03-03T00:00:00Z'),'2026-03-03');
  assert.equal(evidenceWebDate('March'),null);
});
test('optional credentialed Tavily search returns genuine web excerpts',
 {skip:process.env.FOLIO_LIVE_EVIDENCE!=='1'||!process.env.TAVILY_API_KEY},async()=>{
  const r=await researchEvidence({objective:'Compare competitor cycling workshop pages',brand:{competitors:'https://www.rei.com'},
    queries:['bike repair classes'],depth:'quick',env:{TAVILY_API_KEY:process.env.TAVILY_API_KEY}});
  assert.ok(r.providers.some(p=>p.name==='Tavily'&&p.status==='available'),JSON.stringify(r.providers));
  assert.ok(r.sources.some(s=>s.provider==='Tavily'&&s.excerpt_type==='Web search excerpt'&&s.url.includes('rei.com/')));
});
