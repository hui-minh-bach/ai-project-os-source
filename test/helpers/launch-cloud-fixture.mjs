/** Synthetic provider contracts, not a live provider/account. Shared by fault tests. */
import crypto from 'node:crypto';
import {schemaSql,digest} from '../../src/lib/launch-artifacts.mjs';
export function cloudFixture(){
 const calls=[],uploads=new Map(),buckets=new Map(),credentials={v:{id:'v',kind:'vercel',secret:'vercel-fixture-not-a-live-token',credentialVersion:'v1'},s:{id:'s',kind:'supabase',secret:'supabase-fixture-not-a-live-token',credentialVersion:'s1'}};
 const f={calls,uploads,buckets,credentials,db:null,project:null,deployment:null,schemaHash:null,env:[],saved:[],lost:null,deny:null,protected:false,corruptMarker:false,readyState:'READY',databaseState:'ACTIVE_HEALTHY'};
 const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}}),miss=()=>json({error:'not found'},404);
 f.getConnection=id=>{if(!credentials[id])throw new Error('Missing fixture connection');return credentials[id];};f.saveConnection=c=>{f.saved.push(c);return c;};
 f.fetch=async(url,init={})=>{const u=new URL(url),p=u.pathname,method=init.method||'GET',body=Buffer.isBuffer(init.body)?init.body:init.body?JSON.parse(init.body):null;calls.push({url:u.href,method,body,headers:init.headers});
  if(f.deny&&p===f.deny.path){const status=f.deny.status;f.deny=null;return json({error:'fixture denied'},status);}
  function lose(key){if(f.lost===key){f.lost=null;throw new Error('fixture lost response');}}
  if(u.hostname==='api.vercel.com'){
   if(p==='/v2/user')return json({user:{id:'owner1',name:'Fixture account'}});
   if(p==='/v2/teams')return json({teams:[{id:'team1',name:'Fixture team'}]});
   if(/^\/v9\/projects\//.test(p)&&method==='GET')return f.project?json(f.project):miss();
   if(p==='/v10/projects'&&method==='POST'){f.project={id:'prj_fixture',name:body.name,accountId:u.searchParams.get('teamId')||'owner1'};lose('vercel-create');return json(f.project);}
   if(p.endsWith('/env')){f.env=body;return json({created:body.map(x=>({key:x.key}))});}
   if(p==='/v2/files'){const sha=crypto.createHash('sha1').update(body).digest('hex');if(sha!==init.headers['x-vercel-digest'])return json({error:'bad digest'},400);uploads.set(sha,body);return new Response('',{status:200});}
   if(p==='/v13/deployments'&&method==='POST'){for(const x of body.files)if(!uploads.has(x.sha))return json({error:'missing file'},400);f.deployment={id:'dpl_fixture',projectId:body.project,meta:body.meta,readyState:f.readyState,url:'fixture.vercel.app',files:body.files};lose('deployment');return json(f.deployment);}
   if(p==='/v6/deployments')return json({deployments:f.deployment?[f.deployment]:[]});
   if(p==='/v13/deployments/dpl_fixture'){f.deployment.readyState=f.readyState;return json(f.deployment);}
  }
  if(u.hostname==='api.supabase.com'){
   if(p==='/v1/organizations')return json([{id:'org-id',slug:'org-slug',name:'Fixture org'}]);
   if(p==='/v1/projects'&&method==='GET')return json(f.db?[f.db]:[]);
   if(p==='/v1/projects'&&method==='POST'){if(f.lost==='db-before'){f.lost=null;throw new Error('request lost without a visible project');}f.db={id:'abcdefghijklmnopqrst',ref:'abcdefghijklmnopqrst',name:body.name,organization_slug:body.organization_slug,organization_id:'org-id',status:f.databaseState};lose('db-create');return json(f.db,201);}
   if(p==='/v1/projects/abcdefghijklmnopqrst'&&method==='GET'){f.db.status=f.databaseState;return json(f.db);}
   if(p.endsWith('/api-keys'))return json([{type:'publishable',api_key:'sb_publishable_fixture'}, {type:'secret',api_key:'sb_secret_fixture_not_for_browser'}]);
   if(p.endsWith('/database/query')){if(body.query.startsWith('begin;')){f.schemaHash=body.query.match(/values \('[^']+','([a-f0-9]{64})'\)/)[1];f.sql=body.query;return json([]);}return json([{sha256:f.schemaHash}]);}
   if(p.endsWith('/config/auth')){f.auth=body;return json(body);}
  }
  if(u.hostname==='abcdefghijklmnopqrst.supabase.co'){
   if(p==='/storage/v1/bucket'&&method==='POST'){if(buckets.has(body.id))return json({},409);buckets.set(body.id,body);return json({name:body.id});}
   if(p.startsWith('/storage/v1/bucket/'))return buckets.has(p.split('/').at(-1))?json(buckets.get(p.split('/').at(-1))):miss();
  }
  if(u.hostname==='fixture.vercel.app'){
   if(f.protected)return new Response('Protected',{status:401});
   if(f.redirect)return new Response('',{status:307,headers:{location:f.redirect}});
   const x=f.deployment.files.find(x=>'/'+x.file===p||p==='/'&&x.file==='index.html');if(!x)return miss();let bytes=uploads.get(x.sha);if(p.includes('aios-release')&&f.corruptMarker)bytes=Buffer.from('{}');
   return new Response(bytes,{headers:{'content-type':p.endsWith('.json')?'application/json':'text/html'}});
  }
  throw new Error('Unexpected fixture request: '+method+' '+url);
 };
 f.context=({framework='static',database=true}={})=>{
  const sourceFiles=[{file:'index.html',data:Buffer.from('<html><h1>Fixture only</h1></html>').toString('base64'),encoding:'base64'}];
  const run={id:'run-11111111-2222-4333-8444-555555555555',config:{vercelConnectionId:'v',teamId:'team1',database,supabaseConnectionId:'s',organizationSlug:'org-slug',region:'ap-southeast-1',target:'preview'},identities:{vercel:'v1',...(database?{supabase:'s1'}:{})},ownerId:'team1',organizationId:'org-id',manifest:{version:1,kind:'web',framework,supabase:{enabled:database,tables:database?[{name:'notes',columns:[{name:'title',type:'text',required:true}]}]:[],buckets:database?[{name:'images',maxBytes:5000,mimeTypes:['image/png']}]:[]},smokePaths:['/']},resources:{},intents:{},source:{hash:digest('fixture source')}};
  return {run,save(){f.saves=(f.saves||0)+1;},guard(){if(f.stopped)throw new Error('stopped');},source:()=>({hash:run.source.hash,files:sourceFiles})};
 };
 return f;
}
