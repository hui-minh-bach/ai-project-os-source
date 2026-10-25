/** CLI protocol fixtures only: validates real image bytes/transport, not live account access. */
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import zlib from 'node:zlib';import {execFileSync} from 'node:child_process';
import {AccountRpc,startAccountLogin,refreshAccount,listAccountModels,generateAccountImage,accountImageCapability,closeAccountSessions} from '../src/lib/account-auth.mjs';import {lockVault,unlockVault,getConnection} from '../src/lib/vault.mjs';import {DATA_DIR} from '../src/lib/store.mjs';import {crc32} from '../src/lib/updater.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'image-rpc073-'));
function png(){const w=1400,h=900,header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=2;const rows=Buffer.alloc((w*3+1)*h);for(let i=0;i<h;i++)crypto.randomFillSync(rows,i*(w*3+1)+1,w*3);function chunk(t,b){const name=Buffer.from(t),r=Buffer.alloc(b.length+12);r.writeUInt32BE(b.length);name.copy(r,4);b.copy(r,8);r.writeUInt32BE(crc32(Buffer.concat([name,b])),r.length-4);return r;}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}
const image=path.join(root,'large.png');fs.writeFileSync(image,png());
const fixture=`#!${process.execPath}
const fs=require('fs'),path=require('path'),rl=require('readline');const b=fs.readFileSync(${JSON.stringify(image)}),models=new Map();let count=0;const emit=x=>process.stdout.write(JSON.stringify(x)+'\\n');
rl.createInterface({input:process.stdin}).on('line',line=>{const q=JSON.parse(line);if(q.id===undefined)return;let result={};switch(q.method){
case 'initialize':result={userAgent:'codex/0.162.1'};break;
case 'account/login/start':result={loginId:'l',authUrl:'https://auth.openai.com/authorize'};setTimeout(()=>emit({method:'account/login/completed',params:{loginId:'l',success:true}}),5);break;
case 'account/read':result={account:{type:'chatgpt',email:'fixture@example.invalid',planType:'fixture'}};break;
case 'model/list':result={data:['inline','history','relative'].map(model=>({model})),nextCursor:null};break;
case 'config/read':result={config:{mcp_servers:{}}};break;
case 'modelProvider/capabilities/read':result={imageGeneration:!fs.existsSync(path.join(process.env.CODEX_HOME,'no-image')),webSearch:false};break;
case 'thread/start':{const id='thread-'+(++count);models.set(id,q.params.model);result={thread:{id,cliVersion:'0.162.1'},model:q.params.model,modelProvider:'openai'};break;}
case 'turn/start':{const threadId=q.params.threadId,model=models.get(threadId);result={turn:{id:'turn-'+count,status:'inProgress'}};setTimeout(()=>{const item={id:'img',type:'imageGeneration',status:'completed',result:model==='relative'?'':b.toString('base64'),failure:null};if(model==='relative'){fs.writeFileSync(path.join(process.cwd(),'generated.png'),b);item.savedPath='generated.png';}if(model!=='history')emit({method:'item/completed',params:{threadId,item}});emit({method:'turn/completed',params:{threadId,turn:{id:'turn-'+count,status:'completed',items:model==='history'?[item]:[]}}});},5);break;}
case 'thread/unsubscribe':break;
case 'oversized-text':emit({method:'item/completed',params:{threadId:'t',item:{type:'agentMessage',text:'x'.repeat(2100000)}}});break;
default:emit({id:q.id,error:{code:-32601,message:'PRIVATE_TOKEN_DO_NOT_EXPOSE'}});return;
}emit({id:q.id,result});});`;
fs.writeFileSync(path.join(root,'codex'),fixture,{mode:0o755});
test('real >2MB PNG survives image RPC, turn-only results and relative savedPath; capability checks do not infer text login',async t=>{
 assert.ok(fs.statSync(image).size>2_000_000);
 lockVault();for(const name of ['vault.enc.json','model-registry.json'])for(const ext of ['','.bak'])fs.rmSync(path.join(DATA_DIR,name+ext),{force:true});unlockVault('image-protocol-test-password');const old=process.env.PATH;process.env.PATH=root+path.delimiter+old;
 try{
 const login=await startAccountLogin({name:'Image fixture'});await new Promise(r=>setTimeout(r,30));await refreshAccount(login.id);await listAccountModels(login.id);
 for(const model of ['inline','history','relative']){const c={...getConnection(login.id),model},output=path.join(root,model+'.png');assert.equal((await accountImageCapability(c)).available,true);const got=await generateAccountImage(c,{prompt:'Transport fixture',outputPath:output});assert.equal(got.bytes,fs.statSync(image).size);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(got.file)).digest('hex'),crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex'));execFileSync('ffmpeg',['-v','error','-xerror','-i',got.file,'-f','null','-'],{timeout:20000});}
 fs.writeFileSync(path.join(DATA_DIR,'account-profiles',login.id,'no-image'),'fixture');assert.equal((await accountImageCapability(getConnection(login.id),{refresh:true})).available,false);
 }finally{closeAccountSessions();lockVault();process.env.PATH=old;}
});
test('RPC errors retain safe typed reason; large non-image frames still rejected even in image mode',async()=>{
 const rpc=new AccountRpc({command:process.execPath,args:[path.join(root,'codex')],cwd:root,env:process.env});try{await assert.rejects(rpc.request('unsupported'),e=>e.code==='CODEX_RPC_METHOD'&&!e.message.includes('PRIVATE_TOKEN'));rpc.imageThreads.add('t');await assert.rejects(rpc.request('oversized-text'),/không phải ảnh|session|đóng/);}finally{rpc.close();}
});
test.after(()=>fs.rmSync(root,{recursive:true,force:true}));
