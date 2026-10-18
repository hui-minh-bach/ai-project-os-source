// Synthetic local provider contracts only. Assertions never print credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { DATA_DIR } from '../src/lib/store.mjs';
import { unlockVault, lockVault, saveConnection } from '../src/lib/vault.mjs';
import { ask } from '../src/lib/providers.mjs';
import { createProject, founderChat, getProject } from '../src/lib/projects.mjs';

function setup(){
 lockVault();for(const name of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak','model-registry.json','model-registry.json.bak'])fs.rmSync(path.join(DATA_DIR,name),{force:true});
 const nonce=crypto.randomBytes(18).toString('hex');const secrets={current:`synthetic-current-${nonce}-"\\tail`,other:`synthetic-other-${nonce}-"\n\\end`,password:`synthetic-vault-${nonce}-"\\password`};
 unlockVault(secrets.password);saveConnection({kind:'other',name:'Unrelated synthetic account',secret:secrets.other});return secrets;
}
function noSecrets(text,secrets){
 const value=String(text);for(const secret of Object.values(secrets)){assert.equal(value.includes(secret),false,'Raw credential must be absent');assert.equal(value.includes(JSON.stringify(secret).slice(1,-1)),false,'Escaped credential must be absent');}
}
function parseProtocol(text){
 try{return JSON.parse(text)}catch{assert.fail('Sanitized protocol must remain valid JSON')}
}
async function fixture(getText,secrets){
 let authenticated=false;const server=http.createServer(async(req,res)=>{
  for await(const chunk of req){};authenticated ||= [req.headers.authorization,req.headers['x-goog-api-key'],req.headers['x-api-key']].some(value=>value===secrets.current||value===`Bearer ${secrets.current}`);
  const text=await getText(req);const json=req.url.startsWith('/gemini')?{candidates:[{content:{parts:[{text}]}}]}:req.url.startsWith('/anthropic')?{content:[{text}]}:req.url.startsWith('/compatible')?{choices:[{message:{content:text}}]}:{output_text:text};res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(json));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return {base:`http://127.0.0.1:${server.address().port}`,authenticated:()=>authenticated,close:()=>new Promise(resolve=>server.close(resolve))};
}
function connection(kind,base,secrets){return saveConnection({kind,name:'Synthetic provider',model:'synthetic-model',secret:secrets.current,baseUrl:base+'/'+({openai:'openai',gemini:'gemini',anthropic:'anthropic',openai_compatible:'compatible'}[kind])});}

test('successful replies from all AI adapters redact current, unrelated Vault credential and password before project persistence',async()=>{
 const secrets=setup();const plaintext=`Provider echoed ${secrets.current}; unrelated ${secrets.other}; password ${secrets.password}.`;const f=await fixture(()=>plaintext,secrets);
 try{
  for(const kind of ['openai','gemini','anthropic','openai_compatible']){const c=connection(kind,f.base,secrets);const reply=await ask(c.id,{prompt:'Synthetic provider contract'});noSecrets(reply,secrets);assert.equal(reply.includes('[redacted]'),true,'Reply contains a redaction marker');}
  const c=connection('openai',f.base,secrets),p=createProject({name:'Synthetic output security fixture',idea:'Local persistence contract'});const reply=await founderChat(p.id,c.id,'Synthetic contract message');noSecrets(reply,secrets);noSecrets(getProject(p.id).messages.at(-1).content,secrets);noSecrets(fs.readFileSync(path.join(DATA_DIR,'projects.json'),'utf8'),secrets);assert.equal(f.authenticated(),true,'Provider still receives its original credential');
 }finally{await f.close();lockVault()}
});

test('mixed raw quote-bearing and JSON-escaped credentials cannot hide later tokens from Founder reply, memory or disk',async()=>{
 const secrets=setup();let plaintext=secrets.current+' / '+JSON.stringify(secrets.other)+' / '+secrets.password;const f=await fixture(()=>plaintext,secrets);
 try{
  const c=connection('openai',f.base,secrets),p=createProject({name:'Synthetic mixed output fixture',idea:'Local mixed encoding contract'});const reply=await founderChat(p.id,c.id,'Synthetic mixed credential contract');noSecrets(reply,secrets);noSecrets(getProject(p.id).messages.at(-1).content,secrets);const disk=fs.readFileSync(path.join(DATA_DIR,'projects.json'),'utf8');noSecrets(disk,secrets);const persisted=parseProtocol(disk).find(project=>project.id===p.id);noSecrets(persisted.messages.at(-1).content,secrets);
  const unicode=Array.from(secrets.other).map(char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0')).join('');
  for(plaintext of [secrets.current+' / '+JSON.stringify(secrets.other)+' / '+JSON.stringify(secrets.password),'Stray opening quote " / '+JSON.stringify(secrets.other)+' / '+secrets.current,secrets.current+' / "'+unicode+'" / '+secrets.password]){const mixedReply=await ask(c.id,{prompt:'Synthetic mixed encoding variant'});noSecrets(mixedReply,secrets);assert.equal(mixedReply.includes(unicode),false,'Unicode-escaped credential must be absent');}
 }finally{await f.close();lockVault()}
});

test('quoted, backslash and Unicode-escaped credentials are redacted inside protocol JSON while review booleans and tool fields stay intact',async()=>{
 const secrets=setup();const payload={approved:false,tool:'done',count:7,summary:secrets.current,nested:{unrelated:secrets.other,password:secrets.password},path:'index.html',content:'export const index = 2;'};let format='json';const unicode=Array.from(secrets.current).map(char=>'\\u'+char.charCodeAt(0).toString(16).padStart(4,'0')).join('');
 const f=await fixture(()=>format==='json'?JSON.stringify(payload):format==='fence'?'```json\n'+JSON.stringify(payload)+'\n```':`{"approved":false,"tool":"done","summary":"${unicode}"}`,secrets);
 try{
  const c=connection('openai',f.base,secrets);
  for(format of ['json','fence','unicode']){const reply=await ask(c.id,{prompt:'Synthetic JSON contract'}),body=format==='fence'?reply.match(/```json\s*([\s\S]*?)```/)?.[1]:reply;noSecrets(reply,secrets);const parsed=parseProtocol(body);noSecrets(JSON.stringify(parsed),secrets);assert.equal(parsed.approved,false,'Reviewer false remains a boolean');assert.equal(parsed.tool,'done','Tool dispatch remains intact');assert.equal(parsed.summary,'[redacted]','JSON string is safely redacted');if(format==='fence')assert.equal(reply.endsWith('\n```'),true,'Closing Markdown fence remains on its own line');if(format!=='unicode'){assert.equal(parsed.count,7);assert.equal(parsed.path,'index.html');assert.equal(parsed.content,'export const index = 2;');assert.equal(parsed.nested.unrelated,'[redacted]');assert.equal(parsed.nested.password,'[redacted]');}}
 }finally{await f.close();lockVault()}
});

test('Vault lock during await cannot remove the captured response-redaction context',async()=>{
 const secrets=setup();let arrived,release;const pending=new Promise(resolve=>{release=resolve}),received=new Promise(resolve=>{arrived=resolve});const f=await fixture(async()=>{arrived();await pending;return JSON.stringify({approved:false,summary:secrets.current,other:secrets.other,password:secrets.password})},secrets);
 try{
  const c=connection('anthropic',f.base,secrets),replyPromise=ask(c.id,{prompt:'Synthetic delayed response'});await received;lockVault();release();const reply=await replyPromise;noSecrets(reply,secrets);const parsed=parseProtocol(reply);noSecrets(JSON.stringify(parsed),secrets);assert.equal(parsed.approved,false);assert.equal(parsed.summary,'[redacted]');assert.equal(parsed.other,'[redacted]');assert.equal(parsed.password,'[redacted]');
 }finally{release();await f.close();lockVault()}
});

test('provider failures arriving after Vault lock expose neither credential nor raw error cause/stack and retain HTTP status',async()=>{
 const secrets=setup(),originalFetch=globalThis.fetch;let arrived,release;const received=new Promise(resolve=>{arrived=resolve}),pending=new Promise(resolve=>{release=resolve});
 globalThis.fetch=async()=>{arrived();await pending;const e=new Error(JSON.stringify({approved:false,message:secrets.current,other:secrets.other,password:secrets.password}));e.status=403;e.cause=new Error(secrets.other);throw e};
 try{
  const c=saveConnection({kind:'openai',name:'Synthetic error provider',model:'synthetic-model',secret:secrets.current});const result=ask(c.id,{prompt:'Synthetic error contract'}).then(()=>null,e=>e);await received;lockVault();release();const error=await result;assert.equal(error instanceof Error,true);noSecrets(error.message,secrets);noSecrets(error.stack,secrets);assert.equal(error.cause,undefined,'Raw upstream cause is not exposed');assert.equal(error.status,403,'Authorization failure status is retained');assert.equal(parseProtocol(error.message).approved,false);
 }finally{release();globalThis.fetch=originalFetch;lockVault()}
});

test('short legacy fixture credentials do not corrupt JSON paths or unrelated source words',async()=>{
 const secrets=setup();secrets.current='x';const output={approved:false,tool:'write_file',path:'index.html',content:'export const index = 2;',credential:'x'};const f=await fixture(()=>JSON.stringify(output),secrets);
 try{const c=connection('openai',f.base,secrets),reply=await ask(c.id,{prompt:'Synthetic legacy contract'}),parsed=parseProtocol(reply);assert.equal(parsed.approved,false);assert.equal(parsed.tool,'write_file');assert.equal(parsed.path,'index.html');assert.equal(parsed.content,'export const index = 2;');assert.equal(parsed.credential,'[redacted]');}finally{await f.close();lockVault()}
});
