// All HTTP destinations are fixed public search APIs. Source pages are linked, never executed.
const evidenceProfiles = {
  quick: {rounds: 1, limit: 6, days: 90},
  standard: {rounds: 2, limit: 10, days: 180},
  deep: {rounds: 3, limit: 15, days: 365}
};
const evidenceStop = new Set(('a an and are as at be by for from how in is it of on or our the these this to using with your '+
  'analyse analyze build campaign campaigns content create develop explore find generate growth identify improve increase '+
  'latest launch learn market objective opportunities plan promote recent recommend research results relevant strategy trends us we').split(/\s+/));

function evidenceText(value, limit = 250) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 16000).replace(/<[^>]*>/g, ' ')
    .replace(/&(amp|quot|apos|lt|gt|nbsp);|&#(\d{1,7});|&#x([\da-f]{1,6});/gi, (_, name, dec, hex) => {
      if (name) return ({amp:'&', quot:'"', apos:"'", lt:'<', gt:'>', nbsp:' '})[name.toLowerCase()];
      const n = dec ? Number(dec) : parseInt(hex, 16);
      return n > 31 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ' ';
    }).replace(/[\x00-\x1f\x7f\s]+/gu, ' ').trim().slice(0, limit).trim();
}
function evidenceTerms(text) {
  const publicText = evidenceText(text, 2000).replace(/https?:\/\/\S+|\S+@\S+|\b[\w-]{32,}\b/gi, ' ');
  return [...new Set((publicText.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}\p{M}-]*/gu) || [])
    .filter(word => word.length > 1 && word.length < 40 && !evidenceStop.has(word) && !/^\d+$/.test(word)))];
}
function evidenceQuery(text) {
  return evidenceTerms(text).slice(0, 6).join(' ').slice(0, 120).trim();
}
function evidenceLink(value) {
  if (typeof value !== 'string' || value.length > 2500) return '';
  try {
    const u = new URL(value);
    if (!['https:','http:'].includes(u.protocol) || u.username || u.password ||
        !u.hostname.includes('.') || /[\[\]:]/.test(u.hostname) || /^[\d.]+$/.test(u.hostname) ||
        /\.(local|localhost|internal|invalid|test)$/.test(u.hostname)) return '';
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
    return u.href;
  } catch { return ''; }
}
function evidencePublication(parts) {
  if (!Array.isArray(parts) || parts.length < 1 || parts.length > 3 || !parts.every(Number.isInteger)) return null;
  const [y,m,d] = parts;
  if (y < 1000 || y > 9999 || (m !== undefined && (m < 1 || m > 12)) ||
      (d !== undefined && (d < 1 || d > new Date(Date.UTC(y,m,0)).getUTCDate()))) return null;
  return parts.map((n,i) => i ? String(n).padStart(2,'0') : String(n)).join('-');
}
function evidenceISO(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) ? new Date(n).toISOString() : null;
}
function evidenceState(row, at) {
  const date = row.published_at || row.discussion_at || row.discovered_at;
  if (!date || date.length < 10) return 'Publication recency uncertain';
  const age = (Date.parse(at) - Date.parse(date)) / 86400000;
  if (age < -1) return 'Future date';
  if (age > 90) return 'Potentially outdated';
  return row.published_at ? 'Published within 90 days' : 'Publication date unknown';
}

async function evidenceJSON(url, timeout = 7000, init = {}) {
  const deadline = Date.now() + timeout;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await fetch(url, {...init,headers:{accept:'application/json',...init.headers},redirect:'error',
        signal:AbortSignal.timeout(Math.max(1, deadline - Date.now()))});
    } catch {
      throw new Error('Connection unavailable or timed out.');
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (!init.method && attempt === 0 && [502,503,504].includes(response.status) && Date.now() + 1100 < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      const retry = response.headers.get('retry-after');
      throw new Error('HTTP ' + response.status + (response.status === 429 && /^\d{1,8}$/.test(retry || '') ? ' (retry after ' + retry + ' seconds)' : '') + '.');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty response.');
    let bytes = 0, content = '';
    const decoder = new TextDecoder();
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 750000) { await reader.cancel(); throw new Error('Response exceeds the read budget.'); }
      content += decoder.decode(value, {stream:true});
    }
    try { return JSON.parse(content + decoder.decode()); } catch { throw new Error('Unreadable provider response.'); }
  }
}
function evidenceList(value) {
  if (!Array.isArray(value)) throw new Error('Unexpected provider response structure.');
  return value.slice(0,12);
}
function evidenceCompetitorHosts(competitors) {
  if (typeof competitors!=='string') return [];
  const hosts=[];
  for (const token of competitors.slice(0,2500).split(/[\s,;|()<>]+/)) {
    if (!token || token.includes('@')) continue;
    const link=evidenceLink(/^https?:\/\//i.test(token) ? token : 'https://'+token);
    if (!link) continue;
    const host=new URL(link).hostname.toLowerCase().replace(/^www\./,'').replace(/\.$/,'');
    if (/^(?:[a-z0-9][a-z0-9-]*\.)+[a-z]{2,}$/.test(host) && !hosts.includes(host)) hosts.push(host);
  }
  return hosts.slice(0,8);
}
function evidenceEligiblePages(rows,hosts) {
  const selected=[];
  for (const row of rows) {
    const href=evidenceLink(row.url);
    if (row.provider!=='Tavily' || !href) continue;
    const u=new URL(href),host=u.hostname.toLowerCase();
    if (u.protocol!=='https:' || u.port || !hosts.some(h=>host===h || host.endsWith('.'+h))) continue;
    if (!selected.includes(href)) selected.push(href);
    if (selected.length===2) break;
  }
  return selected;
}
function evidenceWebDate(value) {
  if (typeof value!=='string') return null;
  if (/^\d{4}(-\d{2}){0,2}$/.test(value)) return evidencePublication(value.split('-').map(Number));
  const iso=evidenceISO(value);
  if(iso) return iso.slice(0,10);
  if (!/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [\d ]?\d [A-Za-z]{3} \d{4} [\d:]+ GMT$/i.test(value)) return null;
  const ts=Date.parse(value);
  return Number.isFinite(ts) ? new Date(ts).toISOString().slice(0,10) : null;
}
function evidenceTavily(action,key,body) {
  return evidenceJSON('https://api.tavily.com/'+action,7500,{method:'POST',
    headers:{authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)});
}
const evidenceAdapters = {
  'Tavily': async ({query,since,until,env,hosts}) => {
    const body={query,search_depth:'basic',auto_parameters:false,topic:'general',max_results:6,
      include_answer:false,include_raw_content:false,include_images:false,include_published_date:true};
    if (hosts.length) body.include_domains=hosts;
    else Object.assign(body,{start_date:since,end_date:until});
    const r=await evidenceTavily('search',env.TAVILY_API_KEY,body);
    return evidenceList(r.results).map(x=>({title:x.title,url:x.url,excerpt:x.content,excerpt_type:'Web search excerpt',
      type:hosts.length ? 'Competitor website' : 'Web search result',published_at:evidenceWebDate(x.published_date)}))
      .filter(x=>!hosts.length || evidenceEligiblePages([{provider:'Tavily',url:x.url}],hosts).length);
  },
  'Crossref': async ({query,since,until,env}) => {
    const p = new URLSearchParams({'query.bibliographic':query, filter:'from-pub-date:'+since+',until-pub-date:'+until,
      rows:'8', select:'title,URL,published,publisher,abstract'});
    if (typeof env.CROSSREF_MAILTO === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.CROSSREF_MAILTO)) p.set('mailto',env.CROSSREF_MAILTO);
    const r = await evidenceJSON('https://api.crossref.org/works?'+p);
    return evidenceList(r.message?.items).map(x => ({title:x.title?.[0],url:x.URL,publisher:x.publisher,excerpt:x.abstract,
      published_at:evidencePublication(x.published?.['date-parts']?.[0]),type:'Scholarly metadata',excerpt_type:'Publisher-supplied abstract'}));
  },
  'Hacker News': async ({query,since}) => {
    const p = new URLSearchParams({query,tags:'story',hitsPerPage:'8',restrictSearchableAttributes:'title',typoTolerance:'false',
      numericFilters:'created_at_i>='+Math.floor(Date.parse(since)/1000)});
    const r = await evidenceJSON('https://hn.algolia.com/api/v1/search?'+p);
    return evidenceList(r.hits).filter(x => /^\d+$/.test(String(x.objectID))).map(x => {
      const discussion = 'https://news.ycombinator.com/item?id='+x.objectID;
      return {title:x.title,url:evidenceLink(x.url)||discussion,discussion_url:discussion,discussion_at:evidenceISO(x.created_at),
        excerpt:x.story_text,excerpt_type:'Submitter text',type:'Public discussion'};
    });
  },
  'GDELT': async ({query,days}) => {
    const p = new URLSearchParams({query,mode:'ArtList',format:'json',maxrecords:'10',sort:'HybridRel',timespan:Math.min(days,90)+'d'});
    const r = await evidenceJSON('https://api.gdeltproject.org/api/v2/doc/doc?'+p,4500);
    return evidenceList(r.articles).map(x => ({title:x.title,url:x.url,publisher:x.domain,type:'News index',
      discovered_at:evidenceISO(x.seendate?.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z'))}));
  },
  'Federal Register': async ({query,since,until}) => {
    const p = new URLSearchParams({'conditions[term]':query,'conditions[publication_date][gte]':since,'conditions[publication_date][lte]':until,
      per_page:'6',order:'relevance'});
    for (const f of ['title','abstract','html_url','publication_date','agencies']) p.append('fields[]',f);
    const r = await evidenceJSON('https://www.federalregister.gov/api/v1/documents.json?'+p);
    return evidenceList(r.results).map(x => ({title:x.title,url:x.html_url,published_at:evidenceISO(x.publication_date)?.slice(0,10),
      excerpt:x.abstract,excerpt_type:'Agency abstract',type:'US government notice',publisher:x.agencies?.[0]?.name || 'Federal Register'}));
  }
};
function evidenceSnippet(value) {
  const text = evidenceText(value, 500);
  if (text.length <= 360) return text;
  const shortened = text.slice(0,359).replace(/\s+\S*$/, '').trim();
  return (shortened || text.slice(0,359))+'…';
}
function evidenceOverlap(query, text) {
  const terms = evidenceTerms(query);
  const words = new Set(evidenceTerms(text));
  return terms.filter(t => words.has(t)).length / Math.max(terms.length,1);
}
function evidenceRecord(raw, provider, query, retrieved, objective) {
  const title = evidenceText(raw.title, 300), url = evidenceLink(raw.url);
  if (!title || !url) return null;
  const excerpt = evidenceSnippet(raw.excerpt);
  const titleMatch = evidenceOverlap(query,title);
  const combinedMatch = evidenceOverlap(query,title+' '+excerpt);
  if (combinedMatch < 0.3) return null;
  const data = {title,url,publisher:evidenceText(raw.publisher,150)||new URL(url).hostname,provider,type:raw.type,
    excerpt:excerpt || title,excerpt_type:excerpt ? raw.excerpt_type : 'Title only',
    published_at:raw.published_at || null,discovered_at:raw.discovered_at || null,discussion_at:raw.discussion_at || null,
    discussion_url:raw.discussion_url || null,retrieved_at:retrieved,queries:[query],found_via:[provider]};
  data.freshness = evidenceState(data,retrieved);
  if (data.freshness === 'Future date') return null;
  data.rank = 4*combinedMatch+2*titleMatch+evidenceOverlap(objective,title+' '+excerpt)+
    (excerpt ? 0.6 : 0)+(data.freshness === 'Published within 90 days' ? 0.3 : 0);
  return data;
}
function evidenceDedupe(rows) {
  const byURL=new Map(), byTitle=new Map(), kept=[];
  for (const row of [...rows].sort((a,b)=>b.rank-a.rank || a.url.localeCompare(b.url))) {
    const u = new URL(row.url);
    const host = u.hostname.toLowerCase().replace(/^www\./,'');
    const key = ['doi.org','dx.doi.org'].includes(host)
      ? 'doi.org'+u.pathname.toLowerCase().replace(/\/$/,'')
      : host + u.pathname.replace(/\/$/,'') + u.search;
    const headline = row.title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
    // Common short titles like "Marketing" occur on genuinely different works.
    const titleKey = headline.length > 40 ? u.hostname+'|'+headline : '';
    const previous = byURL.get(key) || (titleKey && byTitle.get(titleKey));
    if (previous) {
      previous.queries = [...new Set([...previous.queries,...row.queries])];
      previous.found_via = [...new Set([...previous.found_via,...row.found_via])];
      byURL.set(key,previous);
      continue;
    }
    byURL.set(key,row); if(titleKey) byTitle.set(titleKey,row); kept.push(row);
  }
  return kept;
}
function evidenceNextQuery(used, planned, count, industry) {
  const next = planned.find(q => !used.includes(q));
  if (next) return next;
  const terms = evidenceTerms(used[used.length-1]);
  if (count < 3 && terms.length >= 2) {
    const broad = terms.slice(0,Math.max(1,Math.floor(terms.length/2))).join(' ');
    if (!used.includes(broad)) return broad;
  }
  if (count < 3 && industry && !used.includes(industry)) return industry;
  return null;
}
export async function researchEvidence({objective='',brand={},depth='standard',env={},queries=[]}={}) {
  const tier = Object.hasOwn(evidenceProfiles,depth) ? depth : 'standard';
  const profile = evidenceProfiles[tier], started = new Date().toISOString(), until=started.slice(0,10);
  const since=new Date(Date.parse(started)-profile.days*86400000).toISOString().slice(0,10);
  const industry = evidenceQuery(brand?.industry);
  const planned = [...new Set((Array.isArray(queries) ? queries.slice(0,6) : [])
    .map(q=>evidenceQuery(typeof q==='string' ? q : q?.query || q?.q)).filter(Boolean))];
  if (!planned.length) {
    const task = evidenceQuery(objective);
    if (task) planned.push(task);
    else if (industry) planned.push(industry);
  }
  const limits = [], providers = [], used = [], seen = [], unavailable = new Set();
  if (!planned.length) limits.push('Supply a public research topic or industry.');
  const names = ['Crossref','Hacker News','GDELT'];
  const scope = [brand?.geography, objective, ...planned].join(' ');
  const competitorTask = /\b(competitor[a-z]*|competitive|rivals?|benchmark[a-z]*)\b/i.test([objective,...planned].join(' '));
  const hosts = competitorTask ? evidenceCompetitorHosts(brand?.competitors) : [];
  if (typeof env.TAVILY_API_KEY==='string' && env.TAVILY_API_KEY.trim()) names.unshift('Tavily');
  else if(planned.length) limits.push('General-web search is not configured. Coverage is limited to the available public indexes.');
  if (competitorTask && !hosts.length) limits.push('No competitor website domains were supplied for a first-party search.');
  if (/\b(united states|u\.?s\.?a?\b|american|federal register)\b/i.test(scope) &&
      /\b(regulat\w*|policy|compliance|rules?|legislation|federal)\b/i.test(scope)) names.push('Federal Register');
  let query = planned[0];
  const startedMs = Date.now();
  for (let round=0;query && round<profile.rounds;round++) {
    if (round && Date.now()-startedMs > 15500) { limits.push('Stopped at the research time budget.'); break; }
    used.push(query);
    const active = names.filter(name=>!unavailable.has(name));
    if (!active.length) break;
    const results = await Promise.all(active.map(async name=>{
      try {
        const raw = await evidenceAdapters[name]({query,since,until,days:profile.days,env,hosts});
        const retrieved = new Date().toISOString();
        const rows = raw.map(x=>evidenceRecord(x,name,query,retrieved,objective)).filter(Boolean);
        return {name,query,rows,received:raw.length};
      } catch (error) {
        const message = typeof error?.message === 'string' ? evidenceText(error.message,160) : 'Provider unavailable.';
        return {name,query,error:message};
      }
    }));
    for (const r of results) {
      if (r.error) {
        unavailable.add(r.name);
        providers.push({name:r.name,query,status:'unavailable',error:r.error});
        limits.push(r.name+' unavailable for “'+query+'”. '+r.error);
      } else {
        providers.push({name:r.name,query,status:'available',received:r.received,matched:r.rows.length});
        seen.push(...r.rows);
      }
    }
    if (!names.some(name=>!unavailable.has(name))) break;
    query = evidenceNextQuery(used,planned,evidenceDedupe(seen).length,industry);
  }
  if (tier==='deep' && hosts.length && env.TAVILY_EXTRACT==='1' && env.TAVILY_API_KEY) {
    const pages=evidenceEligiblePages([...seen].sort((a,b)=>b.rank-a.rank),hosts);
    if(pages.length && Date.now()-startedMs<15500) {
      try {
        const result=await evidenceTavily('extract',env.TAVILY_API_KEY,{urls:pages,query:used[0],chunks_per_source:1,
          extract_depth:'basic',format:'text',timeout:5,include_published_date:true});
        const entries=evidenceList(result.results);
        let matched=0;
        for(const href of pages) {
          const found=entries.find(x=>evidenceLink(x.url)===href && evidenceSnippet(x.raw_content));
          if(!found) continue;
          for(const row of seen.filter(x=>x.provider==='Tavily' && x.url===href)) {
            row.excerpt=evidenceSnippet(found.raw_content);row.excerpt_type='Extracted competitor page';
            row.published_at ||= evidenceWebDate(found.published_date);
            row.retrieved_at=new Date().toISOString();row.freshness=evidenceState(row,row.retrieved_at);
          }
          matched++;
        }
        providers.push({name:'Tavily Extract',status:'available',requested:pages.length,matched});
        if(matched<pages.length) limits.push('Some competitor pages could not be extracted. Their original search excerpts were retained.');
      } catch(error) {
        const message=evidenceText(error?.message || 'Provider unavailable.',160);
        providers.push({name:'Tavily Extract',status:'unavailable',error:message});
        limits.push('Tavily Extract unavailable. Original search excerpts were retained. '+message);
      }
    } else if(pages.length) limits.push('Competitor page extraction skipped at the research time budget.');
  }
  const unique = evidenceDedupe(seen.filter(r=>r.freshness!=='Future date'));
  // Give each successful source class one place before filling the remaining ranked slots.
  const first = names.map(n=>unique.find(r=>r.provider===n)).filter(Boolean);
  const selected = [...new Set([...first,...unique])].slice(0,profile.limit).sort((a,b)=>b.rank-a.rank);
  const sources = selected.map(({rank,...r},i)=>({...r,id:'S'+(i+1)}));
  if (used.length && !sources.length) limits.push('No relevant source records were retained. Evidence is insufficient.');
  else if(sources.length < 3 && sources.length) limits.push('Fewer than three distinct source records matched. Coverage is limited.');
  if (sources.length && new Set(sources.map(s=>s.provider)).size===1) limits.push('All retained records come from one search provider. Independent corroboration is limited.');
  if (sources.some(r=>r.excerpt_type==='Title only')) limits.push('Some records contain a headline only. Check the linked source before relying on any claim.');
  if (sources.length) limits.push('Search records do not establish market-wide trend velocity, audience size or private performance.');
  return {sources,limitations:limits,providers,queries:used,depth:tier,period:{from:since,to:until},retrieved_at:started};
}

export {evidenceLink, evidencePublication, evidenceRecord, evidenceDedupe, evidenceNextQuery, evidenceCompetitorHosts, evidenceEligiblePages, evidenceWebDate};
