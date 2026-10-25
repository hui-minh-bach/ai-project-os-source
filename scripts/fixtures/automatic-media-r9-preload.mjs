/** R9 TEST BOUNDARY ONLY: genuine app flows against controlled local ComfyUI,
 * Concat RPC and OS speech fakes. Never import through Windows launcher. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import crypto from 'node:crypto';
import {register,createRequire} from 'node:module';
if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('R9 fixture only accepts temp isolated data');
register('./windows-media-test-loader.mjs',import.meta.url);
const root=process.env.AI_PROJECT_OS_DATA_DIR;
fs.mkdirSync(path.join(root,'free-stack'),{recursive:true});
const graph={"1":{class_type:'CLIPTextEncode',inputs:{text:'__AIOS_PROMPT__',clip:['4',0]}},"2":{class_type:'SaveImage',inputs:{filename_prefix:'AIOS',images:['8',0]}}};
fs.writeFileSync(path.join(root,'free-stack','comfyui-image-api.json'),JSON.stringify(graph));
const require=createRequire(import.meta.url),{createPng}=require('../../integrations/media-engine/src/images.cjs');
const pic=path.join(root,'mock-free-image.png');createPng(pic,{width:640,height:360,seed:'LOCAL COMFY TEST IMAGE only, not AI visual'});
const all=new Map(),attempts=[];
const comfy=http.createServer(async(req,res)=>{
 const target=new URL(req.url,'http://localhost');res.setHeader('content-type','application/json');
 if(target.pathname==='/system_stats'){res.end(JSON.stringify({devices:[{name:'FIXTURE-DONT-CLAIM-GPU',type:'test-only'}]}));return;}
 if(target.pathname==='/prompt'&&req.method==='POST'){
  let raw='';for await(const b of req)raw+=b;const payload=JSON.parse(raw);const id=crypto.randomUUID();all.set(id,payload);attempts.push({id,workflowNodeCount:Object.keys(payload.prompt||{}).length});res.end(JSON.stringify({prompt_id:id}));return;
 }
 if(target.pathname.startsWith('/history/')){
  const id=target.pathname.slice('/history/'.length);res.end(JSON.stringify(all.has(id)?{[id]:{outputs:{'2':{images:[{filename:'mock-free-image.png',subfolder:'',type:'output'}]}},status:{status_str:'success',completed:true}}}:{ }));return;
 }
 if(target.pathname==='/view'){
  res.setHeader('content-type','image/png');res.end(fs.readFileSync(pic));return;
 }
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>comfy.listen(0,'127.0.0.1',r));
process.env.AIOS_COMFYUI_URL='http://127.0.0.1:'+comfy.address().port;
await import('./reception-app-preload.mjs');
const {storyConcatFixture}=await import('../../test/helpers/concat-story-fixture.mjs');
const concat=await storyConcatFixture();
process.env.CONCAT_API_TOKEN=concat.settings.token;
process.env.CONCAT_API_PORT=String(concat.settings.port);
const evidence=()=>{try{fs.writeFileSync(path.join(root,'qa-r9-media.json'),JSON.stringify({comfyRequests:attempts,concatCalls:concat.calls.map(c=>c.method),concatExports:concat.exports,concatProjects:concat.created,concatFailures:concat.failures,voiceFixture:'eSpeak OS boundary not Windows'},null,2));}catch{}};
const timer=setInterval(evidence,400);timer.unref();
process.on('SIGTERM',()=>{evidence();clearInterval(timer);comfy.closeAllConnections();comfy.close();concat.close();});
