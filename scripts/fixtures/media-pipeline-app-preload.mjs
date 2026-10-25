/** TEST ONLY: actual app with controlled external/OS boundaries. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {register,createRequire} from 'node:module';
if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('Isolated fixture required');
register('./windows-media-test-loader.mjs',import.meta.url);
await import('./reception-app-preload.mjs');
const {saveConnection,getConnection}=await import('../../src/lib/vault.mjs');const {recordModels}=await import('../../src/lib/model-bindings.mjs');
const {storyConcatFixture}=await import('../../test/helpers/concat-story-fixture.mjs');const fixture=await storyConcatFixture();
process.env.CONCAT_API_TOKEN=fixture.settings.token;process.env.CONCAT_API_PORT=String(fixture.settings.port);
const root=process.env.AI_PROJECT_OS_DATA_DIR,require=createRequire(import.meta.url),{createPng}=require('../../integrations/media-engine/src/images.cjs');
const picture=path.join(root,'qa-illustration.png');createPng(picture,{width:640,height:360,seed:'Controlled image fixture NOT a live AI image'});const b64=fs.readFileSync(picture).toString('base64');
for(const [id,name,kind,model] of [['artist-a','Artist A quota-failure fixture','openai','gpt-image-1'],['artist-b','Artist B image fixture','gemini','gemini-fixture-image']]){saveConnection({id,name,kind,model,secret:'fixture-'+id});recordModels(getConnection(id),[model]);}
const prev=globalThis.fetch;const attempts=[];
globalThis.fetch=async(url,opts={})=>{const u=new URL(typeof url==='string'?url:url.url||url.href);
 if(u.hostname==='api.openai.com'&&u.pathname.endsWith('/images/generations')){attempts.push({account:'artist-a',status:429});return Response.json({error:{code:'rate_limit_exceeded'}},{status:429});}
 if(u.hostname==='generativelanguage.googleapis.com'&&u.pathname.includes('image')){attempts.push({account:'artist-b',status:200});return Response.json({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:b64}}]}}]});}
 return prev(url,opts);
};
const save=()=>{fs.writeFileSync(path.join(root,'qa-media-evidence.json'),JSON.stringify({imageAttempts:attempts,concatMethods:fixture.calls.map(q=>q.method),concatExports:fixture.exports,concatProjects:fixture.created,concatFailures:fixture.failures},null,2));};const timer=setInterval(save,500);timer.unref();process.on('SIGTERM',()=>{save();clearInterval(timer);fixture.close();});
