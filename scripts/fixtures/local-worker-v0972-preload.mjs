/** TEST ONLY: fake AI + image HTTP. Piper/ONNX/FFmpeg are NOT replaced.
 * Never loaded by RUN-WINDOWS. Requires an isolated temporary data directory. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import crypto from 'node:crypto';import {createRequire} from 'node:module';
if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('Local worker QA requires disposable temp data');
const root=process.env.AI_PROJECT_OS_DATA_DIR;fs.mkdirSync(path.join(root,'free-stack'),{recursive:true});
const graph={'1':{class_type:'CLIPTextEncode',inputs:{text:'__AIOS_PROMPT__'}},'2':{class_type:'SaveImage',inputs:{images:['8',0]}}};
fs.writeFileSync(path.join(root,'free-stack/comfyui-image-api.json'),JSON.stringify(graph));
const require=createRequire(import.meta.url),{createPng}=require('../../integrations/media-engine/src/images.cjs');const png=path.join(root,'qa-image.png');createPng(png,{width:960,height:540,seed:'Synthetic illustration fixture: not AI-generated photo'});
const prompts=new Map();let imageCalls=0,scriptCalls=0,reviewCalls=0;
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('content-type','application/json');
 if(u.pathname==='/system_stats')return res.end(JSON.stringify({devices:[{name:'LOCAL IMAGE PROTOCOL FIXTURE',type:'fixture'}]}));
 if(u.pathname==='/prompt'){let raw='';for await(const b of req)raw+=b;const id=crypto.randomUUID();prompts.set(id,JSON.parse(raw));imageCalls++;return res.end(JSON.stringify({prompt_id:id}));}
 if(u.pathname.startsWith('/history/')){const id=u.pathname.split('/').pop();return res.end(JSON.stringify(prompts.has(id)?{[id]:{outputs:{'2':{images:[{filename:'qa-image.png',subfolder:'',type:'output'}]}},status:{completed:true,status_str:'success'}}}:{}));}
 if(u.pathname==='/view'){res.setHeader('content-type','image/png');return res.end(fs.readFileSync(png));}res.writeHead(404);res.end('{}');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.AIOS_COMFYUI_URL='http://127.0.0.1:'+server.address().port;
await import('./reception-app-preload.mjs');
const downstream=globalThis.fetch;globalThis.fetch=(url,options)=>{try{const s=String(options?.body||'');if(s.includes('CLIENT_VIDEO_SCRIPT_V1'))scriptCalls++;if(s.includes('CLIENT_CONTENT_REVIEW_V1')||s.includes('MEDIA_TEXT_REVIEW_V1'))reviewCalls++;}catch{}return downstream(url,options);};
const record=()=>{try{fs.writeFileSync(path.join(root,'qa-local-stats.json'),JSON.stringify({imageCalls,scriptCalls,reviewCalls,voiceEngine:'real Piper ONNX; no Windows or speech fixture'}));}catch{}};
const timer=setInterval(record,100);timer.unref();process.on('SIGTERM',()=>{record();clearInterval(timer);server.closeAllConnections();server.close();});
