import fs from 'node:fs';
import path from 'node:path';
import {DATA_DIR} from './store.mjs';
import {getConnection,saveConnection,listConnections,vaultStatus,redactVaultSecrets} from './vault.mjs';
import {getProject,updateProjectModelRoles,updateProjectSettings,acceptProjectWork,buildPlan,runReadyBatch,confirmCouncilSpecification,createTask,projectModelRoles} from './projects.mjs';
import {currentSpecification,approvedSpecification} from './council-spec.mjs';
import {AI_KINDS,modelAvailability} from './model-bindings.mjs';
import {workspaceDir} from './workspace.mjs';
import {runTaskTests} from './native-agent.mjs';
import {collectSource,manifestFromSource,launchError} from './launch-artifacts.mjs';
import {createCloudAdapter} from './launch-cloud.mjs';
import {createLaunchRunner} from './launch-runner.mjs';
import {deliveryBuildContext} from './launch-context.mjs';
import {commandExists,run} from './shell.mjs';
import {npmCliPath} from './managed-cli.mjs';
export function createAppLaunch(){
 const cloud=createCloudAdapter({getConnection,saveConnection});
 function assertAccess(){if(!vaultStatus().unlocked)throw launchError('LAUNCH_VAULT_LOCKED','Open Vault to resume delivery.');}
 function autoAssign(projectId){const p=getProject(projectId),roles=structuredClone(p.modelRoles||{});const candidates=[];
  for(const c of listConnections().filter(c=>AI_KINDS.includes(c.kind))){const a=modelAvailability(c.id);for(const model of [...new Set([...(a.verifiedModels||[]),c.model,...(a.models||[])].filter(Boolean))])if((a.models||[]).includes(model))candidates.push({connectionId:c.id,model});}
  if(!candidates.length)throw launchError('LAUNCH_AI_SETUP','Connect an AI and load its model catalog first.');
  roles.founder??=candidates[0];roles.worker??=candidates.find(c=>c.connectionId!==roles.founder.connectionId)||roles.founder;
  roles.reviewer??=candidates.find(c=>c.connectionId!==roles.worker.connectionId)||candidates.find(c=>c.model!==roles.worker.model);
  if(!roles.reviewer)throw launchError('LAUNCH_AI_SETUP','An independent reviewer needs a different AI binding (account/model). Add/select a reviewer.');
  if(!roles.council?.length)roles.council=[roles.founder,roles.reviewer].filter((c,i,a)=>a.findIndex(x=>x.connectionId===c.connectionId&&x.model===c.model)===i);
  if(roles.worker.connectionId===roles.reviewer.connectionId&&roles.worker.model===roles.reviewer.model)throw launchError('LAUNCH_AI_SETUP','Worker and reviewer must not be the same binding.');
  if(JSON.stringify(roles)!==JSON.stringify(p.modelRoles))updateProjectModelRoles(projectId,{...roles,backups:p.modelRoleBackups||{}});
 }
 const backend={
  assertAccess,project:getProject,specification:id=>currentSpecification(getProject(id)),
  roles(id){try{return projectModelRoles(id);}catch{return null;}},
  async prepare(r){assertAccess();
   const kind=getProject(r.projectId).productType;
   if(kind&&!['website','web-saas','other'].includes(kind))throw launchError('LAUNCH_PRODUCT_SCOPE','This adapter delivers web products only. Do not convert a desktop, mobile, API-only or automation request into a placeholder website.');
   if(!(await commandExists('git')))throw launchError('LAUNCH_LOCAL_SETUP','Git is required for isolated task branches and review. Run INSTALL-CODE-TOOLS-WINDOWS.cmd first.');
   if(r.config.testMode==='docker'){
    if(!(await commandExists('docker')))throw launchError('LAUNCH_LOCAL_SETUP','Docker is not available. Install/start Docker, or explicitly choose Host mode and review its risks.');
    const status=await run('docker',['info','--format','{{.ServerVersion}}'],{timeoutMs:5000,inheritEnv:false});
    if(status.code!==0)throw launchError('LAUNCH_LOCAL_SETUP','Docker daemon is not ready. Start Docker before authorizing AI work.');
   }else if(process.platform==='win32')npmCliPath();
   if(r.config.autoAssign)autoAssign(r.projectId);
   const p=getProject(r.projectId);if(!p.settings.reviewRequired)throw launchError('LAUNCH_REVIEW_REQUIRED','Enable independent review before one-button delivery.');
   const s=currentSpecification(p);if(s?.status==='approved'||s?.status==='pending')return;await acceptProjectWork(r.projectId);
  },
  approve(r,id){assertAccess();const p=getProject(r.projectId),s=currentSpecification(p);if(s?.status!=='approved')confirmCouncilSpecification(r.projectId,id);updateProjectSettings(r.projectId,{sandboxMode:r.config.testMode});},
  async build(r,guard){guard();let p=getProject(r.projectId);const spec=approvedSpecification(p);
   if(!p.planId||p.planSpecificationId!==spec.id)await buildPlan(p.id);
   p=getProject(p.id);
   // A final packaging task is an explicit part of the user's delivery grant, not a new product feature.
   if(!p.tasks.some(t=>t.title==='One-button delivery package'))createTask(p.id,{title:'One-button delivery package',role:'devops',priority:'high',description:'Complete deployable packaging and real requirement tests without changing approved features. '+deliveryBuildContext(p.id),dependsOn:p.tasks.map(t=>t.id),doneWhen:'Runnable app, strict aios.delivery.json, meaningful npm test and instructions; independent reviewer approval.',acceptanceCriteria:['Do not expose secrets or weaken RLS.','Manifest matches actual features and source.','Tests exercise actual product requirements, not a constant true.'],engineId:'native'});
   guard();const result=await runReadyBatch(p.id,{autoContinue:true,assertContinue:guard});guard();if(!result.ok)throw launchError('LAUNCH_TASKS','Some tasks are unfinished. Inspect named AI task results and resume; completed tasks are retained.');return {done:getProject(p.id).tasks.filter(t=>t.status==='done').length,independentReview:true};
  },
  async validate(r){assertAccess();const p=getProject(r.projectId);approvedSpecification(p);
   if(!p.tasks.length||p.tasks.some(t=>t.status!=='done'||t.review?.approved!==true))throw launchError('LAUNCH_REVIEW_REQUIRED','All tasks must be completed with independent review approval.');
   const root=workspaceDir(p.id),before=collectSource(root,{redact:redactVaultSecrets}),manifest=manifestFromSource(before,{databaseAllowed:r.config.database});
   if(manifest.framework==='static'&&!before.files.some(f=>f.file==='index.html'))throw launchError('LAUNCH_SOURCE_ENTRY','Static web requires root index.html.');
   const test=await runTaskTests({root,sandboxMode:r.config.testMode});
   if(test.status!=='PASS'||test.exitCode!==0)throw launchError('LAUNCH_TEST_REQUIRED','Final npm test did not pass ('+test.status+'). '+String(test.reason||test.stderr||'Check test script, dependencies and sandbox.').slice(0,1200));
   const source=collectSource(root,{redact:redactVaultSecrets});if(source.hash!==before.hash)throw launchError('LAUNCH_SOURCE_CHANGED','Source changed during final tests. Review it before release.');
   return {source,manifest,test,reviewedTasks:p.tasks.length};
  }
 };
 try {return createLaunchRunner({dataDir:DATA_DIR,backend,cloud,redact:redactVaultSecrets});}
 catch(error){
  // A damaged delivery journal must not take down the user's other app tabs.
  // Do not replace or silently reset the journal: reconciliation is required.
  const unavailable=()=>{throw launchError('LAUNCH_STORE','Delivery checkpoint cannot be opened. Restore its valid backup or reconcile recorded cloud resources. Other app features remain available.');};
  console.warn('One-button delivery is unavailable: checkpoint read failed.');
  return Object.fromEntries([...['create','approve','resume','stop','get','getForProject','artifact','wait','options'].map(k=>[k,unavailable]),['isActive',()=>false],['close',()=>{}]]);
 }
}
