// Parse document text in the browser. Uploads persist extracted text only.
async function officeEntries(file,wanted){
 if(!file?.size||file.size>2_000_000)throw Error('Choose a document smaller than 2 MB.');
 const zip=new Uint8Array(await file.arrayBuffer()),entries=new Map();let total=0,count=0;
 const parser=new fflate.Unzip(entry=>{
  if(++count>600)throw Error('This archive contains too many entries.');
  if(!wanted.test(entry.name))return;
  if(entry.originalSize>2_000_000||entries.has(entry.name))throw Error('Document entry is too large or duplicated.');
  const decoder=new TextDecoder('utf-8',{fatal:true});let value='';
  entry.ondata=(error,chunk,last)=>{
   if(error)throw Error('Unreadable Office archive.');
   total+=chunk.length;if(total>2_000_000)throw Error('Expanded document exceeds 2 MB.');
   value+=decoder.decode(chunk,{stream:!last});
   if(last){if(/<!(?:DOCTYPE|ENTITY)\b/i.test(value))throw Error('Unsupported XML declaration.');
    const doc=new DOMParser().parseFromString(value,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid Office document XML.');
    entries.set(entry.name,doc);}
  };entry.start();
 });
 parser.register(fflate.UnzipInflate);
 for(let pos=0;pos<zip.length;pos+=1024)parser.push(zip.subarray(pos,pos+1024),pos+1024>=zip.length);
 return entries;
}
const xmlTags=(node,name)=>Array.from(node.getElementsByTagNameNS('*',name));
async function referenceText(file){
 if(!file)throw Error('Choose a reference document.');
 if(/\.docx$/i.test(file.name)){
  const doc=(await officeEntries(file,/^word\/document\.xml$/)).get('word/document.xml');
  if(!doc)throw Error('This DOCX has no document text.');
  return xmlTags(doc,'p').map(p=>xmlTags(p,'t').map(t=>t.textContent).join('')).join('\n').trim();
 }
 if(/\.pdf$/i.test(file.name)){
  if(file.size>2_000_000)throw Error('Choose a PDF smaller than 2 MB.');
  const pdf=await import('/pdf-reader.js');pdf.GlobalWorkerOptions.workerSrc='/pdf-worker.js';
  const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,useWasm:false});
  try{const doc=await task.promise;if(doc.numPages>40)throw Error('Choose up to 40 PDF pages.');
   let text='';for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();text+=content.items.map(x=>(x.str||'')+(x.hasEOL?'\n':' ')).join('')+'\n';page.cleanup();if(text.length>30000)throw Error('Extract a shorter section, up to 30,000 characters.');}
   if(!text.trim())throw Error('This PDF has no selectable text. Upload a text transcript.');return text.trim();
  }finally{await task.destroy();}
 }
 return readFile(file,120000);
}
async function measurementText(file){
 if(!/\.xlsx$/i.test(file?.name||''))return readFile(file,300000);
 const entries=await officeEntries(file,/^xl\/(?:sharedStrings\.xml|worksheets\/sheet1\.xml)$/);
 const sheet=entries.get('xl/worksheets/sheet1.xml');if(!sheet)throw Error('Export the measurement sheet to CSV.');
 const shared=entries.get('xl/sharedStrings.xml'),strings=shared?xmlTags(shared,'si').map(x=>xmlTags(x,'t').map(t=>t.textContent).join('')):[];
 const rows=xmlTags(sheet,'row');if(rows.length>251)throw Error('Import up to 250 measurements at once.');
 const grid=rows.map(row=>{
  const values=[];for(const c of xmlTags(row,'c')){
   const col=(c.getAttribute('r')||'').match(/^[A-Z]+/);if(!col)throw Error('Invalid spreadsheet cell.');
   const i=[...col[0]].reduce((n,ch)=>26*n+ch.charCodeAt(0)-64,0)-1;if(i>50)throw Error('Export up to 51 columns.');
   if(xmlTags(c,'f').length)throw Error('Export formulas as values before importing.');
   const v=xmlTags(c,'v')[0]?.textContent||'',t=c.getAttribute('t');
   values[i]=t==='s'?strings[Number(v)]:t==='inlineStr'?xmlTags(c,'t').map(x=>x.textContent).join(''):v;
  }return values;
 });
 return Papa.unparse(grid);
}
const wordEscape=s=>String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function wordReport(text){
 const document=text.split('\n').map(line=>{
  const marker=line.match(/^(#{1,3}) /),size=marker?[0,38,30,25][marker[1].length]:22;
  return '<w:p><w:r><w:rPr>'+(marker?'<w:b/>':'')+'<w:sz w:val="'+size+'"/></w:rPr><w:t xml:space="preserve">'+wordEscape(line.replace(/^#{1,3} /,''))+'</w:t></w:r></w:p>';
 }).join('');
 const entries={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="doc" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+document+'<w:sectPr/></w:body></w:document>'};
 return fflate.zipSync(Object.fromEntries(Object.entries(entries).map(([name,xml])=>[name,fflate.strToU8(xml)])));
}
