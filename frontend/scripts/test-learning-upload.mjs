import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';
const source=fs.readFileSync(new URL('../src/lib/learning-upload.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
class ApiError extends Error {constructor(status){super('API');this.status=status;}}
class UploadError extends Error {constructor(code){super(code);this.code=code;}}
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
function service(transport){const module={exports:{}};new Function('require','module','exports',output)(name=>name==='./api'?{api:{getCsrfToken:async()=>({csrfToken:'csrf'})},ApiError}:{xhrJson:transport,UploadError},module,module.exports);return module.exports.uploadLearning;}
test('verified chunks, lost acknowledgement and resume use server offsets',async()=>{
 storage.clear();const file=new File([new Uint8Array(8*1024*1024+23)],'video.mp4');const stages=[];let uploaded=0,posted=0,manifest;let lost=true;
 const upload=service(async(path,method,body,csrf,options)=>{
  if(path==='/learning/uploads/'){manifest=JSON.parse(body);return {id:'one',uploaded:0,chunk_size:8*1024*1024};}
  if(method==='GET')return {id:'one',uploaded,chunk_size:8*1024*1024};
  posted++;const offset=Number(body.get('offset'));assert.equal(offset,uploaded);const bytes=await body.get('chunk').arrayBuffer();const digest=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');assert.equal(digest,manifest.hashes[offset/(8*1024*1024)]);uploaded+=bytes.byteLength;options.progress(1);options.sent();if(lost){lost=false;throw new UploadError('network');}return {id:'one',uploaded,chunk_size:8*1024*1024};
 });
 assert.equal(await upload(file,'video','super',new AbortController().signal,p=>stages.push(p.stage)),'one');assert.equal(uploaded,file.size);assert.equal(posted,2);assert.ok(stages.includes('retrying'));assert.ok(stages.includes('verifying'));
 assert.equal(await upload(file,'video','super',new AbortController().signal,()=>{}),'one');assert.equal(posted,2);
});
test('aborted upload does not start a media session',async()=>{storage.clear();let calls=0;const controller=new AbortController();controller.abort();const upload=service(async()=>{calls++;});await assert.rejects(upload(new File(['test'],'a.png'),'image','super',controller.signal,()=>{}),e=>e.code==='paused');assert.equal(calls,0);});
test('validation failures are returned without automatic retries',async()=>{storage.clear();let chunks=0;const upload=service(async(path,method)=>{if(path==='/learning/uploads/')return {id:'bad',uploaded:0,chunk_size:8*1024*1024};chunks++;throw new ApiError(400);});await assert.rejects(upload(new File(['invalid'],'a.png'),'image','super',new AbortController().signal,()=>{}),e=>e.status===400);assert.equal(chunks,1);});
