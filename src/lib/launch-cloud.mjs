/** Scoped cloud adapter. Receipts are persisted by ctx.save before the next effect.
 * Unknown create/deploy results are reconciled by exact name/meta, never blindly replayed.
 * Constructor injection is for tests; production hosts are fixed here, not user input.
 */
import crypto from 'node:crypto';
import {launchError, schemaSql, deploymentFiles, digest} from './launch-artifacts.mjs';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const enc=encodeURIComponent;
function assertRef(s){if(typeof s!=='string'||!/^[a-z0-9]{6,40}$/.test(s))throw launchError('LAUNCH_REF','Invalid Supabase reference.');return s;}
export function credentialFor(getConnection,id,kind){
 const c=getConnection(id);if(c.kind!==kind||!c.secret||c.meta?.authMode==='cli'||c.meta?.authMode==='project-key')throw launchError('LAUNCH_CREDENTIAL','One-button cloud delivery requires a '+kind+' management token stored in Vault, not a project public key or CLI-only login.');return c;
}
export function createCloudAdapter({getConnection,saveConnection,fetchImpl=globalThis.fetch,sleepFn=sleep,pollLimit=40,pollMs=4000}){
 async function request(url,{token,method='GET',body,rawBody,headers={},allow404=false}={}){
  let res;try{res=await fetchImpl(url,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(rawBody!==undefined?{body:rawBody}:body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(45000)});}catch(e){throw launchError(method==='GET'?'LAUNCH_NETWORK':'LAUNCH_OUTCOME_UNKNOWN','Cloud request interrupted. Reconcile the saved run; do not create another project.');}
  if(allow404&&res.status===404)return null;
  if(!res.ok){const err=launchError(res.status===401||res.status===403?'LAUNCH_PERMISSION':res.status===429?'LAUNCH_RATE_LIMIT':'LAUNCH_PROVIDER','Cloud HTTP '+res.status+' for '+new URL(url).hostname+new URL(url).pathname);err.httpStatus=res.status;throw err;}
  if(res.status===204)return {};
  const text=await res.text();if(text.length>3_000_000)throw launchError('LAUNCH_PROVIDER','Cloud reply too large.');
  try{return text?JSON.parse(text):{};}catch{throw launchError(method==='GET'?'LAUNCH_PROVIDER':'LAUNCH_OUTCOME_UNKNOWN','Cloud reply was not valid JSON. Reconcile before retrying.');}
 }
 function vercel(c,p,opts={}){const u=new URL('https://api.vercel.com'+p);if(c.teamId)u.searchParams.set('teamId',c.teamId);return request(u.href,{token:c.token,...opts});}
 function sb(c,p,opts={}){return request('https://api.supabase.com'+p,{token:c.token,...opts});}
 function auth(run){const v=credentialFor(getConnection,run.config.vercelConnectionId,'vercel'),s=run.config.database?credentialFor(getConnection,run.config.supabaseConnectionId,'supabase'):null;
  if(run.identities?.vercel&&v.credentialVersion!==run.identities.vercel)throw launchError('LAUNCH_IDENTITY_CHANGED','Vercel credential changed. Prepare a new approved run.');
  if(s&&run.identities?.supabase&&s.credentialVersion!==run.identities.supabase)throw launchError('LAUNCH_IDENTITY_CHANGED','Supabase credential changed. Prepare a new approved run.');
  return {v:{token:v.secret,teamId:run.config.teamId==='personal'?null:run.config.teamId},s:s?{token:s.secret}:null};
 }
 async function options({vercelConnectionId,supabaseConnectionId}={}){
  const out={vercel:[],supabase:[]};
  if(vercelConnectionId){const c=credentialFor(getConnection,vercelConnectionId,'vercel'),v={token:c.secret},user=await vercel(v,'/v2/user');if(user.user?.id)out.vercel.push({id:'personal',ownerId:user.user.id,name:user.user.name||user.user.username||'Personal'});
   let until;for(let page=0;page<20;page++){const data=await vercel(v,'/v2/teams?limit=100'+(until?'&until='+enc(until):''));out.vercel.push(...(data.teams||[]).map(t=>({id:t.id,ownerId:t.id,name:t.name||t.slug||t.id})));if(!data.pagination?.next)break;until=data.pagination.next;if(page===19)throw launchError('LAUNCH_PAGINATION','Too many teams; narrow connection scope.');}}
  if(supabaseConnectionId){const c=credentialFor(getConnection,supabaseConnectionId,'supabase'),orgs=await sb({token:c.secret},'/v1/organizations');if(!Array.isArray(orgs))throw launchError('LAUNCH_PROVIDER','Organization list invalid.');out.supabase=orgs.map(o=>({id:o.id,slug:o.slug||o.id,name:o.name||o.slug||o.id}));}return out;
 }
 async function preflight(run){const o=await options({vercelConnectionId:run.config.vercelConnectionId,...(run.config.database?{supabaseConnectionId:run.config.supabaseConnectionId}:{})});
  const v=o.vercel.find(x=>x.id===run.config.teamId),s=run.config.database?o.supabase.find(x=>x.slug===run.config.organizationSlug):null;
  if(!v||run.config.database&&!s)throw launchError('LAUNCH_SCOPE','Choose a discovered Vercel account/team and Supabase organization.');
  const vc=credentialFor(getConnection,run.config.vercelConnectionId,'vercel'),sc=run.config.database?credentialFor(getConnection,run.config.supabaseConnectionId,'supabase'):null;
  return {ownerId:v.ownerId,organizationId:s?.id||null,identities:{vercel:vc.credentialVersion,...(sc?{supabase:sc.credentialVersion}:{})},scope:{vercel:v.name,supabase:s?.name||null}};
 }
 function guard(ctx){ctx.guard();auth(ctx.run);}
 async function poll(ctx,fn,check,label){for(let i=0;i<pollLimit;i++){guard(ctx);const value=await fn();if(check(value))return value;await sleepFn(pollMs);}throw launchError('LAUNCH_PENDING',label+' is not ready yet. Resume this same run later.');}
 async function createEffect(ctx,key,fn){try{return await fn();}catch(e){if(e.httpStatus>=400&&e.httpStatus<500){delete ctx.run.intents[key];ctx.save();}throw e;}}
 function resourceName(run){return 'aios-'+run.id.replaceAll('-','').slice(-24);}
 async function ensureDatabase(ctx){const r=ctx.run;if(!r.manifest.supabase.enabled)return {skipped:true};const {s}=auth(r),name=resourceName(r);let ref=r.resources.supabaseRef;
  if(!ref){const list=await sb(s,'/v1/projects');if(!Array.isArray(list))throw launchError('LAUNCH_PROVIDER','Project list invalid.');const matches=list.filter(p=>p.name===name&&(p.organization_slug===r.config.organizationSlug||p.organization_id===r.organizationId));if(matches.length>1)throw launchError('LAUNCH_COLLISION','Duplicate named database projects; manual reconciliation required.');
   if(matches.length){if(!r.intents.database)throw launchError('LAUNCH_COLLISION','Resource name already exists and does not belong to this run.');ref=assertRef(matches[0].ref||matches[0].id);}
   else{if(r.intents.database)throw launchError('LAUNCH_OUTCOME_UNKNOWN','Database creation was already attempted. No matching project is visible yet; reconcile instead of creating a duplicate.');
    guard(ctx);const secretId='delivery-db-'+r.id,password=crypto.randomBytes(27).toString('base64url')+'aA9!';saveConnection({id:secretId,kind:'other',name:'Delivery database '+r.id,secret:password,meta:{keyType:'delivery_db_password'}});
    r.intents.database={at:new Date().toISOString(),name};ctx.save();const p=await createEffect(ctx,'database',()=>sb(s,'/v1/projects',{method:'POST',body:{name,organization_slug:r.config.organizationSlug,region:r.config.region,db_pass:password}}));ref=assertRef(p.ref||p.id);
   }r.resources.supabaseRef=ref;r.resources.supabaseName=name;ctx.save();}
  const p=await poll(ctx,()=>sb(s,'/v1/projects/'+enc(ref)),p=>{if(!(p.organization_slug===r.config.organizationSlug||p.organization_id===r.organizationId)||p.name!==name)throw launchError('LAUNCH_SCOPE','Database ownership/name differs from approved resource.');return p.status==='ACTIVE_HEALTHY';},'Supabase project');
  return {ref,status:p.status};
 }
 async function keys(run){const {s}=auth(run),ref=assertRef(run.resources.supabaseRef),all=await sb(s,'/v1/projects/'+enc(ref)+'/api-keys?reveal=true');const list=Array.isArray(all)?all:all.api_keys||all.keys||[];
  const key=x=>x?.api_key||x?.key||x?.value;const pub=list.find(k=>k.type==='publishable')||list.find(k=>k.name==='anon'),priv=list.find(k=>k.type==='secret')||list.find(k=>k.name==='service_role');if(!key(pub)||!key(priv))throw launchError('LAUNCH_PERMISSION','Supabase public/admin key not available for the new project.');return {url:'https://'+ref+'.supabase.co',publishableKey:key(pub),adminKey:key(priv)};
 }
 async function setupDatabase(ctx){const r=ctx.run;if(!r.manifest.supabase.enabled)return {skipped:true};const {s}=auth(r),ref=assertRef(r.resources.supabaseRef),schema=schemaSql(r.manifest,r.id);
  guard(ctx);
  // This generated schema is transactionally idempotent, additive and ONLY on this run's new isolated DB.
  await sb(s,'/v1/projects/'+enc(ref)+'/database/query',{method:'POST',body:{query:schema.sql}});
  guard(ctx);const result=await sb(s,'/v1/projects/'+enc(ref)+'/database/query',{method:'POST',body:{query:`select sha256 from aios_private.delivery_migrations where run_id='${r.id}';`}});if(!Array.isArray(result)||result[0]?.sha256!==schema.hash)throw launchError('LAUNCH_DATABASE_VERIFY','Schema transaction receipt was not found.');
  const k=await keys(r),headers={apikey:k.adminKey,...(k.adminKey.startsWith('eyJ')?{authorization:'Bearer '+k.adminKey}:{})};
  for(const b of r.manifest.supabase.buckets){guard(ctx);let current=await request(k.url+'/storage/v1/bucket/'+enc(b.name),{headers,allow404:true});if(!current){try{await request(k.url+'/storage/v1/bucket',{method:'POST',headers,body:{id:b.name,name:b.name,public:false,file_size_limit:b.maxBytes,allowed_mime_types:b.mimeTypes}});}catch(e){if(e.httpStatus!==409)throw e;}current=await request(k.url+'/storage/v1/bucket/'+enc(b.name),{headers});}
   if(current.public!==false||Number(current.file_size_limit)!==b.maxBytes||JSON.stringify([...(current.allowed_mime_types||[])].sort())!==JSON.stringify([...b.mimeTypes].sort()))throw launchError('LAUNCH_STORAGE_VERIFY','Storage settings differ from the private approved bucket policy.');
  }
  return {schemaHash:schema.hash,tables:r.manifest.supabase.tables.map(t=>t.name),buckets:r.manifest.supabase.buckets.map(b=>b.name),rls:'owner-only',crossUserRuntimeTest:'not_tested'};
 }
 async function ensureVercel(ctx){const r=ctx.run,{v}=auth(r),name=resourceName(r);let p;
  if(r.resources.vercelProjectId)p=await vercel(v,'/v9/projects/'+enc(r.resources.vercelProjectId));
  else{p=await vercel(v,'/v9/projects/'+enc(name),{allow404:true});if(p&&!r.intents.vercelProject)throw launchError('LAUNCH_COLLISION','Existing Vercel project is not owned by this run.');
   if(!p){if(r.intents.vercelProject)throw launchError('LAUNCH_OUTCOME_UNKNOWN','Vercel creation outcome unknown. Reconcile this run instead of creating again.');guard(ctx);r.intents.vercelProject={name,at:new Date().toISOString()};ctx.save();p=await createEffect(ctx,'vercelProject',()=>vercel(v,'/v10/projects',{method:'POST',body:{name,framework:r.manifest.framework==='static'?null:r.manifest.framework}}));}
   if(!p.id)throw launchError('LAUNCH_OUTCOME_UNKNOWN','Created project reply has no ID.');r.resources.vercelProjectId=p.id;ctx.save();}
  if(p.name!==name||p.accountId!==r.ownerId)throw launchError('LAUNCH_SCOPE','Vercel project is outside the approved account or changed name.');
  return {id:p.id,name:p.name};
 }
 async function setEnvironment(ctx){const r=ctx.run;if(!r.manifest.supabase.enabled)return {skipped:true};const {v}=auth(r),k=await keys(r);guard(ctx);
  // Neither service_role nor secret API keys are written to browser envs or source.
  const prefix=r.manifest.framework==='nextjs'?'NEXT_PUBLIC_':r.manifest.framework==='vite'?'VITE_':null;
  if(prefix){await vercel(v,'/v10/projects/'+enc(r.resources.vercelProjectId)+'/env?upsert=true',{method:'POST',body:[{key:prefix+'SUPABASE_URL',value:k.url,type:'encrypted',target:[r.config.target]},{key:prefix+'SUPABASE_PUBLISHABLE_KEY',value:k.publishableKey,type:'encrypted',target:[r.config.target]}]});}
  return {publicKeysOnly:true,names:prefix?[prefix+'SUPABASE_URL',prefix+'SUPABASE_PUBLISHABLE_KEY']:['window.AIOS_PUBLIC_CONFIG']};
 }
 async function deploy(ctx){const r=ctx.run,{v}=auth(r);let deployment;
  if(r.resources.deploymentId)deployment=await vercel(v,'/v13/deployments/'+enc(r.resources.deploymentId));
  else if(r.intents.deployment){let until,matches=[];for(let i=0;i<10;i++){const data=await vercel(v,'/v6/deployments?projectId='+enc(r.resources.vercelProjectId)+'&limit=100'+(until?'&until='+enc(until):''));matches.push(...(data.deployments||[]).filter(d=>d.meta?.aiosRunId===r.id&&d.meta?.aiosSourceHash===r.source.hash));if(!data.pagination?.next)break;until=data.pagination.next;}
   if(matches.length!==1)throw launchError('LAUNCH_OUTCOME_UNKNOWN','No unique deployment receipt found. Reconcile before repeating a build.');deployment=matches[0];r.resources.deploymentId=deployment.id||deployment.uid;ctx.save();
  }else{const k=r.manifest.supabase.enabled?await keys(r):null,files=deploymentFiles(ctx.source(),r.manifest,r,k?{supabaseUrl:k.url,supabasePublishableKey:k.publishableKey}:null);
   const uploaded=[];for(const f of files){guard(ctx);const bytes=Buffer.from(f.data,'base64'),sha=crypto.createHash('sha1').update(bytes).digest('hex');await vercel(v,'/v2/files',{method:'POST',rawBody:bytes,headers:{'content-type':'application/octet-stream','x-vercel-digest':sha,'content-length':String(bytes.length)}});uploaded.push({file:f.file,sha,size:bytes.length});}
   guard(ctx);r.intents.deployment={at:new Date().toISOString(),sourceHash:r.source.hash};ctx.save();deployment=await createEffect(ctx,'deployment',()=>vercel(v,'/v13/deployments',{method:'POST',body:{name:resourceName(r),project:r.resources.vercelProjectId,files:uploaded,meta:{aiosRunId:r.id,aiosSourceHash:r.source.hash},projectSettings:{framework:r.manifest.framework==='static'?null:r.manifest.framework},...(r.config.target==='production'?{target:'production'}:{})}}));
   const id=deployment.id||deployment.uid;if(!id)throw launchError('LAUNCH_OUTCOME_UNKNOWN','Deployment reply has no ID.');r.resources.deploymentId=id;ctx.save();}
  deployment=await poll(ctx,()=>vercel(v,'/v13/deployments/'+enc(r.resources.deploymentId)),d=>{if(d.projectId&&d.projectId!==r.resources.vercelProjectId)throw launchError('LAUNCH_SCOPE','Deployment belongs to another project.');if(d.meta?.aiosRunId!==r.id||d.meta?.aiosSourceHash!==r.source.hash)throw launchError('LAUNCH_SCOPE','Deployment receipt differs from the frozen source.');const state=d.readyState||d.state;if(['ERROR','CANCELED'].includes(state))throw launchError('LAUNCH_BUILD_FAILED','Vercel build '+state+'. Inspect build logs; do not publish.');return state==='READY';},'Vercel deployment');
  const u=new URL('https://'+String(deployment.url||''));if(!u.hostname.endsWith('.vercel.app')||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw launchError('LAUNCH_URL','Unexpected deployment URL.');r.resources.url=u.origin;ctx.save();return {id:r.resources.deploymentId,url:u.origin,state:'READY'};
 }
 async function configureAuth(ctx){const r=ctx.run;if(!r.manifest.supabase.enabled)return {skipped:true};const {s}=auth(r);guard(ctx);await sb(s,'/v1/projects/'+enc(assertRef(r.resources.supabaseRef))+'/config/auth',{method:'PATCH',body:{site_url:r.resources.url,uri_allow_list:r.resources.url+'/**'}});return {siteUrl:r.resources.url,externalEmailProvider:'not_configured'};}
 async function smoke(ctx){const r=ctx.run,origin=r.resources.url;const u=new URL(origin);if(u.protocol!=='https:'||!u.hostname.endsWith('.vercel.app')||u.port||u.username||u.password)throw launchError('LAUNCH_URL','Unsafe smoke URL.');
  async function get(relative){guard(ctx);let url=origin+relative;for(let i=0;i<4;i++){let res;try{res=await fetchImpl(url,{redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'cache-control':'no-cache'}});}catch{throw launchError('LAUNCH_NETWORK','Cannot verify deployment over HTTPS.');}
    if([301,302,303,307,308].includes(res.status)){const next=new URL(res.headers.get('location')||'',url);if(next.origin!==origin||next.username||next.password)throw launchError('LAUNCH_ACCESS','Deployment redirects to login or an unapproved host; not delivered as a public site.');url=next.href;continue;}
    if(!res.ok)throw launchError('LAUNCH_ACCESS','Deployment HTTP '+res.status+'. Check access protection; no QR handoff marked successful.');const text=await res.text();if(text.length>3_000_000)throw launchError('LAUNCH_VERIFY','Smoke response too large.');return {status:res.status,text,contentType:res.headers.get('content-type')||''};
   }throw launchError('LAUNCH_VERIFY','Redirect loop.');}
  const proof=await get('/.well-known/aios-release.json');let marker;try{marker=JSON.parse(proof.text);}catch{throw launchError('LAUNCH_VERIFY','Deployment did not serve the source identity receipt.');}if(marker.runId!==r.id||marker.sourceHash!==r.source.hash)throw launchError('LAUNCH_VERIFY','Live source identity does not match.');
  const checked=[];for(const p of r.manifest.smokePaths){const page=await get(p);if(!page.text.trim()||!page.contentType.includes('text/html'))throw launchError('LAUNCH_VERIFY','Expected an HTML app page for '+p);checked.push({path:p,status:page.status});}
  return {at:new Date().toISOString(),sourceHash:r.source.hash,https:true,paths:checked,coverage:'HTTP routes and deployed-source identity only; user flows require acceptance testing'};
 }
 return {options,preflight,assertIdentity:run=>{auth(run);},ensureDatabase,setupDatabase,ensureVercel,setEnvironment,deploy,configureAuth,smoke};
}
