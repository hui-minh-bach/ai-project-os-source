/** One-button delivery: bounded, immutable source snapshots and local handoff files.
 * No shell, network or credentials are used by this module.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {deflateRawSync} from 'node:zlib';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const QRCode=require('../vendor/qrcode/index.js');
const QRLevel=require('../vendor/qrcode/QRErrorCorrectLevel.js');
export const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
export function launchError(code,message){return Object.assign(new Error(message),{code});}
const ident=s=>typeof s==='string'&&/^[a-z][a-z0-9_]{0,47}$/.test(s);
const own=(x,k)=>Object.hasOwn(x,k);
function strict(x,keys,label){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!keys.includes(k)))throw launchError('LAUNCH_MANIFEST',label+': invalid or unsupported fields.');}
export function normalizeManifest(raw,{databaseAllowed=false}={}){
 strict(raw,['version','kind','framework','supabase','smokePaths'],'Delivery manifest');
 if(raw.version!==1||raw.kind!=='web'||!['static','vite','nextjs'].includes(raw.framework))throw launchError('LAUNCH_MANIFEST','Supported delivery: web, version 1, static / vite / nextjs.');
 const sb=raw.supabase??{enabled:false};strict(sb,['enabled','tables','buckets'],'Supabase');
 if(typeof sb.enabled!=='boolean'||(sb.enabled&&!databaseAllowed))throw launchError('LAUNCH_DB_SCOPE','Database use was not authorized.');
 const tables=sb.tables??[],buckets=sb.buckets??[];
 if(!Array.isArray(tables)||tables.length>12||!Array.isArray(buckets)||buckets.length>4||(!sb.enabled&&(tables.length||buckets.length)))throw launchError('LAUNCH_MANIFEST','Too many tables/buckets or disabled database has resources.');
 const ts=tables.map(t=>{strict(t,['name','columns'],'Table');if(!ident(t.name)||!Array.isArray(t.columns)||t.columns.length>24)throw launchError('LAUNCH_MANIFEST','Invalid table.');
  const columns=t.columns.map(c=>{strict(c,['name','type','required'],'Column');if(!ident(c.name)||['id','user_id','created_at'].includes(c.name)||!['text','boolean','integer','numeric','jsonb','timestamptz'].includes(c.type)||(own(c,'required')&&typeof c.required!=='boolean'))throw launchError('LAUNCH_MANIFEST','Invalid column/type.');return {name:c.name,type:c.type,required:c.required===true};});
  if(new Set(columns.map(c=>c.name)).size!==columns.length)throw launchError('LAUNCH_MANIFEST','Duplicate column.');return {name:t.name,columns};});
 const bs=buckets.map(b=>{strict(b,['name','maxBytes','mimeTypes'],'Bucket');if(!ident(b.name)||!Number.isInteger(b.maxBytes)||b.maxBytes<1||b.maxBytes>20*1024*1024||!Array.isArray(b.mimeTypes)||!b.mimeTypes.length||b.mimeTypes.length>12||b.mimeTypes.some(m=>!['image/jpeg','image/png','image/webp','application/pdf','text/plain','video/mp4','audio/mpeg','audio/wav'].includes(m)))throw launchError('LAUNCH_MANIFEST','Bucket must be private with a supported MIME/size restriction.');return {name:b.name,maxBytes:b.maxBytes,mimeTypes:[...new Set(b.mimeTypes)]};});
 if(new Set(ts.map(t=>t.name)).size!==ts.length||new Set(bs.map(b=>b.name)).size!==bs.length)throw launchError('LAUNCH_MANIFEST','Duplicate resource names.');
 const smoke=raw.smokePaths??['/'];if(!Array.isArray(smoke)||!smoke.length||smoke.length>5||smoke.some(s=>typeof s!=='string'||!/^\/(?:[a-zA-Z0-9_./-]*)$/.test(s)||s.startsWith('//')||s.includes('..')))throw launchError('LAUNCH_MANIFEST','Invalid smoke paths.');
 return {version:1,kind:'web',framework:raw.framework,supabase:{enabled:sb.enabled,tables:ts,buckets:bs},smokePaths:[...new Set(['/',...smoke])]};
}
const ignored=new Set(['.git','node_modules','.next','dist','build','coverage','.turbo','.cache','.data','backups','evidence','.project-state','.vercel']);
const forbidden=/(^|\/)(?:\.env(?:\..*)?|\.npmrc|\.pypirc|\.ssh|\.aws|credentials[^/]*|vault[^/]*|service[-_]?account[^/]*)(?:\/|$)|\.(?:pem|p12|pfx|key|sqlite3?|db|dump|bak|log)$/i;
const suspicious=/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsb_secret_[A-Za-z0-9_-]{12,}|\bsbp_[A-Za-z0-9]{20,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}|\bAKIA[A-Z0-9]{16}\b)/;
export function collectSource(root,{redact=x=>x,maxFiles=500,maxBytes=24*1024*1024,maxFileBytes=5*1024*1024,skipPrivate=false}={}){
 const base=fs.realpathSync(root),files=[],excludedFiles=[];let bytes=0;
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
  if(ignored.has(e.name))continue;const full=path.join(dir,e.name),rel=path.relative(base,full).replaceAll('\\','/');
  if(e.isSymbolicLink())throw launchError('LAUNCH_SOURCE_UNSAFE','Symlink not allowed in deployment: '+rel);
  if(skipPrivate&&forbidden.test(rel)&&!/(^|\/)\.env\.example$/.test(rel)){excludedFiles.push(rel);continue;}
  if(forbidden.test(rel)&&!/(^|\/)\.env\.example$/.test(rel))throw launchError('LAUNCH_SOURCE_SECRET','Remove private file from deployable source: '+rel);
  if(e.isDirectory()){walk(full);continue;}if(!e.isFile())throw launchError('LAUNCH_SOURCE_UNSAFE','Non-regular source file.');
  const size=fs.statSync(full).size;if(size>maxFileBytes||bytes+size>maxBytes||files.length>=maxFiles)throw launchError('LAUNCH_SOURCE_SIZE',`Source exceeds limit: ${maxFiles} files, ${(maxBytes/1048576).toFixed(0)} MiB total, ${(maxFileBytes/1048576).toFixed(0)} MiB/file.`);
  const data=fs.readFileSync(full);if(data.length!==size)throw launchError('LAUNCH_SOURCE_CHANGED','Source changed while reading.');
  // Scan text, including encoded tokens which would otherwise bypass simple patterns.
  if(!data.subarray(0,4096).includes(0)){
   const text=data.toString('utf8');if(suspicious.test(text)||String(redact(text))!==text)throw launchError('LAUNCH_SOURCE_SECRET','Possible credential in '+rel+'; source not uploaded.');
   for(const m of text.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)){try{if(JSON.parse(Buffer.from(m[0].split('.')[1],'base64url')).role==='service_role')throw launchError('LAUNCH_SOURCE_SECRET','Privileged JWT in '+rel);}catch(err){if(err.code)throw err;}}
  }
  bytes+=data.length;files.push({file:rel,data:data.toString('base64'),encoding:'base64',sha256:digest(data),size:data.length});
 }}walk(base);if(!files.length)throw launchError('LAUNCH_SOURCE_EMPTY','No deployable source.');
 const hash=digest(JSON.stringify(files.map(({file,sha256,size})=>({file,sha256,size}))));return {hash,bytes,count:files.length,files,excludedFiles};
}
export function manifestFromSource(source,opts){
 const f=source.files.find(f=>f.file==='aios.delivery.json');if(!f)throw launchError('LAUNCH_MANIFEST','Worker must produce aios.delivery.json before cloud delivery.');
 try{return normalizeManifest(JSON.parse(Buffer.from(f.data,'base64')),opts);}catch(e){if(e.code)throw e;throw launchError('LAUNCH_MANIFEST','Invalid JSON in aios.delivery.json.');}
}
function addText(files,file,text){const data=Buffer.from(text);return [...files.filter(f=>f.file!==file),{file,data:data.toString('base64'),encoding:'base64',size:data.length,sha256:digest(data)}];}
export function deploymentFiles(source,manifest,run,publicConfig){
 let files=source.files;
 if(manifest.framework==='static')files=files.filter(f=>!/(^|\/)(?:test|tests|__tests__|scripts|docs|node_modules|\.[^/]+)(?:\/|$)|(?:\.test|\.spec)\.|^(?:package(?:-lock)?\.json|aios\.delivery\.json|yarn\.lock|pnpm-lock\.yaml)$/i.test(f.file)&&/\.(?:html|css|js|mjs|json|png|jpe?g|webp|svg|ico|woff2?|ttf|mp4|webm|txt)$/i.test(f.file));
 const prefix=manifest.framework==='static'?'':'public/';
 files=addText(files,prefix+'.well-known/aios-release.json',JSON.stringify({runId:run.id,sourceHash:source.hash}));
 if(manifest.framework==='static'&&publicConfig)files=addText(files,'aios-public-config.js','window.AIOS_PUBLIC_CONFIG = '+JSON.stringify(publicConfig)+';\n');
 return files.map(({file,data,encoding})=>({file,data,encoding}));
}
export function schemaSql(manifest,runId){
 if(!/^[a-zA-Z0-9-]{1,90}$/.test(runId))throw launchError('LAUNCH_ID','Invalid run ID.');
 const hash=digest(JSON.stringify(manifest.supabase));
 const lines=['begin;','create schema if not exists aios_private;','revoke all on schema aios_private from public, anon, authenticated;', 'create table if not exists aios_private.delivery_migrations (run_id text primary key, sha256 text not null, applied_at timestamptz not null default now());',`do $$ begin if exists (select 1 from aios_private.delivery_migrations where run_id='${runId}' and sha256<>'${hash}') then raise exception 'Migration fingerprint mismatch'; end if; end $$;`];
 for(const t of manifest.supabase.tables){const name='public."'+t.name+'"';
  lines.push(`create table if not exists ${name} (id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now()${t.columns.map(c=>`, "${c.name}" ${c.type}${c.required?' not null':''}`).join('')});`, `alter table ${name} enable row level security;`,`revoke all on table ${name} from anon, authenticated;`,`grant select,insert,update,delete on table ${name} to authenticated;`,`create index if not exists "${t.name}_owner_idx" on ${name}(user_id);`);
  for(const [act,condition] of [['select','using'],['delete','using'],['insert','with check'],['update','using']]){lines.push(`drop policy if exists "aios_owner_${act}" on ${name};`,`create policy "aios_owner_${act}" on ${name} for ${act} to authenticated ${condition} ((select auth.uid()) = user_id)${act==='update'?' with check ((select auth.uid()) = user_id)':''};`);}
 }
 for(const b of manifest.supabase.buckets){for(const act of ['select','insert','update','delete']){const check=`bucket_id = '${b.name}' and (storage.foldername(name))[1] = (select auth.uid())::text`;lines.push(`drop policy if exists "aios_${b.name}_${act}" on storage.objects;`,`create policy "aios_${b.name}_${act}" on storage.objects for ${act} to authenticated ${act==='insert'?'with check':'using'} (${check})${act==='update'?` with check (${check})`:''};`);}}
 lines.push(`insert into aios_private.delivery_migrations (run_id,sha256) values ('${runId}','${hash}') on conflict (run_id) do nothing;`,'commit;');return {sql:lines.join('\n'),hash};
}
const CRC_TABLE=Array.from({length:256},(_,i)=>{let x=i;for(let k=0;k<8;k++)x=(x&1)?0xedb88320^(x>>>1):x>>>1;return x>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
/** Standards-compliant ZIP (stored entries), dependency-free on Windows. */
export function sourceZip(files,{compress=false}={}){
 const entries=[],central=[];let offset=0;
 for(const f of files){const name=Buffer.from(f.file),data=Buffer.from(f.data,'base64');if(name.length>4096||f.file.startsWith('/')||f.file.split('/').includes('..'))throw launchError('LAUNCH_ZIP','Invalid ZIP entry.');
  const compressed=compress?deflateRawSync(data,{level:6}):data,method=compress&&compressed.length<data.length?8:0,payload=method===8?compressed:data;
  const crc=crc32(data),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt16LE(method,8);h.writeUInt32LE(payload.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);entries.push(h,name,payload);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt16LE(method,10);c.writeUInt32LE(payload.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=h.length+name.length+payload.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...entries,cd,end]);
}
export function qrSvg(value){
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||value.length>500)throw launchError('LAUNCH_QR','QR only accepts a plain HTTPS delivery URL without tokens.');
 const qr=new QRCode(-1,QRLevel.M);qr.addData(u.href);qr.make();const n=qr.getModuleCount(),m=4,cells=[];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x))cells.push(`M${x+m},${y+m}h1v1h-1z`);
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n+8} ${n+8}" width="${(n+8)*8}" height="${(n+8)*8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${cells.join('')}" fill="black"/></svg>`;
}
