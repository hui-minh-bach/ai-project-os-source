import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';

const ROOT=path.resolve(import.meta.dirname,'..');
async function port(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const n=s.address().port;s.close();await once(s,'close');return n;}

test('real launcher provides an ephemeral browser session; direct local URL is denied',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-launch-test-'));
  const p=await port(),dataDir=path.join(dir,'data');
  const child=spawn(process.execPath,['src/launcher.mjs'],{cwd:ROOT,
    env:{...process.env,AI_PROJECT_OS_PORT:String(p),AI_PROJECT_OS_DATA_DIR:dataDir},
    stdio:'ignore'});
  let log='';
  try{
    let ready=false;
    for(let i=0;i<80;i++){
      if(child.exitCode!==null)throw Error('Launcher exited: '+log);
      try{const r=await fetch(`http://127.0.0.1:${p}/api/health`);if(r.ok&&(await r.json()).version==='0.9.30'){ready=true;break;}}
      catch{}
      await sleep(120);
    }
    assert.equal(ready,true,log);
    let r=await fetch(`http://127.0.0.1:${p}/api/projects`);assert.equal(r.status,401);
    const ticketPath=path.join(dir,'run',`session-${p}.json`);
    for(let i=0;i<20&&!fs.existsSync(ticketPath);i++)await sleep(100);
    assert.equal(fs.existsSync(ticketPath),true);
    const ticket=JSON.parse(fs.readFileSync(ticketPath,'utf8'));
    assert.match(ticket.token,/^[0-9a-f]{64}$/);
    r=await fetch(`http://127.0.0.1:${p}/?launch=${ticket.token}`,{redirect:'manual'});
    assert.equal(r.status,303);const cookie=r.headers.get('set-cookie')?.split(';')[0];
    assert.match(cookie||'',/^aios_session=/);
    const reused=await fetch(`http://127.0.0.1:${p}/?launch=${ticket.token}`,{redirect:'manual'});
    assert.equal(reused.status,403,'Previously redeemed URL ticket must be rejected');
    const rotated=JSON.parse(fs.readFileSync(ticketPath,'utf8'));
    assert.notEqual(rotated.token,ticket.token,'Launcher ticket rotates on every grant');
    const reopener=await fetch(`http://127.0.0.1:${p}/?launch=${rotated.token}`,{redirect:'manual'});
    assert.equal(reopener.status,303,'Launcher can reopen with the fresh ticket');
    r=await fetch(`http://127.0.0.1:${p}/api/projects`,{headers:{Cookie:cookie}});assert.equal(r.status,200);
    r=await fetch(`http://127.0.0.1:${p}/api/projects`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Launch session project',idea:'Testing local launch'})});assert.equal(r.status,200);
    const created=await r.json();assert.equal(created.name,'Launch session project');
  }finally{
    if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([once(child,'exit'),sleep(3500)]);}
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
