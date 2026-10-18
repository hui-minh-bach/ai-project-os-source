'use strict';
const http=require('node:http'),crypto=require('node:crypto');
const {fail,cleanError}=require('./common.cjs');
const {createCore}=require('./core.cjs');
function createServer({core,token,port=39879}){if(typeof token!=='string'||token.length<32)throw fail('AUTH_CONFIG','Set KBL_CORE_HTTP_TOKEN (32+ characters)');if(!Number.isInteger(port)||port<0||port>65535||(port>0&&port<1024))throw fail('PORT','Invalid port');const expected=crypto.createHash('sha256').update(token).digest();
 const server=http.createServer(async(req,res)=>{const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};try{if(req.headers.origin)throw fail('ORIGIN_DENIED','Browser-originated requests are not accepted; use an approved server-side proxy');if(req.socket.remoteAddress!=='127.0.0.1'&&req.socket.remoteAddress!=='::1'&&req.socket.remoteAddress!=='::ffff:127.0.0.1')throw fail('AUTH','Loopback only');const raw=String(req.headers.authorization||'');const secret=raw.startsWith('Bearer ')?raw.slice(7):'';const digest=crypto.createHash('sha256').update(secret).digest();if(!secret||!crypto.timingSafeEqual(digest,expected))return send(401,{error:'Unauthorized'});
 const u=new URL(req.url,'http://127.0.0.1');if(!u.pathname.startsWith('/v1/'))return send(404,{error:'Unknown API'});const route=u.pathname.split('/').filter(Boolean);if(req.method==='GET'){
  if(u.pathname==='/v1/health')return send(200,{protocol:'CoreServices v1',status:'running',liveModelVerified:(core.state.data.usage?.verifiedModelCalls||0)>0});
  if(u.pathname==='/v1/tasks')return send(200,{tasks:core.state.list()});
  if(route.length===4&&route[1]==='projects'&&route[3]==='map')return send(200,{map:core.agents.projectMap(route[2])});
  if(u.pathname==='/v1/events')return send(200,{events:core.state.events.items.slice(-100)});
  if(u.pathname==='/v1/tools')return send(200,{tools:core.tools.list()});
  if(u.pathname==='/v1/skills')return send(200,{skills:core.state.data.skills.map(({instructions,...s})=>s)});
  if(u.pathname==='/v1/providers')return send(200,{providers:core.state.data.providers,roles:core.state.data.roles,costUsd:core.providers.spendUsd,budgetUsd:core.providers.budgetUsd});
  if(route.length===4&&route[1]==='providers'&&route[3]==='models')return send(200,{models:await core.providers.listModels(route[2])});
  if(route.length===3&&route[1]==='artifacts')return send(200,{artifact:core.artifacts.get(route[2])});
  return send(404,{error:'Unknown API'});
 }
 if(req.method!=='POST')return send(405,{error:'Method not allowed'});let bytes=0,chunks=[];for await(const x of req){bytes+=x.length;if(bytes>128000)throw fail('INPUT_LIMIT','Request too large');chunks.push(x);}let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw fail('JSON','Body must be JSON');}
 if(u.pathname==='/v1/tasks')return send(201,{task:core.queue.add(body)});
 if(u.pathname==='/v1/projects/plan')return send(201,{plan:await core.agents.plan(body)});
 if(route.length===4&&route[1]==='tasks'&&route[3]==='approve')return send(200,{task:core.queue.approve(route[2],body.allowedTools)});
 if(route.length===4&&route[1]==='tasks'){const id=route[2],cmd=route[3];if(!['pause','resume','cancel','retry'].includes(cmd))return send(404,{error:'Unknown action'});return send(200,{task:core.queue[cmd](id)});}
 if(u.pathname==='/v1/roles')return send(200,{role:core.providers.assign(body.role,body.modelRef)});
 if(u.pathname==='/v1/providers')return send(201,{provider:core.providers.register(body)});
 if(u.pathname==='/v1/budget')return send(200,{budgetUsd:core.providers.setBudget(body.usd)});
 if(u.pathname==='/v1/skills')return send(201,{skill:core.skills.add(body)});
 if(route.length===4&&route[1]==='skills'&&route[3]==='enable')return send(200,{skill:core.skills.enable(route[2],body.enabled)});
 return send(404,{error:'Unknown API'});
 }catch(e){const x=cleanError(e);send(['AUTH'].includes(e.code)?403:422,{error:x});}});
 return {listen:()=>new Promise((resolve,reject)=>server.once('error',reject).listen(port,'127.0.0.1',resolve)),close:()=>new Promise(resolve=>server.close(resolve)),server};}
function createStandaloneCore({root,master,concurrency=2,fetchImpl}={}){const core=createCore({root,concurrency,fetchImpl});try{core.createVault({master});return core;}catch(e){core.close();throw e;}}
function startStandalone(){const path=require('node:path');const root=process.env.KBL_CORE_DATA_DIR||path.join(__dirname,'..','..','work','ai-core-v1');const core=createStandaloneCore({root,master:process.env.KBL_CORE_MASTER_KEY,concurrency:Math.min(4,Math.max(1,Number(process.env.KBL_CORE_WORKERS||2)))});const api=createServer({core,token:process.env.KBL_CORE_HTTP_TOKEN||''});api.listen().then(()=>{console.log('CoreServices v1 listening on 127.0.0.1:39879 (authorization required)');const clock=setInterval(()=>core.queue.tick().catch(e=>console.error('core tick:',cleanError(e).code)),250);const shutdown=async()=>{clearInterval(clock);await api.close();core.close();process.exit(0);};process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);}).catch(e=>{console.error(cleanError(e));core.close();process.exitCode=1;});}
if(require.main===module)startStandalone();
module.exports={createServer,createStandaloneCore};
