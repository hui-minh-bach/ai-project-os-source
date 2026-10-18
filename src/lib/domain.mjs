import { getConnection } from './vault.mjs';
import { run } from './shell.mjs';
import { resolveInfraCli } from './infra-tools.mjs';

export async function attachVercelDomain({connectionId,deploymentUrl,domain}){
  const c=getConnection(connectionId);if(c.kind!=='vercel')throw new Error('Chọn Vercel connection.');
  const vc=resolveInfraCli('vercel');
  const d=String(domain||'').trim().toLowerCase();if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(d))throw new Error('Tên miền không hợp lệ.');
  const url=String(deploymentUrl||'').trim();if(!/^https:\/\//.test(url))throw new Error('Cần URL deployment Vercel https://...');
  const args=['alias','set',url,d];const env={};
  if(c.meta?.authMode!=='cli'){if(!c.secret)throw new Error('Thiếu Vercel token.');env.VERCEL_TOKEN=c.secret;}
  const r=await run(vc.command,[...vc.args,...args],{timeoutMs:60000,inheritEnv:false,env});if(r.code!==0)throw new Error((r.stderr||r.stdout).slice(-5000));return {ok:true,domain:d,output:r.stdout};
}
