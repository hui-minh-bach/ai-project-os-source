import crypto from 'node:crypto';
import { getConnection, saveConnection } from './vault.mjs';
import { run } from './shell.mjs';
import { resolveInfraCli } from './infra-tools.mjs';

function headers(token){return {authorization:`Bearer ${token}`,'content-type':'application/json'};}
export function generateDbPassword(){return crypto.randomBytes(24).toString('base64url')+'aA9!';}

async function request(url,init={},timeoutMs=45000){
  const c=new AbortController();const timer=setTimeout(()=>c.abort(),timeoutMs);
  try{const r=await fetch(url,{...init,signal:c.signal});let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.message||j.error||`Supabase ${r.status}`);return j;}finally{clearTimeout(timer);}
}

export async function listSupabaseProjects(connectionId){
  const c=getConnection(connectionId);
  if(c.kind!=='supabase')throw new Error('Hãy chọn kết nối Supabase.');
  if(c.meta?.authMode==='cli'){
    const sb=resolveInfraCli('supabase');
    const r=await run(sb.command,[...sb.args,'projects','list','--output','json'],{timeoutMs:30000,inheritEnv:false});if(r.code!==0)throw new Error((r.stderr||r.stdout).slice(-3000));
    try{return JSON.parse(r.stdout);}catch{return {raw:r.stdout};}
  }
  if(!c.secret)throw new Error('Supabase Management PAT chưa có.');
  return request('https://api.supabase.com/v1/projects',{headers:headers(c.secret)});
}

export async function createSupabaseProject({connectionId,name,organizationId,region='ap-southeast-1',dbPassword}){
  const c=getConnection(connectionId);if(c.kind!=='supabase')throw new Error('Hãy chọn Supabase Management connection.');
  const password=String(dbPassword||generateDbPassword());if(password.length<12)throw new Error('DB password nên ≥ 12 ký tự.');
  if(c.meta?.authMode==='cli'){
    const sb=resolveInfraCli('supabase');
    const args=['projects','create',String(name||'ai-project'),'--db-password',password];if(organizationId)args.push('--org-id',String(organizationId));if(region)args.push('--region',String(region));
    const r=await run(sb.command,[...sb.args,...args],{timeoutMs:180000,inheritEnv:false});if(r.code!==0)throw new Error((r.stderr||r.stdout).slice(-5000));return {ok:true,output:r.stdout,passwordGenerated:!dbPassword};
  }
  if(!c.secret)throw new Error('Thiếu Supabase PAT.');if(!organizationId)throw new Error('Cần Organization ID.');
  const body={name:String(name||'ai-project').slice(0,80),organization_id:String(organizationId),region:String(region||'ap-southeast-1'),plan:'free',db_pass:password};
  const j=await request('https://api.supabase.com/v1/projects',{method:'POST',headers:headers(c.secret),body:JSON.stringify(body)},90000);
  return {ok:true,project:j,passwordGenerated:!dbPassword,dbPassword:password};
}

function keyList(keys){return Array.isArray(keys)?keys:(keys?.api_keys||keys?.keys||[]);}
function publicKeyFrom(keys){const list=keyList(keys);return list.find(x=>x.type==='publishable')||list.find(x=>x.name==='publishable')||list.find(x=>x.name==='anon')||list.find(x=>x.type==='anon');}

export async function attachSupabaseProject({managementConnectionId,ref,name}){
  const c=getConnection(managementConnectionId);if(c.kind!=='supabase')throw new Error('Cần Supabase Management/CLI connection.');
  const projectRef=String(ref||'').trim();if(!/^[a-z0-9_-]{4,80}$/i.test(projectRef))throw new Error('Supabase project ref không hợp lệ.');
  let keys;
  if(c.meta?.authMode==='cli'){
    const sb=resolveInfraCli('supabase');
    const r=await run(sb.command,[...sb.args,'projects','api-keys','--project-ref',projectRef,'--output','json'],{timeoutMs:30000,inheritEnv:false});
    if(r.code!==0)throw new Error('Không đọc được API keys qua Supabase CLI. Hãy cập nhật CLI hoặc dùng Management PAT. '+(r.stderr||r.stdout).slice(-1600));
    try{keys=JSON.parse(r.stdout);}catch{throw new Error('Supabase CLI không trả JSON API keys. Hãy dùng Management PAT để gắn project.');}
  }else{
    if(!c.secret)throw new Error('Cần Supabase Management PAT để đọc API keys.');
    keys=await request(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/api-keys?reveal=true`,{headers:headers(c.secret)});
  }
  const pub=publicKeyFrom(keys);const value=pub?.api_key||pub?.key||pub?.value;
  if(!value)throw new Error('Không tìm thấy publishable/anon key. Quyền tài khoản hoặc phiên bản CLI có thể chưa hỗ trợ đọc key này.');
  return saveConnection({kind:'supabase',name:name||`Supabase Project · ${projectRef}`,baseUrl:`https://${projectRef}.supabase.co`,secret:value,meta:{authMode:'project-key',ref:projectRef,management:false,keyType:pub?.type||pub?.name||'publishable'}});
}
