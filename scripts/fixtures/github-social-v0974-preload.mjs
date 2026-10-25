/** TEST ONLY. Real local Git/app; fake CLI account, AI and social endpoints. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('Disposable fixture only');
await import('./reception-app-preload.mjs');
const data=process.env.AI_PROJECT_OS_DATA_DIR,root=path.resolve(data,'..'),bin=path.join(root,'bin');fs.mkdirSync(bin,{recursive:true});
const git=(args,opts={})=>execFileSync('git',args,{stdio:'ignore',...opts});
const bare=path.join(root,'remote/octo/demo.git'),seed=path.join(root,'seed');fs.mkdirSync(path.dirname(bare),{recursive:true});git(['init','--bare','-b','main',bare]);git(['clone',bare,seed]);
fs.writeFileSync(path.join(seed,'README.md'),'# Imported project\n- [ ] Repair the existing counter\n');fs.writeFileSync(path.join(seed,'app.txt'),'real imported baseline\n');git(['-C',seed,'add','-A']);git(['-C',seed,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','Baseline']);git(['-C',seed,'push','origin','main']);
const gate=path.join(root,'release-auth'),stub=path.resolve('test/fixtures/gh-stub.mjs'),entry=path.join(bin,'gh-entry.mjs');
fs.writeFileSync(entry,`import fs from 'node:fs';if(process.argv[2]==='auth'&&process.argv[3]==='token'){while(!fs.existsSync(${JSON.stringify(gate)}))await new Promise(r=>setTimeout(r,100));}await import(${JSON.stringify('file://'+stub)});`);
fs.writeFileSync(path.join(bin,'gh'),'#!/bin/sh\nexec '+JSON.stringify(process.execPath)+' '+JSON.stringify(entry)+' "$@"\n',{mode:0o755});process.env.PATH=bin+path.delimiter+process.env.PATH;process.env.AIOS_GITHUB_CLONE_BASE=path.join(root,'remote');
const {saveConnection}=await import('../../src/lib/vault.mjs');saveConnection({kind:'github',name:'GitHub fixture only',meta:{authMode:'cli',login:'octo',verifiedAt:new Date().toISOString()}});
const priorFetch=globalThis.fetch,calls=[];globalThis.fetch=async(u,o={})=>{const url=new URL(typeof u==='string'?u:u.url||u.href);if(['graph.threads.net','api.x.com','openapi.zalo.me'].includes(url.hostname)){
 const body=o.body?JSON.parse(o.body):null;calls.push({host:url.hostname,path:url.pathname,method:o.method||'GET',body:body?.token?{token:'OPERATION-TOKEN-REDACTED'}:body});fs.writeFileSync(path.join(data,'qa-social-calls.json'),JSON.stringify(calls));
 let result;if(url.pathname.endsWith('/me'))result=url.hostname==='api.x.com'?{data:{id:'11',username:'TestX'}}:{id:'12',username:'TestThreads'};
 else if(url.pathname.endsWith('/getoa'))result={error:0,data:{oaid:'13',name:'Test OA'}};
 else if(url.pathname.endsWith('/threads'))result={id:'container'};
 else if(url.pathname.endsWith('/threads_publish'))result={id:'post-threads'};
 else if(url.pathname.endsWith('/tweets'))result={data:{id:'post-x'}};
 else if(url.pathname.endsWith('/create'))result={error:0,data:{token:'test-operation'}};
 else if(url.pathname.endsWith('/verify'))result={error:0,data:{id:'post-zalo'}};
 else throw Error('Unexpected fixture route');return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}});
 }return priorFetch(u,o);};
