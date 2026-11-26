import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
const assets = {};
for (const [path, file, type] of [
  ['/','client/index.html','text/html; charset=utf-8'],
  ['/ui.js','client/ui.js','application/javascript'],
  ['/style.css','client/style.css','text/css'],
  ['/device.js','client/device.js','application/javascript'],
  ['/wllama.js','vendor/wllama.js','application/javascript'],
  ['/wllama.wasm','vendor/wllama.wasm.gz','application/wasm'],
  ['/csv.js','vendor/papaparse.min.js','application/javascript']
]) {
  const binary = path.endsWith('.wasm');
  assets[path] = { body: await readFile(file, binary ? 'base64' : 'utf8'), type, binary };
}
const files = ['server/common.mjs','server/providers.mjs','server/workflows.mjs','server/linkedin.mjs','server/api.mjs','worker/index.js'];
const code = await Promise.all(files.map(f=>readFile(f,'utf8')));
await mkdir('dist/server',{recursive:true}); await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js','const ASSETS = '+JSON.stringify(assets)+';\n'+code.join('\n'));
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
