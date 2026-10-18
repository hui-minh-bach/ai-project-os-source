import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const concat=require('../integrations/media-engine/src/concat.cjs');

function stub(){
 let source='';const methods=[];
 const server=net.createServer(socket=>{let buf='';socket.on('data',chunk=>{buf+=chunk.toString('utf8');let i;
  while((i=buf.indexOf('\n'))>=0){const msg=JSON.parse(buf.slice(0,i));buf=buf.slice(i+1);methods.push(msg.method);
   const reply=result=>socket.write(JSON.stringify({jsonrpc:'2.0',id:msg.id,result})+'\n');
   if(msg.method==='auth'){if(msg.params.token!=='correct-token')socket.end(JSON.stringify({jsonrpc:'2.0',id:0,error:{message:'unauthorized'}})+'\n');else reply({});}
   else if(msg.method==='version')reply({apiVersion:'0.2',concat:'0.2.7',capabilities:['events']});
   else if(msg.method==='project.create'){fs.mkdirSync(path.join(msg.params.location,msg.params.name),{recursive:true});reply({project:{}});}
   else if(msg.method==='media.import'){source=msg.params.file;reply({createdId:'m1'});}
   else if(msg.method==='edit.apply')reply({createdId:'c1'});
   else if(msg.method==='project.save')reply({});
   else if(msg.method==='export.run'){fs.copyFileSync(source,msg.params.output);reply({job:'j1'});setImmediate(()=>socket.write(JSON.stringify({jsonrpc:'2.0',method:'export.done',params:{job:'j1',output:msg.params.output}})+'\n'));}
   else reply({});
  }
 });});
 return {server,methods};
}

test('Concat 0.2 compatibility works with published capabilities [events] and local authenticated RPC',async()=>{
 const {server,methods}=stub();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const settings={host:'127.0.0.1',port:server.address().port,token:'correct-token'};
 try{
  const v=await concat.probe(settings);assert.equal(v.apiVersion,'0.2');
  await assert.rejects(()=>concat.probe({...settings,token:'wrong-secret'}),/authentication refused/i);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'concat-bridge-'));
  try{
   const source=path.join(dir,'final.mp4');fs.writeFileSync(source,Buffer.alloc(2000,48));
   const result=await concat.createProjectFromVideo({settings,workspace:dir,source,jobId:'approved_job_1'});
   assert.equal(result.engine,'concat-external-api');assert.ok(fs.existsSync(result.exported));
   assert.deepEqual(methods.slice(-6),['auth','version','project.create','media.import','edit.apply','project.save','export.run'].slice(-6));
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 }finally{await new Promise(resolve=>server.close(resolve))}
});

test('Concat blocks off-machine hosts, absent tokens and files outside workspace',async()=>{
 await assert.rejects(()=>concat.probe({host:'192.168.1.1',token:'x'}),e=>e.code==='FORBIDDEN_NETWORK');
 await assert.rejects(()=>concat.probe({host:'127.0.0.1',token:''}),e=>e.code==='BLOCKED_AUTH');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'concat-deny-'));
 try{await assert.rejects(()=>concat.createProjectFromVideo({settings:{token:'x'},workspace:dir,source:import.meta.filename,jobId:'1'}),e=>e.code==='FORBIDDEN_PATH')}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
