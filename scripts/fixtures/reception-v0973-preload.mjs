/** TEST ONLY: local AI/image contract server; real app, actual HTTP/files/render. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import http from 'node:http';import crypto from 'node:crypto';import {register} from 'node:module';
if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('QA requires temp data');
register('./reception-v0973-loader.mjs',import.meta.url);const root=process.env.AI_PROJECT_OS_DATA_DIR;fs.mkdirSync(path.join(root,'free-stack'),{recursive:true});
fs.writeFileSync(path.join(root,'free-stack/comfyui-image-api.json'),JSON.stringify({'1':{class_type:'CLIPTextEncode',inputs:{text:'__AIOS_PROMPT__'}},'2':{class_type:'SaveImage',inputs:{images:['8',0]}}}));
let release=false,created=0;const asset=new URL('../../public/assets/idea-master-concept.png',import.meta.url);const requests=new Set();
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1');res.setHeader('content-type','application/json');
 if(u.pathname==='/__release'){release=true;return res.end('{}');}
 if(u.pathname==='/__status')return res.end(JSON.stringify({created,release}));
 if(u.pathname==='/system_stats')return res.end(JSON.stringify({devices:[{name:'IMAGE PROTOCOL FIXTURE',type:'fixture'}]}));
 if(u.pathname==='/prompt'){let input='';for await(const b of req)input+=b;created++;const id=crypto.randomUUID();requests.add(id);return res.end(JSON.stringify({prompt_id:id}));}
 if(u.pathname.startsWith('/history/')){const id=u.pathname.split('/').pop();return res.end(JSON.stringify(release&&requests.has(id)?{[id]:{outputs:{'2':{images:[{filename:'qa.png',subfolder:'',type:'output'}]}},status:{completed:true,status_str:'success'}}}:{}));}
 if(u.pathname==='/view'){res.setHeader('content-type','image/png');return res.end(fs.readFileSync(asset));}res.writeHead(404);res.end('{}');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));process.env.AIOS_COMFYUI_URL='http://127.0.0.1:'+server.address().port;fs.writeFileSync(path.join(root,'qa-image-base.json'),JSON.stringify({base:process.env.AIOS_COMFYUI_URL}));await import('./reception-app-preload.mjs');process.on('SIGTERM',()=>{server.closeAllConnections();server.close();});
