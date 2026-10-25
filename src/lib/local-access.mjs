/**
 * A short-lived local browser session. The server binds to loopback only, but
 * loopback is shared across processes (and on Windows sometimes users).
 * Browser API access therefore also requires a random HttpOnly cookie.
 * The launcher uses an unguessable one-use URL ticket to obtain the cookie;
 * the URL is immediately removed from browser history via a redirect.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.mjs';
import { APP_ID, SESSION_COOKIE } from './app-identity.mjs';

const COOKIE=SESSION_COOKIE;
const SESSION_DIR=path.join(path.dirname(DATA_DIR),'run');
function safeEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;
  return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
function ticketFile(port){return path.join(SESSION_DIR,`session-${port}.json`);}
export function createLocalAccess({port,version,launchToken=process.env.AI_PROJECT_OS_LAUNCH_TOKEN}={}){
  if(!Number.isSafeInteger(port)||port<=0)throw new Error('Local access port must be valid.');
  let ticket=typeof launchToken==='string'&&/^[0-9a-f]{64}$/.test(launchToken)?launchToken:crypto.randomBytes(32).toString('hex');
  const cookieValue=crypto.randomBytes(32).toString('hex');
  const file=ticketFile(port);
  let alive=false;
  const expose=()=>{
    fs.mkdirSync(SESSION_DIR,{recursive:true,mode:0o700});
    fs.writeFileSync(file,JSON.stringify({productId:APP_ID,pid:process.pid,port,version,token:ticket}),{mode:0o600});
    alive=true;
  };
  const discard=()=>{
    if(!alive)return;
    try {const json=JSON.parse(fs.readFileSync(file,'utf8'));if(json.pid===process.pid&&safeEqual(json.token,ticket))fs.rmSync(file,{force:true});}catch{}
    alive=false;
  };
  // One use per URL. Rotate the ticket stored for the local launcher after
  // granting access, so copying an old browser URL cannot authorize a new tab.
  // The launcher can still re-open the app using the fresh local ticket file.
  const validTicket=value=>{
    if(!safeEqual(value,ticket))return false;
    const next=crypto.randomBytes(32).toString('hex');
    if(alive){
      const tmp=file+'.'+crypto.randomBytes(8).toString('hex')+'.tmp';
      try{
        fs.writeFileSync(tmp,JSON.stringify({productId:APP_ID,pid:process.pid,port,version,token:next}),{mode:0o600});
        fs.renameSync(tmp,file);
      }catch{
        try{fs.rmSync(tmp,{force:true});}catch{}
        // If the next one-use ticket cannot be persisted, don't grant access.
        return false;
      }
    }
    ticket=next;
    return true;
  };
  const validSession=req=>{
    const cookies=String(req?.headers?.cookie||'').split(';').map(x=>x.trim()).filter(Boolean);
    for(const c of cookies){const i=c.indexOf('=');if(i>0&&c.slice(0,i)===COOKIE&&safeEqual(c.slice(i+1),cookieValue))return true;}
    return false;
  };
  function grant(res){
    res.writeHead(303,{
      location:'/',
      'set-cookie':`${COOKIE}=${cookieValue}; Path=/; HttpOnly; SameSite=Strict`,
      'cache-control':'no-store','referrer-policy':'no-referrer',
      'x-content-type-options':'nosniff',
      'content-security-policy':"default-src 'none'; frame-ancestors 'none'"
    });res.end();
  }
  return {expose,discard,validTicket,validSession,grant,port,version};
}
export function readLocalSessionTicket({port,version}={}) {
  try {
    const j=JSON.parse(fs.readFileSync(ticketFile(port),'utf8'));
    return j.productId===APP_ID&&j.port===port&&j.version===version&&Number.isInteger(j.pid)&&j.pid>0&&/^[0-9a-f]{64}$/.test(j.token)?j.token:null;
  }catch{return null;}
}
