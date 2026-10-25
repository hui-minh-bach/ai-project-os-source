import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {resolvePiperEnvironment} from '../src/lib/piper-paths.mjs';
import {piperStatus,clearPiperStatus} from '../src/lib/local-piper-tts.mjs';
import {createIntegrationHost} from '../src/lib/integration-host.mjs';
function setup(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-recovery-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
function installed(root,name='piper-2023.11.14-2'){
 const dir=path.join(root,'local-voice',name),cli=path.join(dir,'piper',process.platform==='win32'?'piper.exe':'piper'),model=path.join(dir,'vi_VN-test-medium.onnx'),config=model+'.json';fs.mkdirSync(path.dirname(cli),{recursive:true});fs.writeFileSync(cli,'#!/usr/bin/env node\nif(process.argv.includes("--help"))process.exit(0);process.exit(3);\n',{mode:0o755});fs.writeFileSync(model,'Fixture model, not actual speech');fs.writeFileSync(config,JSON.stringify({espeak:{voice:'vi'}}));return {cli,model,config};
}
test('managed Vietnamese voice already installed is rediscovered without local-voice.json or redownload',t=>{
 const dataDir=setup(t),appRoot=path.join(dataDir,'app'),files=installed(dataDir);
 const result=resolvePiperEnvironment({}, {dataDir,appRoot,includeSaved:true});assert.equal(result.PIPER_CLI_PATH,files.cli);assert.equal(result.AIOS_PIPER_SOURCE,'managed-install');assert.equal(fs.existsSync(path.join(dataDir,'local-voice.json')),false);
 assert.equal(piperStatus(result).ready,true);
});
test('stale saved file paths do not hide a complete managed installation',t=>{
 const dataDir=setup(t),files=installed(dataDir);fs.writeFileSync(path.join(dataDir,'local-voice.json'),JSON.stringify({schema:1,cli:'/missing/piper',model:'/missing/v.onnx',config:'/missing/v.onnx.json'}));
 const result=resolvePiperEnvironment({}, {dataDir,appRoot:dataDir,includeSaved:true});assert.equal(result.PIPER_MODEL_PATH,files.model);
});
test('legacy app data voice survives upgrade to the per-user data directory',t=>{
 const root=setup(t),dataDir=path.join(root,'user-data'),appRoot=path.join(root,'app'),files=installed(path.join(appRoot,'.data'));
 const result=resolvePiperEnvironment({}, {dataDir,appRoot,includeSaved:true});assert.equal(result.PIPER_CONFIG_PATH,files.config);assert.equal(result.AIOS_PIPER_SOURCE,'legacy-install');
});
test('partial download directories and foreign-language models never become Vietnamese-ready',t=>{
 const dataDir=setup(t);installed(dataDir,'piper-2023.11.14-2-abcd.staging');const files=installed(dataDir);fs.writeFileSync(files.config,JSON.stringify({espeak:{voice:'en-us'}}));
 const env=resolvePiperEnvironment({}, {dataDir,appRoot:dataDir,includeSaved:true});assert.equal(env.PIPER_MODEL_PATH,undefined);
 const status=piperStatus({PIPER_CLI_PATH:files.cli,PIPER_MODEL_PATH:files.model,PIPER_CONFIG_PATH:files.config});assert.equal(status.ready,false);assert.equal(status.reason,'voice-language-not-vietnamese');
});
test('explicit environment and isolated test hosts cannot inherit owner installed voice',t=>{
 const dataDir=setup(t);installed(dataDir);const explicit={PIPER_CLI_PATH:'/owner-chosen/piper',PIPER_MODEL_PATH:'/owner-chosen/voice.onnx'};
 assert.deepEqual(resolvePiperEnvironment(explicit,{dataDir,appRoot:dataDir,includeSaved:true}),explicit);
 assert.deepEqual(resolvePiperEnvironment({}, {dataDir,appRoot:dataDir}),{});
});
test('install/removal/config change invalidates an earlier readiness result without waiting 30 seconds',t=>{
 const root=setup(t);const env={PIPER_CLI_PATH:path.join(root,'engine','piper'),PIPER_MODEL_PATH:path.join(root,'voice.onnx')};clearPiperStatus();assert.equal(piperStatus(env).ready,false);
 fs.mkdirSync(path.dirname(env.PIPER_CLI_PATH));fs.writeFileSync(env.PIPER_CLI_PATH,'#!/usr/bin/env node\nprocess.exit(0)\n',{mode:0o755});fs.writeFileSync(env.PIPER_MODEL_PATH,'test model');assert.equal(piperStatus(env).ready,true);
 fs.writeFileSync(env.PIPER_MODEL_PATH+'.json','{"espeak":{"voice":"en-us"}}');assert.equal(piperStatus(env).ready,false);fs.writeFileSync(env.PIPER_MODEL_PATH+'.json','{"espeak":{"voice":"vi"}}');assert.equal(piperStatus(env).ready,true);
 fs.rmSync(env.PIPER_MODEL_PATH);assert.equal(piperStatus(env).ready,false);
});
test('default production preparation uses an installed Piper; explicit Windows choice never silently changes',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'voice-prepare-')),files=installed(root),host=createIntegrationHost({root,clock:false,env:{PIPER_CLI_PATH:files.cli,PIPER_MODEL_PATH:files.model,PIPER_CONFIG_PATH:files.config},systemSpeech:{status:()=>({ready:false,voices:[],reason:'not-installed'}),synthesize:()=>{throw Error('Do not invoke Windows');}}});t.after(()=>{host.stop();fs.rmSync(root,{recursive:true,force:true});});
 const input={renderEngine:'ffmpeg'};await host.prepareProduction(input);assert.equal(input.ttsProvider,'local');
 await assert.rejects(host.prepareProduction({ttsProvider:'windows'}),{code:'BLOCKED_WINDOWS_TTS'});
 const refreshed=host.refreshProductionStatus();assert.equal(refreshed.media.localTts.ready,true);assert.equal(refreshed.media.ttsProvider,'piper-local');
});

test('reception retries the existing failed run instead of returning its cached failure as a new start',async t=>{
 const {unlockVault,saveConnection,getConnection}=await import('../src/lib/vault.mjs');
 const {createProject,attachProductionRequest,updateProjectModelRoles}=await import('../src/lib/projects.mjs');
 const {recordModels}=await import('../src/lib/model-bindings.mjs');const {createWorkBackend}=await import('../src/lib/work-center-backend.mjs');
 unlockVault('local-fixture-recovery-password');
 for(const [id,model] of [['recovery-worker','fixture-worker'],['recovery-reviewer','fixture-reviewer']]){saveConnection({id,kind:'openai_compatible',name:id,secret:'fixture-secret-not-live',baseUrl:'http://127.0.0.1:9999',model});recordModels(getConnection(id),[model]);}
 const p=createProject({name:'Retry contract fixture',idea:'Test an existing failed request',productType:'website'});
 updateProjectModelRoles(p.id,{founder:{connectionId:'recovery-worker',model:'fixture-worker'},worker:{connectionId:'recovery-worker',model:'fixture-worker'},reviewer:{connectionId:'recovery-reviewer',model:'fixture-reviewer'}});
 const project=attachProductionRequest(p.id,{pipeline:'client-video',title:'Fixture order',ideaText:'Dịch vụ ảnh trang sức theo thông tin khách cung cấp, liên hệ nhận báo giá.'});
 let starts=0,retries=0,refreshes=0;const old={id:'existing-run',projectId:p.id,requestId:project.productionRequest.id,pipeline:'client-video',state:'failed'};
 const host={refreshProductionStatus(){refreshes++;},status:()=>({media:{status:'available',ffmpeg:true,ffprobe:true,localTts:{ready:true},images:{available:true,routes:['comfyui-local'],candidates:[{paid:false}]}}}),prepareProduction:async()=>{}};
 const orchestrator={listRuns:()=>[old],getConfig:()=>({pipelines:{'client-video':{aiMode:'gateway'}}}),startRun:async()=>{starts++;return old;},retryRun:async id=>{assert.equal(id,old.id);retries++;return {...old,state:'awaiting-approval'};},receiveRun:id=>({id,state:'completed'})};
 const backend=createWorkBackend({host,orchestrator,delivery:{isActive:()=>false}}),input={requestId:project.productionRequest.id,fromReception:true};
 await backend.validate(p.id,'auto-produce',input);const result=await backend.execute(p.id,'auto-produce',input);
 assert.equal(refreshes,1);assert.equal(retries,1);assert.equal(starts,0);assert.equal(result.runId,old.id);assert.equal(result.state,'completed');assert.equal(result.published,false);
});
