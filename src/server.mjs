import {SOCIAL_CHANNELS,createSocialPublisher,socialIdentity,socialApprovalHash} from './lib/social-channels.mjs';
import {createGithubImportJobs} from './lib/github-import-jobs.mjs';
import {buildProjectConversation} from './lib/project-conversation.mjs';
import {windowsSpeechStatus} from './lib/windows-speech.mjs';
import {piperSetupStatus,installPiperVietnamese,configureLocalVoice} from './lib/piper-managed.mjs';
import {scanNews,suggestNewsField,pageNewsCards} from './lib/radar-service.mjs';
import {productionCapabilities,assertProductionReady} from './lib/production-preflight.mjs';
import {createWorkCenter} from './lib/work-center.mjs';
import {createWorkBackend} from './lib/work-center-backend.mjs';
import {listProducts,projectSourceZip,articleDocument,customerDeliveryBundle} from './lib/product-service.mjs';
import {sendArtifact} from './lib/range-response.mjs';
import {currentSpecification} from './lib/council-spec.mjs';
import {attachProductionRequest} from './lib/projects.mjs';
import { createAppLaunch } from './lib/launch-bridge.mjs';
import { prepareNewsEvidence } from './lib/intake-evidence.mjs';
import { dispatchStatus, dispatchFeedEvents } from './lib/ai-dispatch.mjs';
import { projectMapSnapshot, exportMapSvg } from './lib/project-map.mjs';
import { deleteAccountProfile, verifyAccountModel, startAccountLogin, refreshAccount, cancelAccountLogin, logoutAccount, readAccountUsage, accountAvailability, closeAccountSessions } from './lib/account-auth.mjs';
import { usageSummary } from './lib/usage.mjs';
import { cliToolsStatus, installManagedCli } from './lib/managed-cli.mjs';
import { kokoroStatus, kokoroInstall, kokoroInstalling } from './lib/kokoro-tts.mjs';
import { createCliAccount, cliAccountStatus, removeCliAccount, verifyCliAccountModel, startCliLoginWindow } from './lib/cli-account.mjs';
import { infraToolsStatus, installInfraTool, startInfraLoginWindow } from './lib/infra-tools.mjs';
import { createAntigravityAccount, antigravityStatus, listAntigravityModels, verifyAntigravityModel, openAntigravityLogin, installAntigravityWindows, removeAntigravityAccount } from './lib/antigravity-account.mjs';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactVaultSecrets, vaultStatus, unlockVault, lockVault, listConnections, getConnection, saveConnection, deleteConnection, renameConnection, findServiceCredential } from './lib/vault.mjs';
import { testConnection, listModels } from './lib/providers.mjs';
import { AI_KINDS, modelAvailability, verifiedBinding, invalidateModels } from './lib/model-bindings.mjs';
import { updateProjectBrief, clearFounderChat, analyzeIdea, sendBriefToCouncil, saveProjectDomain, projectModelRoles, updateProjectModelRoles, listProjects, createProject, getProject, updateProjectSettings, founderChat, runCouncil, councilHistory, confirmCouncilSpecification, recoverInterruptedCouncils, analyzeStack, buildPlan, createTask, updateTask, archiveTask, runTask, runReadyBatch, acceptProjectWork, readyTasks, recoverInterruptedTasks, recoverInterruptedFounderChats } from './lib/projects.mjs';
import { snapshot, workspaceSummary } from './lib/workspace.mjs';
import { listSkills, saveCustomSkill, setSkillEnabled, deleteCustomSkill, sampleSkillMapping } from './lib/skills.mjs';
import { importSkillUpload, importRepoZip, importRepoGit, listImportedRepos, deleteImportedRepo } from './lib/skill-import.mjs';
import { engineStatuses, installEngineSource, systemPrerequisites, systemPrerequisiteVersions, engineDiagnostics, listCustomEngines, saveCustomEngine, deleteCustomEngine } from './lib/engines.mjs';
import { installOpencode, opencodeInstalling } from './lib/opencode.mjs';
import { sandboxStatus } from './lib/sandbox.mjs';
import { gitStatus, initGit, publishGitHub, deployVercel } from './lib/publish.mjs';
import { listGithubRepos, importGithubRepo, buildContinuationPlan, listGithubIssues, useGithubIssueAsBrief, createGithubPullRequest } from './lib/github-repos.mjs';
import { connectCli } from './lib/cli-connections.mjs';
import { listSupabaseProjects, createSupabaseProject, attachSupabaseProject, generateDbPassword } from './lib/supabase.mjs';
import { attachVercelDomain } from './lib/domain.mjs';
import { createIntegrationHost } from './lib/integration-host.mjs';
import { concatInstallStatus, provisionConcat } from './lib/concat-managed.mjs';
import { DATA_DIR, BACKUP_DIR, readJson, writeJson } from './lib/store.mjs';
import { createEncryptedBackup, listBackups, backupFileByName } from './lib/customer-backup.mjs';
import { systemDoctor } from './lib/system-doctor.mjs';
import { createLocalAccess } from './lib/local-access.mjs';
import { createIngestStore } from './lib/ingest.mjs';
import { fetchArticleText } from './lib/fulltext.mjs';
import { listNewsFields, newsFieldById, googleNewsRssUrl } from './lib/news-fields.mjs';
import { createOrchestrator, createSimulatedAi, createGatewayAi, buildRunFeed } from './lib/orchestrator.mjs';
import { operatorStatus, createOperatorToken, revokeOperatorToken, verifyOperatorToken, operatorCan, addOperatorNote, listOperatorNotes, operatorNoteEvents } from './lib/operator.mjs';
import { poolFeedEvents, poolInfoFor } from './lib/account-pool.mjs';
import { deriveFleet } from './lib/office-fleet.mjs';
import { deriveSpaceFleet } from './lib/space-fleet.mjs';
import { spaceActivitySnapshot } from './lib/space-activity.mjs';
import { writeTextWithModel, translateSegmentsWithModel } from './lib/media-ai.mjs';
import { oauthAuthorizeUrl, oauthExchangeCode, fetchPlatformIdentity, PLATFORM_KINDS } from './lib/publish-platforms.mjs';
import { createUpdater } from './lib/updater.mjs';
import { listOfficeModels, saveOfficeModel, deleteOfficeModel, officeModelPath, OFFICE_MODEL_MAX_BYTES } from './lib/office-models.mjs';
import { localWorkers } from './lib/local-workers.mjs';
import {freeStackStatus} from './lib/free-stack.mjs';
import {comfyImageBridge} from './lib/comfyui-local.mjs';
import {integrationCatalog,bundledSkillText} from './lib/integration-catalog.mjs';
import {createMcpHub} from './lib/mcp-hub.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const PUB=path.join(ROOT,'public');
const HOST='127.0.0.1', PORT=Number(process.env.AI_PROJECT_OS_PORT||4321), VERSION='0.9.75';
if(!Number.isSafeInteger(PORT)||PORT<1024||PORT>65535)throw new Error('AI_PROJECT_OS_PORT phải nằm trong 1024..65535.');
const localAccess=createLocalAccess({port:PORT,version:VERSION});
let backingUp=false;
const mcpHub=createMcpHub({getProject});
let installingConcat=false;
const integrations=createIntegrationHost({root:ROOT});
const ingestStore=createIngestStore({file:path.join(DATA_DIR,'ingest.json')});
/* Story-run music: ACE-Step local worker when the pipeline binds it
 * (musicSource:'ace-step') and the worker is READY; otherwise the app's
 * synthesized bed. localWorkers.resolveStoryMusic always labels the source
 * (incl. fallbackFrom + reason) — the orchestrator journals it verbatim. */
const storyMusic=async({run,cfg})=>{
  const dir=path.join(integrations.mediaWorkspace,'orchestrator');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const made=await localWorkers.resolveStoryMusic({musicSource:cfg.musicSource||'synthesized',title:run.title,outputBase:path.join(dir,`${run.id}-music`),seconds:75});
  return {file:made.file?path.relative(integrations.mediaWorkspace,made.file):null,detail:made.detail};
};
const orchestrator=createOrchestrator({file:path.join(DATA_DIR,'orchestrator.json'),ingest:ingestStore,host:integrations,createProject,storyMusic,preflight:async(pipeline,input)=>{if(!['news-article','client-article'].includes(pipeline)&&input.voiceMode!=='captions'&&!input.ttsProvider){integrations.refreshProductionStatus();input.ttsProvider=productionCapabilities(integrations).defaultVoice||'auto';}if(!['news-article','client-article'].includes(pipeline)&&input.voiceMode!=='captions')await integrations.prepareProduction(input);assertProductionReady(integrations,pipeline,input);},aiAdapters:{simulated:createSimulatedAi(),gateway:createGatewayAi({writeTextWithModel,translateSegmentsWithModel})}});
const deliveryLaunch=createAppLaunch();
let workCenter;
try{workCenter=createWorkCenter({file:path.join(DATA_DIR,'work-center.json'),backend:createWorkBackend({host:integrations,orchestrator,delivery:deliveryLaunch}),redact:redactVaultSecrets});}
catch(e){const unavailable=()=>{throw new Error('Work center journal unavailable; restore backup. Other tabs are preserved.');};workCenter={start:unavailable,list:unavailable,latest:unavailable,isActive:()=>false,close:()=>{}};}

const oauthPending=new Map();
const updater=createUpdater({dataDir:DATA_DIR,currentVersion:VERSION});
function send(res,status,data,type='application/json; charset=utf-8'){
  const b=Buffer.isBuffer(data)?data:Buffer.from(type.startsWith('application/json')?JSON.stringify(data):String(data));
  res.writeHead(status,{'content-type':type,'content-length':b.length,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});res.end(b);
}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',d=>{s+=d;if(s.length>3_000_000){reject(new Error('Request quá lớn'));req.destroy();}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch{reject(new Error('JSON không hợp lệ'));}});});}
function readRawBody(req,max){return new Promise((resolve,reject)=>{const chunks=[];let total=0;req.on('data',d=>{total+=d.length;if(total>max){reject(Object.assign(new Error('File quá lớn'),{code:'OFFICE_MODEL_SIZE'}));req.destroy();return;}chunks.push(d);});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);});}
function routeProject(url){const m=url.match(/^\/api\/projects\/([^/]+)(?:\/(.+))?$/);return m?{id:decodeURIComponent(m[1]),action:m[2]||''}:null;}
// --- Operator diagnosis projections (read-only, secret-free, size-capped) ---
// The external coordinator reads run detail through these projections so it
// can diagnose failures itself: per-step state and the ORIGINAL error are
// kept, bulky payloads and anything secret-shaped are dropped.
function diagnoseStepDetail(detail){
  if(!detail||typeof detail!=='object'||Array.isArray(detail))return undefined;
  const out={};
  for(const [k,v] of Object.entries(detail)){
    if(Object.keys(out).length>=16)break;
    if(typeof v==='string')out[k]=v.slice(0,300);
    else if(typeof v==='number'||typeof v==='boolean')out[k]=v;
    else if(Array.isArray(v)&&v.every(x=>typeof x==='string'||typeof x==='number'))out[k]=v.slice(0,10).map(x=>String(x).slice(0,120));
  }
  return Object.keys(out).length?out:undefined;
}
function diagnoseRun(run){
  const steps=(Array.isArray(run.steps)?run.steps:[]).map(s=>{const d=diagnoseStepDetail(s&&s.detail);return {name:s&&s.name,state:s&&s.state,at:(s&&s.at)||null,...(d?{detail:d}:{})};});
  const failText=f=>{if(f&&typeof f==='object')return String(f.message||f.code||'');return f==null?'':String(f);};
  const err=run.error&&typeof run.error==='object'?{code:run.error.code||null,message:String(run.error.message||'').slice(0,400)}:null;
  if(err&&Array.isArray(run.error.failures))err.failures=run.error.failures.slice(0,10).map(f=>failText(f).slice(0,200));
  return {id:run.id,pipeline:run.pipeline,state:run.state,title:run.title,createdAt:run.createdAt,completedAt:run.completedAt||null,error:err,steps};
}
function diagnoseConnections(){
  let list;
  try{list=listConnections();}catch{return {vaultLocked:true,connections:[]};}
  const safe=(fn,id)=>{try{return fn(id);}catch{return undefined;}};
  return {vaultLocked:false,connections:list.map(c=>({id:c.id,kind:c.kind,name:(c.meta&&(c.meta.accountLabel||c.meta.channelTitle||c.meta.username))||c.name||null,hasSecret:Boolean(c.hasSecret),verified:Boolean(c.meta&&c.meta.verifiedAt),authMode:(c.meta&&c.meta.authMode)||null,planType:(c.meta&&c.meta.planType)||null,availability:c.kind==='chatgpt_account'?safe(accountAvailability,c.id):AI_KINDS.includes(c.kind)?safe(modelAvailability,c.id):undefined,pool:AI_KINDS.includes(c.kind)?safe(poolInfoFor,c.id):undefined}))};
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2'};

function sameLocalOrigin(req){
  const origin=req.headers.origin;if(!origin)return true;
  try{const u=new URL(origin);return ['127.0.0.1','localhost'].includes(u.hostname)&&String(u.port||'80')===String(PORT);}catch{return false;}
}
function mutating(method){return ['POST','PUT','PATCH','DELETE'].includes(method);}
try{const messages=recoverInterruptedFounderChats();if(messages)console.warn(`Recovered ${messages} interrupted Founder message(s) from previous session.`);const councils=recoverInterruptedCouncils();if(councils)console.warn(`Recovered ${councils} interrupted Council run(s) from previous session.`);const n=recoverInterruptedTasks();if(n)console.warn(`Recovered ${n} interrupted task(s) from previous session.`);}catch(e){console.error('Project state recovery failed:',e.message);throw e;}

const githubImportJobs=createGithubImportJobs();
const socialPublisher=createSocialPublisher({load:()=>readJson('social-drafts.json',[]),save:r=>writeJson('social-drafts.json',r),getConnection,appendRecord:r=>integrations.publishRecords.append(r),simulated:process.env.AIOS_DELIVERY_FIXTURE==='1'});
const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://localhost');
  // --- External operator channel (token-gated, narrow scope) ---
  // Reached through the owner's own private network (e.g. Tailscale Serve
  // proxies to this loopback port), so the Host is the tailnet name rather
  // than 127.0.0.1. The operator token — never the browser session — is the
  // credential here, and only these endpoints exist on this channel.
  if(u.pathname.startsWith('/api/operator/ext/')){
    const auth=verifyOperatorToken(req.headers['x-aios-operator']);
    if(!auth)return send(res,401,{error:'Operator token không hợp lệ hoặc đã bị thu hồi.'});
    try{
      if(req.method==='GET'&&u.pathname==='/api/operator/ext/status'){
        const cfg=orchestrator.getConfig();
        return send(res,200,{ok:true,version:VERSION,stopAll:cfg.stopAll,pipelines:Object.fromEntries(Object.entries(cfg.pipelines).map(([k,v])=>[k,{enabled:v.enabled,aiMode:v.aiMode,dailyCap:v.dailyCap}])),runs:orchestrator.listRuns().slice(-15).map(r=>({id:r.id,pipeline:r.pipeline,state:r.state,title:r.title,createdAt:r.createdAt,steps:(r.steps||[]).length})),notes:listOperatorNotes(10)});
      }
      if(req.method==='GET'&&u.pathname.startsWith('/api/operator/ext/run/')){
        const run=orchestrator.getRun(decodeURIComponent(u.pathname.slice('/api/operator/ext/run/'.length)));
        if(!run)return send(res,404,{error:'Không tìm thấy lượt chạy này.'});
        return send(res,200,{run:diagnoseRun(run)});
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/ext/journal'){
        const limit=Math.min(200,Math.max(1,Number(u.searchParams.get('limit'))||100));
        return send(res,200,{feed:buildRunFeed(orchestrator.listRuns(),{limit}),notes:operatorNoteEvents(20)});
      }
      if(req.method==='GET'&&u.pathname==='/api/operator/ext/connections'){
        return send(res,200,diagnoseConnections());
      }
      if(req.method==='POST'&&u.pathname==='/api/operator/ext/run'){
        if(!operatorCan(auth,'run'))return send(res,403,{error:'Token chưa được cấp quyền tạo lượt chạy (scope run).'});
        const b=await readBody(req);const run=await orchestrator.startRun(String(b.pipeline||''),{cardId:b.cardId||null,sourceVideo:b.sourceVideo||null,title:b.title||undefined,ideaText:b.ideaText||null});
        return send(res,200,{run});
      }
      if(req.method==='POST'&&u.pathname==='/api/operator/ext/note'){
        if(!operatorCan(auth,'note'))return send(res,403,{error:'Token chưa được cấp quyền gửi ghi chú (scope note).'});
        const b=await readBody(req);const note=addOperatorNote(b.text);
        return send(res,200,{note});
      }
      if(req.method==='POST'&&u.pathname==='/api/operator/ext/approve'){
        if(!operatorCan(auth,'approvePublish'))return send(res,403,{error:'Token không có quyền duyệt đăng (scope approvePublish đang tắt — Sếp giữ cổng duyệt).'});
        const b=await readBody(req);const run=await orchestrator.approveRun(String(b.runId||''));
        return send(res,200,{run});
      }
      return send(res,404,{error:'Operator endpoint không tồn tại.'});
    }catch(e){return send(res,400,{error:e.message});}
  }
  if(!['127.0.0.1','localhost'].includes((req.headers.host||'').split(':')[0]))return send(res,403,{error:'Local-only host required.'});
  if(req.method==='GET'&&u.pathname==='/'&&u.searchParams.has('launch')){
    if(localAccess.validTicket(u.searchParams.get('launch')))return localAccess.grant(res);
    return send(res,403,{error:'Mã mở ứng dụng đã hết hạn hoặc không hợp lệ. Mở lại bằng AI-Project-OS.exe.'});
  }
  if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,localOnly:true,version:VERSION});
  if(!localAccess.validSession(req))return send(res,401,{error:'Phiên trình duyệt chưa được cấp quyền. Đóng tab này và mở ứng dụng bằng AI-Project-OS.exe hoặc RUN-WINDOWS.cmd.'});
  if(mutating(req.method)&&!sameLocalOrigin(req))return send(res,403,{error:'Cross-origin request blocked.'});
  if(mutating(req.method)&&req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return send(res,403,{error:'Cross-site request blocked.'});
  if(backingUp&&mutating(req.method))return send(res,409,{error:'Hệ thống đang tạo bản sao lưu. Vui lòng chờ hoàn tất trước khi thay đổi dữ liệu.'});
  // --- Signed auto-update ---
  if(req.method==='GET'&&u.pathname==='/api/update/status')return send(res,200,updater.status());
  if(req.method==='POST'&&u.pathname==='/api/update/config'){const b=await readBody(req);return send(res,200,updater.setConfig({url:b.url}));}
  if(req.method==='POST'&&u.pathname==='/api/update/check')return send(res,200,await updater.check());
  if(req.method==='POST'&&u.pathname==='/api/update/download')return send(res,200,await updater.download());
  // Trusted, same-origin local integration boundary; no provider tokens sent to browser.
  if(req.method==='GET'&&u.pathname==='/api/integrations/catalog')return send(res,200,integrationCatalog());
  if(req.method==='GET'&&u.pathname==='/api/integrations/skill-reference')return send(res,200,bundledSkillText(u.searchParams.get('id')));
  if(req.method==='GET'&&u.pathname==='/api/mcp')return send(res,200,mcpHub.list());
  if(u.pathname.startsWith('/api/mcp/')&&req.method==='POST'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Mở Vault trước khi dùng MCP.'});
    const b=await readBody(req);
    if(u.pathname==='/api/mcp/save')return send(res,200,mcpHub.save(b));
    if(u.pathname==='/api/mcp/connect')return send(res,200,await mcpHub.connect(b.id));
    if(u.pathname==='/api/mcp/call')return send(res,200,await mcpHub.call(b));
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/status')return send(res,200,integrations.status());
  if(req.method==='GET'&&u.pathname==='/api/free-stack/status')return send(res,200,await freeStackStatus({capabilities:()=>{integrations.refreshProductionStatus();return productionCapabilities(integrations);},concatProbe:()=>integrations.checkConcat({revive:false})}));
  if(req.method==='POST'&&u.pathname==='/api/free-stack/comfyui/workflow'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Mở Vault trước khi thay đổi cấu hình công cụ ảnh local.'});
    const body=await readBody(req);
    if(typeof body.workflow!=='string')return send(res,400,{error:'Chọn file JSON ở định dạng API Format từ ComfyUI.'});
    let installed;
    try{installed=comfyImageBridge.installWorkflow(body.workflow);}
    catch(e){if(/^COMFY_(?:CONFIGURATION|CONFIGURATION_OVERRIDE|SECURITY)$/.test(String(e.code)))return send(res,400,{error:e.message,code:e.code});throw e;}
    return send(res,200,{installed:installed.installed,changed:installed.changed,configured:installed.configured,nodes:installed.nodes,workflowHash:installed.workflowHash,reason:installed.reason});
  }
  // Unified reception and real artifact delivery. No publication is triggered here.
  if(req.method==='POST'&&u.pathname==='/api/production/prepare'){if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});const raw=await readBody(req);const input={ttsProvider:String(raw.ttsProvider||'auto'),voice:raw.voice,renderEngine:raw.renderEngine||'concat',visualMode:raw.visualMode||'ai',imageProvider:raw.imageProvider||'auto',confirmPaidImages:raw.confirmPaidImages===true};await integrations.prepareProduction(input);return send(res,200,{ready:true,message:'Giong / nhom anh / editor da kiem tra. Chua tao anh hay goi TTS.',imageAccounts:(input.imagePool||[]).map(({name,model,provider,paid})=>({name,model,provider,paid})),voice:input.voice||null,renderEngine:input.renderEngine});}
  if(req.method==='POST'&&u.pathname==='/api/production/refresh'){if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});const input=await readBody(req);integrations.refreshProductionStatus();const caps=productionCapabilities(integrations);const voicePreview=input.testVoice===true&&caps.defaultVoice?await integrations.previewVoice({ttsProvider:caps.defaultVoice}):null;return send(res,200,{...caps,refreshed:true,voiceVerified:!!voicePreview,voicePreview,noDownloads:true,noPaidApiCalled:true});}
  if(req.method==='GET'&&u.pathname==='/api/production/windows-voices'){if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});return send(res,200,windowsSpeechStatus({refresh:true}));}
  if(req.method==='GET'&&u.pathname==='/api/production/capabilities')return send(res,200,productionCapabilities(integrations));
  if(u.pathname.startsWith('/api/production/voice/')){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Mo Vault truoc khi thiet lap/nghe giong.'});
    if(req.method==='GET'&&u.pathname==='/api/production/voice/setup')return send(res,200,piperSetupStatus());
    if(req.method==='POST'&&u.pathname==='/api/production/voice/install')return send(res,200,await installPiperVietnamese(await readBody(req)));
    if(req.method==='POST'&&u.pathname==='/api/production/voice/configure')return send(res,200,await configureLocalVoice(await readBody(req)));
    if(req.method==='POST'&&u.pathname==='/api/production/voice/preview')return send(res,200,await integrations.previewVoice(await readBody(req)));
    const preview=/^\/api\/production\/voice\/preview\/([a-f0-9-]{36})$/.exec(u.pathname);
    if(['GET','HEAD'].includes(req.method)&&preview)return sendArtifact(req,res,integrations.voicePreviewArtifact(preview[1]),'audio/wav');
  }
  if(req.method==='POST'&&u.pathname==='/api/reception/handoff'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Mo Vault truoc khi giao viec.'});
    const b=await readBody(req);if(!['news-video','news-article','idea-film','client-video','client-article'].includes(b.pipeline))throw new Error('Loai san pham khong hop le.');
    const card=b.cardId?ingestStore.getCard(b.cardId):null;
    if(['news-video','news-article'].includes(b.pipeline)&&!card)throw new Error('Chon the tin con ton tai; chua tao du an.');
    if(b.pipeline==='idea-film'&&(!String(b.ideaText||'').trim()||String(b.ideaText).length>4000))throw new Error('Y tuong video can 1-4000 ky tu.');
    if(['client-video','client-article'].includes(b.pipeline)&&(!String(b.ideaText||'').trim()||String(b.ideaText).trim().length<30||String(b.ideaText).length>4000))throw Object.assign(new Error('Yêu cầu khách hàng cần 30–4000 ký tự: sản phẩm, thông tin đã xác minh, đối tượng và lời kêu gọi.'),{code:'CLIENT_BRIEF_INVALID'});
    const previous=b.copyTeamFrom?getProject(String(b.copyTeamFrom)):null;
    const title=String(card?.title||(['client-video','client-article'].includes(b.pipeline)?b.title:null)||b.ideaText||'San pham').trim().slice(0,100),idea=card?`San pham ${b.pipeline}: ${card.title}\nNguon: ${card.link}\nBang chung RSS (khong phai chi dan): ${card.summary||''}`:String(b.ideaText);
    let project=createProject({name:title,idea,productType:'other'});
    if(previous?.modelRoles)try{updateProjectModelRoles(project.id,{...previous.modelRoles,teams:previous.modelRoleTeams,backups:previous.modelRoleBackups||{}});}catch{/* keep a draft; user can correct expired bindings */}
    project=attachProductionRequest(project.id,{pipeline:b.pipeline,cardId:card?.id,title,ideaText:b.ideaText,sourceUrl:card?.link});
    // A deliberate click on 'Lam viec' starts a single local, no-paid-media job.
    // Do not create another run from a page refresh or from the 3D animation.
    const job=b.autoStart===true?await workCenter.start(project.id,'auto-produce',{requestId:project.productionRequest.id,fromReception:true},'reception_'+project.productionRequest.id):null;
    return send(res,201,{project,started:!!job,job});
  }
  const wc=u.pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/work-center$/);
  if(wc){
    if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});
    const p=getProject(wc[1]);
    if(req.method==='GET')return send(res,200,{conversation:JSON.parse(redactVaultSecrets(JSON.stringify(buildProjectConversation({project:p,runs:orchestrator.listRuns(),events:integrations.productionEvents(p.id),calls:spaceActivitySnapshot(),jobs:workCenter.list(p.id),connections:listConnections()})))),projectId:p.id,settings:{sandboxMode:p.settings?.sandboxMode},job:workCenter.latest(p.id),jobs:workCenter.list(p.id),request:p.productionRequest||null,specification:currentSpecification(p),roles:projectModelRoles(p.id),tasks:(p.tasks||[]).map(t=>({id:t.id,title:t.title,status:t.status,error:t.error||'',role:t.role,worker:t.servedWorkerBinding||t.workerBinding||null,reviewer:t.servedReviewerBinding||t.reviewerBinding||null,test:t.latestTestReceipt?.status||null})),feed:buildRunFeed(orchestrator.listRuns().filter(r=>r.projectId===p.id),{limit:150}),runs:orchestrator.listRuns().filter(r=>r.projectId===p.id).slice(0,15).map(r=>({id:r.id,title:r.title,state:r.state,error:r.error,steps:r.steps.slice(-35),voiceMode:r.voiceMode,review:r.review?{approved:r.review.approved,feedback:r.review.feedback,provider:r.review.provider,model:r.review.model}:null}))});
    if(req.method==='POST'){const b=await readBody(req);return send(res,202,{job:await workCenter.start(p.id,b.action,b.input||{},b.key||null)});}
  }
  const pp=u.pathname.match(/^\/api\/projects\/([a-f0-9-]{36})\/products(?:\/(source\.zip))?$/);
  if(pp&&req.method==='GET'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});
    if(pp[2])return sendArtifact(req,res,projectSourceZip(pp[1]),'application/zip');
    return send(res,200,listProducts(pp[1],{host:integrations,orchestrator,delivery:deliveryLaunch}));
  }
  const productArticle=u.pathname.match(/^\/api\/work-products\/([a-f0-9-]{36})\/article\.md$/);
  if(productArticle&&req.method==='GET'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});
    const r=orchestrator.getRun(productArticle[1]);if(!r)return send(res,404,{error:'Product not found'});getProject(r.projectId);
    return sendArtifact(req,res,{metadata:{name:'article.md'},bytes:Buffer.from(articleDocument(r),'utf8')},'text/plain; charset=utf-8');
  }
  const productBundle=u.pathname.match(/^\/api\/work-products\/([a-f0-9-]{36})\/delivery\.zip$/);
  if(productBundle&&req.method==='GET'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});
    const run=orchestrator.getRun(productBundle[1]);if(!run)return send(res,404,{error:'Product not found'});
    getProject(run.projectId);
    return sendArtifact(req,res,customerDeliveryBundle(run,{host:integrations}),'application/zip');
  }
  // --- Closed loop: ingest, orchestrator, platform publishing ---
  if(req.method==='GET'&&u.pathname==='/api/ingest/sources')return send(res,200,{sources:ingestStore.listSources(),counts:ingestStore.counts()});
  if(req.method==='POST'&&u.pathname==='/api/ingest/sources')return send(res,200,ingestStore.addSource(await readBody(req)));
  // R3 account-to-avatar projection. Read-only: no task starts or provider probes.
  if(u.pathname==='/api/office/space-fleet'&&req.method==='GET'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});
    const connections=listConnections().filter(c=>AI_KINDS.includes(c.kind)).map(c=>{
      let connected=false,coolingUntil=null;
      try{connected=(modelAvailability(c.id)?.models||[]).length>0;coolingUntil=poolInfoFor(c.id)?.cooldownUntil||null;}catch{}
      return {id:c.id,kind:c.kind,name:redactVaultSecrets(c.name||''),connected,coolingUntil};
    });
    const data=deriveSpaceFleet({connections,projects:listProjects(),runs:orchestrator.listRuns(),activity:spaceActivitySnapshot(),workJobs:listProjects().flatMap(p=>workCenter.list(p.id).filter(j=>['queued','running'].includes(j.state)))});
    // Defense in depth: also redact user-entered job titles against unlocked Vault secrets.
    return send(res,200,JSON.parse(redactVaultSecrets(JSON.stringify(data))));
  }
  if(u.pathname==='/api/office/fleet'&&req.method==='GET'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED',message:'Unlock the Vault to read the real AI account fleet.'});
    // "Connected" (v0.9.55) = logged in + has a model catalog — probe
    // verification is advisory now, so a bot is no longer dark just
    // because its models were never probe-verified. The pool cooldown is
    // passed through so a resting account shows at its charging pod.
    const conns=listConnections().filter(c=>AI_KINDS.includes(c.kind)).map(c=>{let connected=false,coolingUntil=null;try{const a=modelAvailability(c.id);connected=(a?.models||[]).length>0;const pool=poolInfoFor(c.id);if(pool?.cooldownUntil)coolingUntil=pool.cooldownUntil;}catch{connected=false;}return {id:c.id,kind:c.kind,name:c.name||'',connected,coolingUntil};});
    const workerConnByProject={};
    for(const pr of listProjects()){try{const w=projectModelRoles(pr.id)?.roles?.worker;if(w?.connectionId)workerConnByProject[pr.id]=String(w.connectionId);}catch{}}
    const fleet=deriveFleet({connections:conns,runs:orchestrator.listRuns(),workerConnByProject,nowMs:Date.now()});
    return send(res,200,{...fleet,generatedAt:new Date().toISOString()});
  }
  if(u.pathname==='/api/office/models'&&req.method==='GET')return send(res,200,{models:listOfficeModels(DATA_DIR)});
  const officeModelMatch=u.pathname.match(/^\/api\/office\/models\/([a-z]+)(\/file)?$/);
  if(officeModelMatch&&req.method==='POST'&&!officeModelMatch[2]){try{const buf=await readRawBody(req,OFFICE_MODEL_MAX_BYTES);return send(res,200,{model:saveOfficeModel(DATA_DIR,officeModelMatch[1],buf)});}catch(e){return send(res,400,{error:e.code||'OFFICE_MODEL',message:e.message});}}
  if(officeModelMatch&&req.method==='DELETE'&&!officeModelMatch[2]){try{return send(res,200,deleteOfficeModel(DATA_DIR,officeModelMatch[1]));}catch(e){return send(res,400,{error:e.code||'OFFICE_MODEL',message:e.message});}}
  if(officeModelMatch&&req.method==='GET'&&officeModelMatch[2]){let file=null;try{file=officeModelPath(DATA_DIR,officeModelMatch[1]);}catch{file=null;}if(!file)return send(res,404,{error:'OFFICE_MODEL_MISSING',message:'Chưa có model cho nhân vật này.'});res.writeHead(200,{'content-type':'model/gltf-binary','content-length':fs.statSync(file).size,'cache-control':'no-store'});fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);return;}
  const ingestSourceMatch=u.pathname.match(/^\/api\/ingest\/sources\/([^/]+)(?:\/(enabled))?$/);
  if(ingestSourceMatch&&req.method==='POST'&&ingestSourceMatch[2]==='enabled'){const b=await readBody(req);return send(res,200,ingestStore.setSourceEnabled(ingestSourceMatch[1],Boolean(b.enabled)));}
  if(ingestSourceMatch&&req.method==='DELETE'&&!ingestSourceMatch[2]){ingestStore.removeSource(ingestSourceMatch[1]);return send(res,200,{ok:true});}
  if(req.method==='POST'&&u.pathname==='/api/ingest/scan')return send(res,200,await scanNews(ingestStore,await readBody(req)));
  if(req.method==='GET'&&u.pathname==='/api/ingest/cards')return send(res,200,pageNewsCards(ingestStore,{fieldId:u.searchParams.get('fieldId')||null,maxAgeHours:u.searchParams.get('maxAgeHours')||0,offset:u.searchParams.get('offset')||0,limit:u.searchParams.get('limit')||100}));
  if(req.method==='POST'&&u.pathname==='/api/ingest/fields/suggest'){
    const b=await readBody(req);if(b.projectId){if(!vaultStatus().unlocked)return send(res,423,{error:'VAULT_LOCKED'});getProject(b.projectId);}
    return send(res,200,await suggestNewsField({label:b.label,projectId:b.projectId||null}));
  }
  if(req.method==='POST'&&u.pathname==='/api/ingest/fields')return send(res,201,{field:ingestStore.saveField(await readBody(req))});
  const customField=u.pathname.match(/^\/api\/ingest\/fields\/(custom-[a-z0-9-]+)$/);
  if(customField&&req.method==='PUT')return send(res,200,{field:ingestStore.saveField({...await readBody(req),id:customField[1]})});
  if(customField&&req.method==='DELETE'){ingestStore.removeField(customField[1]);return send(res,200,{ok:true});}
  const ingestCardFullText=u.pathname.match(/^\/api\/ingest\/cards\/([^/]+)\/fulltext$/);
  if(req.method==='POST'&&ingestCardFullText){
    const card=ingestStore.getCard(ingestCardFullText[1]);
    if(!card)return send(res,404,{error:'Không tìm thấy thẻ tin.'});
    if(!card.link)return send(res,422,{error:'Thẻ tin không có link nguồn để lấy toàn văn.'});
    const r=await fetchArticleText(card.link);
    if(!r.ok)return send(res,422,{error:'Không lấy được toàn văn từ nguồn ('+r.reason+'). Đọc trực tiếp tại link nguồn.'});
    return send(res,200,ingestStore.setCardFullText(card.id,{text:r.text,title:r.title}));
  }
  if(req.method==='GET'&&u.pathname==='/api/ingest/fields'){
    const cfgFields=orchestrator.getConfig().pipelines['news-video']?.fieldIds||[];
    const allCards=ingestStore.listCards();const sources=ingestStore.listSources();
    const fields=ingestStore.listFields().map(f=>{
      const fc=allCards.filter(c=>c.fieldId===f.id||(c.fieldIds||[]).includes(f.id));
      return {...f,sources:sources.filter(x=>x.fieldId===f.id).length,cards:fc.length,unusedCards:fc.filter(c=>!c.usedByProjectId).length,topScore:fc.reduce((m,c)=>Math.max(m,c.score||0),0),enabled:!cfgFields.length||cfgFields.includes(f.id)};
    });
    const unclassified=allCards.filter(c=>!c.fieldId).length;
    return send(res,200,{fields,unclassified,fieldFilterActive:cfgFields.length>0});
  }
  const ingestFieldMatch=u.pathname.match(/^\/api\/ingest\/fields\/([a-z0-9-]+)\/(source|enabled)$/);
  if(ingestFieldMatch&&req.method==='POST'){
    const field=ingestStore.fieldById(ingestFieldMatch[1]);
    if(!field)return send(res,404,{error:{code:'NEWS_FIELD_NOT_FOUND',message:'Không tìm thấy lĩnh vực tin.'}});
    if(ingestFieldMatch[2]==='source'){
      const existing=ingestStore.listSources().find(x=>x.fieldId===field.id);
      if(existing)return send(res,200,{source:existing,created:false});
      const source=ingestStore.addSource({name:'Google News — '+field.label,url:googleNewsRssUrl(field.query),fieldId:field.id});
      return send(res,200,{source,created:true});
    }
    const b=await readBody(req);const cfg=orchestrator.getConfig();
    const allIds=ingestStore.listFields().map(f=>f.id);
    let current=Array.isArray(cfg.pipelines['news-video'].fieldIds)&&cfg.pipelines['news-video'].fieldIds.length?[...cfg.pipelines['news-video'].fieldIds]:[...allIds];
    current=Boolean(b.enabled)?[...new Set([...current,field.id])]:current.filter(id=>id!==field.id);
    cfg.pipelines['news-video'].fieldIds=current.length===allIds.length?[]:current;
    orchestrator.setConfig(cfg);
    return send(res,200,{ok:true,enabled:Boolean(b.enabled),fieldIds:cfg.pipelines['news-video'].fieldIds});
  }
  if(req.method==='GET'&&u.pathname==='/api/orchestrator/fields-summary'){
    const runs=orchestrator.listRuns().filter(r=>r.pipeline==='news-video');
    const records=integrations.publishRecords.list({});
    const byProject=new Map();
    for(const r of records){if(!r.projectId)continue;const arr=byProject.get(r.projectId)||[];arr.push(r);byProject.set(r.projectId,arr);}
    const fields=ingestStore.listFields().map(f=>{
      const fr=runs.filter(r=>r.fieldId===f.id);
      const recs=fr.flatMap(r=>byProject.get(r.projectId)||[]);
      const sum=k=>recs.reduce((a,r)=>a+(Number(r.metrics?.[k])||0),0);
      return {fieldId:f.id,label:f.label,runs:fr.length,posts:recs.length,views:sum('views'),likes:sum('likes'),comments:sum('comments')};
    });
    return send(res,200,{fields});
  }
  if(req.method==='GET'&&u.pathname==='/api/orchestrator')return send(res,200,{config:orchestrator.getConfig(),runs:orchestrator.listRuns().slice(0,50)});
  if(req.method==='POST'&&u.pathname==='/api/orchestrator/config'){const b=await readBody(req);return send(res,200,{config:orchestrator.setConfig(b.config||b)});}
  if(req.method==='POST'&&u.pathname==='/api/orchestrator/stop'){const b=await readBody(req);const cfg=orchestrator.getConfig();cfg.stopAll=Boolean(b.stopAll);return send(res,200,{config:orchestrator.setConfig(cfg)});}
  if(req.method==='POST'&&u.pathname==='/api/orchestrator/run'){const b=await readBody(req);if(b.projectId)getProject(b.projectId);const run=await orchestrator.startRun(String(b.pipeline||''),{cardId:b.cardId||null,sourceVideo:b.sourceVideo||null,title:b.title||undefined,ideaText:b.ideaText||null,projectId:b.projectId||null,voiceMode:b.voiceMode,ttsProvider:b.ttsProvider,confirmPaidVoice:b.confirmPaidVoice===true,visualMode:b.visualMode,imageProvider:b.imageProvider,imageSources:b.imageSources,visualStyle:b.visualStyle,confirmPaidImages:b.confirmPaidImages===true,renderEngine:b.renderEngine,effects:b.effects,voice:b.voice});return send(res,200,{run});}
  const orchRetryMatch=u.pathname.match(/^\/api\/orchestrator\/runs\/([^/]+)\/retry$/);
  if(req.method==='POST'&&orchRetryMatch)return send(res,200,{run:await orchestrator.retryRun(orchRetryMatch[1])});
  const orchApproveMatch=u.pathname.match(/^\/api\/orchestrator\/runs\/([^/]+)\/approve$/);
  if(req.method==='POST'&&orchApproveMatch)return send(res,200,{run:await orchestrator.approveRun(orchApproveMatch[1])});
  if(req.method==='GET'&&u.pathname==='/api/orchestrator/feed'){
    const events=[...buildRunFeed(orchestrator.listRuns()),...operatorNoteEvents(50),...poolFeedEvents(50),...dispatchFeedEvents(90)];
    events.sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));
    return send(res,200,{events:events.slice(-180),activeCount:dispatchStatus().active.length+orchestrator.listRuns().filter(r=>r.state==='running').length,generatedAt:new Date().toISOString()});
  }
  // --- Operator channel management (the boss, via the browser session) ---
  if(req.method==='GET'&&u.pathname==='/api/operator')return send(res,200,{status:operatorStatus(),notes:listOperatorNotes(20)});
  if(req.method==='POST'&&u.pathname==='/api/operator/token'){const b=await readBody(req);return send(res,200,createOperatorToken(b.scopes||{}));}
  if(req.method==='DELETE'&&u.pathname==='/api/operator/token')return send(res,200,{status:revokeOperatorToken()});
  if(u.pathname.startsWith('/api/social/')){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Mở Vault để quản lý kênh.'});
    if(req.method==='GET'&&u.pathname==='/api/social/channels')return send(res,200,{channels:SOCIAL_CHANNELS,connections:listConnections().filter(c=>['threads','x','zalo'].includes(c.kind))});
    if(req.method==='POST'&&u.pathname==='/api/social/connect'){
      const b=await readBody(req);if(!['threads','x','zalo'].includes(b.platform))throw new Error('Kênh này hiện hỗ trợ xuất nội dung.');
      const candidate={kind:b.platform,secret:String(b.accessToken||'')};const identity=await socialIdentity(b.platform,candidate);
      return send(res,200,{connection:saveConnection({kind:b.platform,name:identity.accountLabel,secret:JSON.stringify({accessToken:candidate.secret}),meta:{...identity,verifiedAt:new Date().toISOString()}})});
    }
    if(u.pathname==='/api/social/drafts'){
      const projectId=req.method==='GET'?u.searchParams.get('projectId'):(await readBody(req));
      if(req.method==='GET'){getProject(projectId);return send(res,200,{drafts:socialPublisher.list(projectId).map(({operationToken,credentialVersion,...r})=>r)});}
      if(req.method==='POST'){getProject(projectId.projectId);return send(res,201,{draft:socialPublisher.create(projectId.projectId,projectId)});}
    }
    const sd=u.pathname.match(/^\/api\/social\/drafts\/([a-f0-9-]{36})\/(preview|publish)$/);
    if(sd&&req.method==='POST'){
      const b=await readBody(req);getProject(b.projectId);const draft=socialPublisher.list(b.projectId).find(r=>r.id===sd[1]);if(!draft)throw new Error('Không tìm thấy bản nháp của dự án.');
      if(sd[2]==='preview'){const c=getConnection(b.connectionId);if(c.kind!==draft.platform||!c.meta?.verifiedAt)throw new Error('Chọn tài khoản đã xác minh đúng nền tảng.');return send(res,200,{preview:{id:draft.id,title:draft.title,text:draft.text,platform:draft.platform,coverUrl:draft.coverUrl,account:c.meta.accountLabel,accountId:c.meta.userId,connectionId:c.id,approvalHash:socialApprovalHash(draft,c)}});}
      const {operationToken,credentialVersion,...result}=await socialPublisher.publish(draft.id,b);return send(res,200,{draft:result});
    }
  }
  if(req.method==='GET'&&u.pathname==='/api/publish/records')return send(res,200,{records:integrations.publishRecords.list({projectId:u.searchParams.get('projectId')||undefined})});
  if(req.method==='POST'&&u.pathname==='/api/publish/metrics/refresh'){const b=await readBody(req).catch(()=>({}));return send(res,200,{results:await integrations.refreshPublishMetrics({projectId:b.projectId||undefined})});}
  const oauthStartMatch=u.pathname.match(/^\/api\/connections\/oauth\/([a-z]+)\/start$/);
  if(req.method==='POST'&&oauthStartMatch&&PLATFORM_KINDS.includes(oauthStartMatch[1])){
    const kind=oauthStartMatch[1];const b=await readBody(req);
    if(!b.clientId||!b.clientSecret)throw new Error('Cần Client ID và Client Secret của ứng dụng nền tảng.');
    const state=crypto.randomUUID();const redirectUri=`http://${req.headers.host}/api/connections/oauth/${kind}/callback`;
    oauthPending.set(state,{kind,clientId:String(b.clientId),clientSecret:String(b.clientSecret),baseUrl:b.baseUrl?String(b.baseUrl):'',createdAt:Date.now()});
    return send(res,200,{url:oauthAuthorizeUrl(kind,{clientId:String(b.clientId),redirectUri,state}),state});
  }
  const oauthCbMatch=u.pathname.match(/^\/api\/connections\/oauth\/([a-z]+)\/callback$/);
  if(req.method==='GET'&&oauthCbMatch&&PLATFORM_KINDS.includes(oauthCbMatch[1])){
    const kind=oauthCbMatch[1];const pending=oauthPending.get(u.searchParams.get('state')||'');
    if(!pending||pending.kind!==kind||Date.now()-pending.createdAt>600000)return send(res,400,{error:'Phiên liên kết đã hết hạn. Hãy bắt đầu lại từ tab Kết nối.'});
    oauthPending.delete(u.searchParams.get('state'));
    const redirectUri=`http://${req.headers.host}/api/connections/oauth/${kind}/callback`;
    const tokens=await oauthExchangeCode(kind,{clientId:pending.clientId,clientSecret:pending.clientSecret,code:u.searchParams.get('code')||'',redirectUri,tokenUrl:pending.baseUrl?pending.baseUrl.replace(/\/$/,'')+'/oauth/token':undefined});
    // Keep the app credentials inside the encrypted token bundle: YouTube
    // access tokens live one hour, refresh needs client id+secret later.
    const bundle={...tokens,clientId:pending.clientId,clientSecret:pending.clientSecret};
    let identity=null;try{identity=await fetchPlatformIdentity(kind,{token:tokens,connection:{baseUrl:pending.baseUrl||undefined}});}catch{identity=null;}
    const meta={accountLabel:identity?.accountLabel||('Tài khoản '+kind),linkedAt:new Date().toISOString()};
    if(kind==='youtube'&&identity){if(identity.channelTitle)meta.channelTitle=identity.channelTitle;if(identity.channelId)meta.channelId=identity.channelId;}
    if(kind==='facebook'&&identity){meta.pages=identity.pages||[];if(identity.pageTokens&&Object.keys(identity.pageTokens).length)bundle.pageTokens=identity.pageTokens;if(meta.pages.length===1){meta.pageId=meta.pages[0].id;meta.pageName=meta.pages[0].name;}}
    if(kind==='tiktok'&&identity?.username)meta.username=identity.username;
    saveConnection({kind,name:meta.accountLabel,secret:JSON.stringify(bundle),baseUrl:pending.baseUrl||undefined,meta});
    res.writeHead(303,{location:'/#connections'});return res.end();
  }
  const pagePickMatch=u.pathname.match(/^\/api\/connections\/([^/]+)\/platform-page$/);
  if(req.method==='POST'&&pagePickMatch){
    const b=await readBody(req);const conn=listConnections().find(c=>c.id===decodeURIComponent(pagePickMatch[1]));
    if(!conn||conn.kind!=='facebook')throw new Error('Kết nối Facebook không tồn tại.');
    const page=(conn.meta?.pages||[]).find(pg=>String(pg.id)===String(b.pageId||''));
    if(!page)throw new Error('Page không thuộc tài khoản đã liên kết. Hãy liên kết lại để làm mới danh sách Page.');
    const saved=saveConnection({id:conn.id,kind:'facebook',name:conn.name,meta:{...(conn.meta||{}),pageId:String(page.id),pageName:String(page.name)}});
    return send(res,200,saved);
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/media/planner'){
    const id=u.searchParams.get('projectId')||'';if(id)getProject(id);
    const {target,...status}=integrations.plannerStatus(id);return send(res,200,status);
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/media/templates'){
    return send(res,200,{templates:integrations.mediaTemplates()});
  }
  if(req.method==='POST'&&u.pathname==='/api/integrations/media/director/plan'){
    const b=await readBody(req);if(b.projectId)getProject(b.projectId);
    return send(res,200,await integrations.directorPlan(b.projectId,{source:typeof b.source==='string'?b.source:'',wish:typeof b.wish==='string'?b.wish:'',templateId:typeof b.templateId==='string'?b.templateId:'',voiceProvider:typeof b.voiceProvider==='string'?b.voiceProvider:'local'}));
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/media/concat/managed/status')
    return send(res,200,{...concatInstallStatus({root:ROOT}),connected:false,requiresVault:!vaultStatus().unlocked});
  if(req.method==='POST'&&u.pathname==='/api/integrations/media/concat/managed/install'){
    if(!vaultStatus().unlocked)throw new Error('Mở Secret Vault trước khi thiết lập Concat, để mã kết nối được lưu an toàn.');
    const input=await readBody(req);
    if(input.confirm!==true)throw new Error('Cần xác nhận cài Concat chính thức và chấp thuận giấy phép AGPL trước khi tải/chạy bộ cài.');
    if(installingConcat)return send(res,409,{error:'Concat đang cài hoặc kết nối, vui lòng chờ.'});
    installingConcat=true;
    try{
      const installed=await provisionConcat({root:ROOT});
      // This token stays on the localhost server and in the encrypted Vault.
      saveConnection({id:'aios-concat-remote',kind:'other',name:'Concat Remote local',secret:installed.token,meta:{keyType:'concat_remote'}});
      let checked=null,lastError=null;
      for(let retry=0;retry<6;retry++){
        try{checked=await integrations.checkConcat();break;}catch(e){lastError=e.message;if(retry<5)await new Promise(r=>setTimeout(r,900));}
      }
      return send(res,200,{installed:true,connected:!!checked,bundled:installed.bundled,concatVersion:checked?.concatVersion||installed.version,apiVersion:checked?.apiVersion||null,
        message:checked?'Concat đã tự kết nối.':'Concat đã được cài và cấu hình. Chờ Concat khởi động rồi bấm Kiểm tra kết nối.',
        hint:checked?null:lastError||null,secretNeverReturned:true});
    }finally{installingConcat=false;}
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/media/concat/test')return send(res,200,await integrations.checkConcat());
  if(req.method==='POST'&&u.pathname==='/api/integrations/media/concat/open'){const input=await readBody(req);return send(res,200,await integrations.openInConcat({source:String(input.source||'')}));}
  if(req.method==='POST'&&u.pathname==='/api/integrations/media/concat/config'){
    const input=await readBody(req),token=String(input.token||'');
    if(!vaultStatus().unlocked)throw new Error('Mở Vault trước khi lưu token Concat.');
    if(token.length<8||token.length>4096||/[\r\n]/.test(token))throw new Error('Token Concat không hợp lệ (8-4096 ký tự).');
    saveConnection({id:'aios-concat-remote',kind:'other',name:'Concat Remote local',secret:token,meta:{keyType:'concat_remote'}});
    return send(res,200,{configured:true,secretNeverReturned:true});
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/media/voices')return send(res,200,await integrations.listVoices());
  if(req.method==='GET'&&u.pathname==='/api/integrations/media/tasks'){
    const id=u.searchParams.get('projectId')||'';
    if(id)getProject(id); // reject arbitrary/unowned project IDs
    return send(res,200,integrations.listTasks(id));
  }
  if(req.method==='GET'&&u.pathname==='/api/integrations/media/artifacts'){
    const id=u.searchParams.get('projectId')||'';getProject(id);return send(res,200,integrations.listArtifacts(id));
  }
  if(req.method==='POST'&&u.pathname==='/api/integrations/media/demo')return send(res,200,integrations.demoSample());
  if(req.method==='POST'&&u.pathname==='/api/integrations/media/tasks'){
    const payload=await readBody(req);getProject(payload.projectId);
    return send(res,200,integrations.submit(payload));
  }
  const mediaAction=u.pathname.match(/^\/api\/integrations\/media\/tasks\/([a-f0-9-]{36})\/(approve|pause|resume|cancel|retry)$/);
  if(mediaAction&&req.method==='POST')return send(res,200,integrations.action(mediaAction[1],mediaAction[2]));
  if(req.method==='POST'&&u.pathname==='/api/integrations/media/upload'){
    const filename=decodeURIComponent(String(req.headers['x-media-filename']||'upload.mp4'));
    return send(res,200,await integrations.importUpload(req,filename));
  }
  const mediaArtifact=u.pathname.match(/^\/api\/integrations\/media\/artifacts\/([a-f0-9-]{36})$/);
  if(mediaArtifact&&['GET','HEAD'].includes(req.method)){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Đã khóa Vault. Mở lại để xem tệp sản phẩm.'});
    const art=integrations.artifact(mediaArtifact[1]);
    const ext=path.extname(art.metadata.name).toLowerCase();
    const types={'.mp4':'video/mp4','.webm':'video/webm','.wav':'audio/wav','.mp3':'audio/mpeg','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.srt':'text/plain; charset=utf-8','.vtt':'text/vtt'};
    return sendArtifact(req,res,art,types[ext]||'application/octet-stream');
  }
  if(req.method==='GET'&&u.pathname==='/api/system/tts/config'){
    const c=findServiceCredential('heygen_tts');
    return send(res,200,{vault:vaultStatus().unlocked,configured:!!c?.secret,voiceId:c?.voiceId||'',envConfigured:!!process.env.HEYGEN_API_KEY});
  }
  if(req.method==='POST'&&u.pathname==='/api/system/tts/config'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Hãy mở kho Vault trước khi lưu khóa HeyGen.'});
    const body=await readBody(req);const voiceId=String(body.voiceId||'').trim();
    if(voiceId&&!/^[a-zA-Z0-9_-]{6,90}$/.test(voiceId))return send(res,400,{error:'Voice ID chỉ gồm chữ, số, dấu gạch 6–90 ký tự.'});
    const apiKey=String(body.apiKey||'').trim();
    if(apiKey&&(apiKey.length<12||apiKey.length>2000))return send(res,400,{error:'API key có độ dài không hợp lệ.'});
    if(!apiKey&&!findServiceCredential('heygen_tts')?.secret)return send(res,400,{error:'Cần nhập API key cho lần đầu.'});
    const saved=saveConnection({id:'aios-heygen-tts',kind:'other',name:'HeyGen TTS (Media Studio)',secret:apiKey,model:voiceId,meta:{keyType:'heygen_tts'}});
    return send(res,200,{saved:true,configured:saved.hasSecret,voiceId:saved.model});
  }
  if(req.method==='DELETE'&&u.pathname==='/api/system/tts/config'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Hãy mở kho Vault để xóa cấu hình HeyGen.'});
    deleteConnection('aios-heygen-tts');return send(res,200,{ok:true});
  }
  if(req.method==='GET'&&u.pathname==='/api/system/tts/fpt/config'){
    const c=findServiceCredential('fpt_tts');
    return send(res,200,{vault:vaultStatus().unlocked,configured:!!c?.secret,voiceId:c?.voiceId||'',envConfigured:!!process.env.FPT_AI_API_KEY,voices:[{id:'banmai',name:'Ban Mai — nữ, miền Bắc'},{id:'lannhi',name:'Lan Nhi — nữ, miền Nam'},{id:'leminh',name:'Lê Minh — nam, miền Bắc'},{id:'giahuy',name:'Gia Huy — nam, miền Nam'},{id:'myan',name:'Mỹ An — nữ, miền Trung'},{id:'thuminh',name:'Thu Minh — nữ, miền Bắc'},{id:'linhsan',name:'Linh San — nữ, miền Nam'}]});
  }
  if(req.method==='POST'&&u.pathname==='/api/system/tts/fpt/config'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Hãy mở kho Vault trước khi lưu khóa FPT.AI.'});
    const body=await readBody(req);const voiceId=String(body.voiceId||'').trim().toLowerCase();
    if(voiceId&&!['banmai','lannhi','leminh','giahuy','myan','thuminh','linhsan'].includes(voiceId))return send(res,400,{error:'Giọng FPT.AI không hợp lệ.'});
    const apiKey=String(body.apiKey||'').trim();
    if(apiKey&&(apiKey.length<12||apiKey.length>2000))return send(res,400,{error:'API key có độ dài không hợp lệ.'});
    if(!apiKey&&!findServiceCredential('fpt_tts')?.secret)return send(res,400,{error:'Cần nhập API key FPT.AI cho lần đầu.'});
    const saved=saveConnection({id:'aios-fpt-tts',kind:'other',name:'FPT.AI TTS (Media Studio)',secret:apiKey,model:voiceId,meta:{keyType:'fpt_tts'}});
    return send(res,200,{saved:true,configured:saved.hasSecret,voiceId:saved.model});
  }
  if(req.method==='DELETE'&&u.pathname==='/api/system/tts/fpt/config'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Hãy mở kho Vault để xóa cấu hình FPT.AI.'});
    deleteConnection('aios-fpt-tts');return send(res,200,{ok:true});
  }
  if(req.method==='GET'&&u.pathname==='/api/system/readiness'){
    const status=integrations.status();
    return send(res,200,{version:VERSION,platform:process.platform,node:process.version,
      localOnly:true,dataDir:DATA_DIR,backupDir:BACKUP_DIR,
      installed:{core:status.core.status==='active',git:spawnSync('git',['--version'],{timeout:2000,windowsHide:true}).status===0,ffmpeg:!!status.media.ffmpeg,ffprobe:!!status.media.ffprobe,
        heygenTtsConfigured:status.media.ttsProvider==='heygen'},
      caveats:['TTS HeyGen chỉ hoạt động khi API key và quyền sử dụng thật hợp lệ.',
        'AI video điện ảnh, STT và tự đăng mạng xã hội chưa được kích hoạt.'],backupInProgress:backingUp});
  }
  if(req.method==='POST'&&u.pathname==='/api/system/doctor')return send(res,200,systemDoctor({integrationsStatus:integrations.status()}));
  if(req.method==='GET'&&u.pathname==='/api/system/backups')return send(res,200,listBackups());
  if(req.method==='GET'&&u.pathname.startsWith('/api/system/backups/')){
    const name=decodeURIComponent(u.pathname.slice('/api/system/backups/'.length));
    const file=backupFileByName(name);const size=fs.statSync(file).size;
    res.writeHead(200,{'content-type':'application/octet-stream','content-length':size,
      'cache-control':'no-store','x-content-type-options':'nosniff',
      'content-disposition':`attachment; filename="${name}"`});
    fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);return;
  }
  if(req.method==='POST'&&u.pathname==='/api/system/backup'){
    if(backingUp)return send(res,409,{error:'Một bản sao lưu đang được tạo.'});
    const active=(integrations.listTasks?.()||[]).some(t=>['queued','running','review','pending-execution','executing'].includes(t.state||t.status));
    const nativeActive=listProjects().some(p=>(p.tasks||[]).some(t=>['running','preparing','testing','merging','repairing'].includes(t.status)));
    if(active||nativeActive)return send(res,409,{error:'Hãy chờ tác vụ hoàn thành trước khi sao lưu.'});
    const body=await readBody(req);backingUp=true;
    try {return send(res,200,await createEncryptedBackup({password:body.password}));}
    finally{backingUp=false;}
  }

  if(req.method==='GET'&&u.pathname==='/api/system/prerequisites')return send(res,200,await systemPrerequisites());
  if(req.method==='GET'&&u.pathname==='/api/system/prerequisite-versions')return send(res,200,await systemPrerequisiteVersions());
  if(req.method==='GET'&&u.pathname==='/api/system/sandbox')return send(res,200,await sandboxStatus());
  if(req.method==='GET'&&u.pathname==='/api/skills')return send(res,200,listSkills());
  if(req.method==='POST'&&u.pathname==='/api/skills')return send(res,200,saveCustomSkill(await readBody(req)));
  if(req.method==='GET'&&u.pathname==='/api/skills/mapping')return send(res,200,sampleSkillMapping(u.searchParams.get('sample')||'mvp'));
  if(req.method==='POST'&&u.pathname==='/api/skills/import')return send(res,200,importSkillUpload(await readBody(req)));
  if(req.method==='POST'&&u.pathname==='/api/skills/import-repo'){const b=await readBody(req);return send(res,200,b.url?await importRepoGit(b):importRepoZip(b));}
  if(req.method==='GET'&&u.pathname==='/api/skills/imported-repos')return send(res,200,{repos:listImportedRepos()});
  if(req.method==='DELETE'&&u.pathname.match(/^\/api\/skills\/imported-repos\/[^/]+$/))return send(res,200,deleteImportedRepo(decodeURIComponent(u.pathname.split('/')[4])));
  if(u.pathname.match(/^\/api\/skills\/[^/]+$/)){
    const id=decodeURIComponent(u.pathname.split('/')[3]);
    if(req.method==='PATCH'){const body=await readBody(req);if(Object.keys(body).length!==1||!Object.hasOwn(body,'enabled'))throw new Error('Chỉ cập nhật enabled bằng PATCH.');return send(res,200,setSkillEnabled(id,body.enabled));}
    if(req.method==='PUT')return send(res,200,saveCustomSkill(await readBody(req),{updateId:id}));
    if(req.method==='DELETE')return send(res,200,deleteCustomSkill(id));
  }
  if(req.method==='GET'&&u.pathname==='/api/engines/diagnostics')return send(res,200,await engineDiagnostics());
  if(req.method==='GET'&&u.pathname==='/api/engines/custom')return send(res,200,listCustomEngines());
  if(req.method==='POST'&&u.pathname==='/api/engines/custom')return send(res,200,saveCustomEngine(await readBody(req)));
  if(u.pathname.match(/^\/api\/engines\/custom\/[^/]+$/)){const id=decodeURIComponent(u.pathname.split('/')[4]);if(req.method==='PUT')return send(res,200,saveCustomEngine(await readBody(req),{updateId:id}));if(req.method==='DELETE')return send(res,200,deleteCustomEngine(id));}
  if(req.method==='GET'&&u.pathname==='/api/engines')return send(res,200,await engineStatuses());
  if(req.method==='POST'&&u.pathname==='/api/engines/opencode/install-runtime'){try{return send(res,200,{...await installOpencode(),installing:false});}catch(e){return send(res,409,{error:e.message,installing:opencodeInstalling()});}}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/engines\/[^/]+\/install$/)){const id=decodeURIComponent(u.pathname.split('/')[3]);return send(res,200,await installEngineSource(id));}
  if(req.method==='GET'&&u.pathname==='/api/local-workers')return send(res,200,await localWorkers.list());
  if(req.method==='POST'&&u.pathname.match(/^\/api\/local-workers\/[^/]+\/install$/)){const id=decodeURIComponent(u.pathname.split('/')[3]);return send(res,200,await localWorkers.startInstall(id));}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/local-workers\/[^/]+\/remove$/)){const id=decodeURIComponent(u.pathname.split('/')[3]);return send(res,200,await localWorkers.remove(id));}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/local-workers\/[^/]+\/enabled$/)){const id=decodeURIComponent(u.pathname.split('/')[3]);const b=await readBody(req);return send(res,200,await localWorkers.setEnabled(id,Boolean(b.enabled)));}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/local-workers\/[^/]+\/adopt-external$/)){const id=decodeURIComponent(u.pathname.split('/')[3]);return send(res,200,await localWorkers.adoptExternal(id));}

  if(req.method==='GET'&&u.pathname==='/api/vault')return send(res,200,vaultStatus());
  if(req.method==='POST'&&u.pathname==='/api/vault/unlock')return send(res,200,unlockVault((await readBody(req)).password));
  if(req.method==='POST'&&u.pathname==='/api/vault/lock'){lockVault();return send(res,200,{ok:true});}
  if(req.method==='GET'&&u.pathname==='/api/antigravity/status')return send(res,200,antigravityStatus());
  if(req.method==='POST'&&u.pathname==='/api/antigravity/install')return send(res,200,await installAntigravityWindows());
  if(req.method==='POST'&&u.pathname==='/api/antigravity/login')return send(res,200,await openAntigravityLogin({id:(await readBody(req)).id}));
  if(req.method==='POST'&&u.pathname==='/api/antigravity/connect')return send(res,200,createAntigravityAccount((await readBody(req)).name));
  if(req.method==='GET'&&/^\/api\/antigravity\/[a-f0-9-]{36}\/models$/.test(u.pathname))return send(res,200,await listAntigravityModels(u.pathname.split('/')[3]));
  if(req.method==='POST'&&/^\/api\/antigravity\/[a-f0-9-]{36}\/verify$/.test(u.pathname))return send(res,200,await verifyAntigravityModel(u.pathname.split('/')[3],(await readBody(req)).model));
  if(req.method==='GET'&&u.pathname==='/api/ai-tools')return send(res,200,cliToolsStatus());
  if(req.method==='POST'&&/^\/api\/ai-tools\/(codex|claude|gemini)\/install$/.test(u.pathname))return send(res,200,await installManagedCli(u.pathname.split('/')[3]));
  if(req.method==='GET'&&u.pathname==='/api/media/kokoro')return send(res,200,{...kokoroStatus(),installing:kokoroInstalling()});
  if(req.method==='POST'&&u.pathname==='/api/media/kokoro/install'){try{return send(res,200,{...await kokoroInstall(),installing:false});}catch(e){return send(res,409,{error:e.message,installing:kokoroInstalling()});}}
  if(req.method==='POST'&&/^\/api\/cli-accounts\/(claude|gemini)\/connect$/.test(u.pathname)){const kind=u.pathname.split('/')[3];return send(res,200,createCliAccount(kind,(await readBody(req)).name));}
  if(req.method==='POST'&&/^\/api\/cli-accounts\/(claude|gemini)\/login$/.test(u.pathname))return send(res,200,await startCliLoginWindow(u.pathname.split('/')[3],{id:(await readBody(req)).id}));
  if(req.method==='GET'&&u.pathname==='/api/infra-accounts/status')return send(res,200,{tools:infraToolsStatus()});
  if(req.method==='POST'&&/^\/api\/infra-accounts\/(github|vercel|supabase)\/install$/.test(u.pathname))return send(res,200,await installInfraTool(u.pathname.split('/')[3]));
  if(req.method==='POST'&&/^\/api\/infra-accounts\/(github|vercel|supabase)\/login$/.test(u.pathname))return send(res,200,await startInfraLoginWindow(u.pathname.split('/')[3]));
  if(req.method==='GET'&&/^\/api\/cli-accounts\/[a-f0-9-]{36}\/status$/.test(u.pathname))return send(res,200,cliAccountStatus(u.pathname.split('/')[3]));
  if(req.method==='POST'&&/^\/api\/cli-accounts\/[a-f0-9-]{36}\/verify$/.test(u.pathname))return send(res,200,await verifyCliAccountModel(u.pathname.split('/')[3],(await readBody(req)).model));
  if(req.method==='GET'&&u.pathname==='/api/connections')return send(res,200,listConnections().map(c=>({...c,availability:c.kind==='chatgpt_account'?accountAvailability(c.id):AI_KINDS.includes(c.kind)?modelAvailability(c.id):undefined,usage:AI_KINDS.includes(c.kind)||c.kind==='chatgpt_account'?usageSummary(c.id):undefined,pool:AI_KINDS.includes(c.kind)?poolInfoFor(c.id):undefined})));
  if(req.method==='POST'&&u.pathname==='/api/accounts/login')return send(res,200,await startAccountLogin(await readBody(req)));
  if(u.pathname.match(/^\/api\/accounts\/[^/]+\/(status|usage|cancel|logout|verify)$/)){const [, , , id,action]=u.pathname.split('/');const key=decodeURIComponent(id);if(req.method==='POST'&&action==='verify')return send(res,200,await verifyAccountModel(key,(await readBody(req)).model));if(req.method==='GET'&&action==='status')return send(res,200,await refreshAccount(key));if(req.method==='GET'&&action==='usage')return send(res,200,await readAccountUsage(key));if(req.method==='POST'&&action==='cancel')return send(res,200,await cancelAccountLogin(key));if(req.method==='POST'&&action==='logout')return send(res,200,await logoutAccount(key));}
  if(req.method==='POST'&&u.pathname==='/api/connections'){const input=await readBody(req);if(['chatgpt_account','claude_account','gemini_account','antigravity_account'].includes(input.kind))throw new Error('Dùng quy trình đăng nhập tài khoản chính thức.');const old=input.id?listConnections().find(c=>c.id===input.id):null;const rawMeta=(input.meta&&typeof input.meta==='object')?input.meta:{};input.meta={management:input.kind==='supabase'&&input.meta?.management===true,...(old?.meta?.authMode==='cli'&&!input.secret?{authMode:'cli'}:{authMode:'pat'})};if(PLATFORM_KINDS.includes(input.kind)){input.meta={...(old?.meta||{})};for(const k of ['pageId','pageName','accountLabel','channelTitle','channelId','pages','username','tiktokApproved','linkedAt'])if(rawMeta[k]!==undefined)input.meta[k]=rawMeta[k];}const c=saveConnection(input);if(AI_KINDS.includes(c.kind)){await listModels(c.id);}else await testConnection(c.id);return send(res,200,c);}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/connections\/cli\/[^/]+$/)){const kind=decodeURIComponent(u.pathname.split('/').pop());const c=await connectCli(kind);await testConnection(c.id);return send(res,200,c);}
  if(req.method==='GET'&&u.pathname.match(/^\/api\/supabase\/[^/]+\/projects$/)){const id=decodeURIComponent(u.pathname.split('/')[3]);return send(res,200,await listSupabaseProjects(id));}
  if(req.method==='POST'&&u.pathname==='/api/supabase/create'){return send(res,200,await createSupabaseProject(await readBody(req)));}
  if(req.method==='POST'&&u.pathname==='/api/supabase/attach'){return send(res,200,await attachSupabaseProject(await readBody(req)));}
  if(req.method==='GET'&&u.pathname==='/api/supabase/password')return send(res,200,{password:generateDbPassword()});
  if(req.method==='DELETE'&&u.pathname.startsWith('/api/connections/')){const id=decodeURIComponent(u.pathname.split('/').pop());const kind=listConnections().find(c=>c.id===id)?.kind;if(kind==='chatgpt_account')await deleteAccountProfile(id);if(['claude_account','gemini_account'].includes(kind))removeCliAccount(id);if(kind==='antigravity_account')removeAntigravityAccount(id);deleteConnection(id);invalidateModels(id);return send(res,200,{ok:true});}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/connections\/[^/]+\/model$/)){const id=decodeURIComponent(u.pathname.split('/')[3]),b=verifiedBinding({connectionId:id,model:(await readBody(req)).model});const c=listConnections().find(x=>x.id===id);return send(res,200,saveConnection({...c,model:b.model}));}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/connections\/[^/]+\/name$/)){const id=decodeURIComponent(u.pathname.split('/')[3]);const b=await readBody(req);return send(res,200,renameConnection(id,b.name));}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/connections\/[^/]+\/effort$/)){const id=decodeURIComponent(u.pathname.split('/')[3]),b=await readBody(req);const c=listConnections().find(x=>x.id===id);if(!c)throw new Error('Không tìm thấy kết nối.');if(!['chatgpt_account','claude_account'].includes(c.kind))throw new Error('Loại tài khoản này chưa hỗ trợ chỉnh mức suy luận.');const eff=String(b.effort||'');const allowed=c.kind==='chatgpt_account'?['','minimal','low','medium','high','xhigh','max']:['','low','medium','high','xhigh','max'];if(!allowed.includes(eff))throw new Error('Mức suy luận không hợp lệ với tài khoản này.');const meta={...(c.meta||{})};if(eff)meta.reasoningEffort=eff;else delete meta.reasoningEffort;return send(res,200,saveConnection({...c,meta}));}
  if(req.method==='POST'&&u.pathname.match(/^\/api\/connections\/[^/]+\/test$/)){const id=u.pathname.split('/')[3];return send(res,200,await testConnection(id));}
  if(req.method==='GET'&&u.pathname.match(/^\/api\/connections\/[^/]+\/models$/)){const id=u.pathname.split('/')[3];return send(res,200,await listModels(id));}

  if(req.method==='GET'&&u.pathname==='/api/projects')return send(res,200,listProjects());
  if(req.method==='POST'&&u.pathname==='/api/projects')return send(res,200,createProject(await readBody(req)));
  if(u.pathname==='/api/launch/options'&&req.method==='POST'){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Open Vault first.',code:'LAUNCH_VAULT_LOCKED'});
    return send(res,200,await deliveryLaunch.options(await readBody(req)));
  }
  const rp=routeProject(u.pathname);
  if(rp&&rp.action.startsWith('launch')){
    if(!vaultStatus().unlocked)return send(res,423,{error:'Open Vault first.',code:'LAUNCH_VAULT_LOCKED'});
    const launchProject=getProject(rp.id);
    if(req.method==='POST'&&launchProject.productionRequest)return send(res,409,{error:'Use the media reception for this project, not the web deployment workflow.',code:'WORK_PRODUCT_TYPE'});
    if(req.method==='POST'&&workCenter.isActive(rp.id)&&!rp.action.endsWith('/stop'))return send(res,409,{error:'Reception work is still running for this project.',code:'WORK_ACTIVE'});
    if(rp.action==='launch'&&req.method==='GET')return send(res,200,deliveryLaunch.getForProject(rp.id));
    if(rp.action==='launch'&&req.method==='POST')return send(res,202,deliveryLaunch.create(rp.id,await readBody(req)));
    const m=rp.action.match(/^launch\/(run-[a-f0-9-]{36})\/(approve|resume|stop|artifact\/(source\.zip|qr\.svg))$/);
    if(m){const run=deliveryLaunch.get(m[1]);if(run.projectId!==rp.id)return send(res,404,{error:'Delivery run not found for this project.'});
      if(req.method==='POST'&&['approve','resume','stop'].includes(m[2]))return send(res,202,deliveryLaunch[m[2]](m[1],await readBody(req)));
      if(req.method==='GET'&&m[3]){const a=deliveryLaunch.artifact(m[1],m[3]);res.setHeader('Content-Disposition',(m[3]==='qr.svg'?'inline':'attachment')+'; filename="'+m[3]+'"');return send(res,200,a.bytes,a.mime);}
    }
  }
  if(rp&&req.method==='GET'&&rp.action==='map')return send(res,200,projectMapSnapshot(rp.id));
  if(rp&&req.method==='GET'&&rp.action==='map/export')return send(res,200,exportMapSvg(projectMapSnapshot(rp.id)),'image/svg+xml; charset=utf-8');
  if(rp&&req.method==='GET'&&rp.action==='')return send(res,200,getProject(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='brief'){
   const project=getProject(rp.id);if(project.approvedSpecificationId)return send(res,409,{error:'Yeu cau da duyet. Trao doi them khong sua ngam pham vi; tao du an moi cho yeu cau thay doi.',code:'BRIEF_APPROVED'});
   if(workCenter.isActive(rp.id)||deliveryLaunch.isActive(rp.id))return send(res,409,{error:'Project work is running.',code:'WORK_ACTIVE'});
   return send(res,200,updateProjectBrief(rp.id,await readBody(req)));
  }
  if(rp&&req.method==='GET'&&rp.action==='dispatch')return send(res,200,dispatchStatus(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='accept-work')return send(res,200,await acceptProjectWork(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='chat/clear')return send(res,200,clearFounderChat(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='analyze-idea')return send(res,200,await analyzeIdea(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='send-council')return send(res,200,sendBriefToCouncil(rp.id));
  if(rp&&req.method==='GET'&&rp.action==='model-roles')return send(res,200,projectModelRoles(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='model-roles'){
   if(workCenter.isActive(rp.id)||deliveryLaunch.isActive(rp.id))return send(res,409,{error:'Wait for active work before changing assigned accounts.',code:'WORK_ACTIVE'});
   return send(res,200,updateProjectModelRoles(rp.id,await readBody(req)));
  }
  if(rp&&req.method==='GET'&&rp.action==='workspace')return send(res,200,snapshot(rp.id));
  if(rp&&req.method==='GET'&&rp.action==='workspace-summary')return send(res,200,workspaceSummary(rp.id));
  if(rp&&req.method==='GET'&&rp.action==='git')return send(res,200,await gitStatus(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='git/init')return send(res,200,await initGit(rp.id));
  if(req.method==='GET'&&u.pathname==='/api/github/repos')return send(res,200,await listGithubRepos());
  if(u.pathname==='/api/github/import-jobs'){if(!vaultStatus().unlocked)return send(res,423,{error:'Mở Vault trước khi nhập repo.'});if(req.method==='GET')return send(res,200,{jobs:githubImportJobs.list()});if(req.method==='POST')return send(res,202,{job:githubImportJobs.start(await readBody(req))});}
  if(req.method==='POST'&&u.pathname==='/api/github/import'){const b=await readBody(req);return send(res,200,await importGithubRepo({fullName:b.fullName,vercelProject:b.vercelProject}));}
  if(rp&&req.method==='POST'&&rp.action==='github/continuation')return send(res,200,await buildContinuationPlan(rp.id));
  if(rp&&req.method==='GET'&&rp.action==='github/issues')return send(res,200,await listGithubIssues(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='github/issue-brief'){const b=await readBody(req);return send(res,200,await useGithubIssueAsBrief(rp.id,{number:b.number}));}
  if(rp&&req.method==='POST'&&rp.action==='github/pull-request'){const b=await readBody(req).catch(()=>({}));return send(res,200,await createGithubPullRequest(rp.id,{title:b.title}));}
  if(rp&&req.method==='POST'&&rp.action==='github/publish'){const b=await readBody(req);return send(res,200,await publishGitHub({projectId:rp.id,...b}));}
  if(rp&&req.method==='POST'&&rp.action==='vercel/deploy'){const b=await readBody(req);return send(res,200,await deployVercel({projectId:rp.id,...b}));}
  if(rp&&req.method==='POST'&&rp.action==='vercel/domain'){const b=await readBody(req);const result=await attachVercelDomain(b);saveProjectDomain(rp.id,{domain:result.domain,deploymentUrl:String(b.deploymentUrl)});return send(res,200,result);}
  if(rp&&req.method==='POST'&&rp.action==='settings')return send(res,200,updateProjectSettings(rp.id,await readBody(req)));
  if(rp&&req.method==='POST'&&rp.action==='chat'){const b=await readBody(req);return send(res,200,{reply:await founderChat(rp.id,b.connectionId,b.message,{retryMessageId:b.retryMessageId||null,evidenceLoader:message=>prepareNewsEvidence(message,ingestStore)})});}
  if(rp&&req.method==='POST'&&rp.action==='council'){const b=await readBody(req);return send(res,200,await runCouncil(rp.id,b.memberIds||[],b.chairId));}
  if(rp&&req.method==='GET'&&rp.action==='council/history')return send(res,200,councilHistory(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='council/confirm')return send(res,200,confirmCouncilSpecification(rp.id,(await readBody(req)).specificationId));
  if(rp&&req.method==='POST'&&rp.action==='analyze-stack'){const b=await readBody(req);return send(res,200,await analyzeStack(rp.id,b.connectionId));}
  if(rp&&req.method==='POST'&&rp.action==='plan'){const b=await readBody(req);return send(res,200,{tasks:await buildPlan(rp.id,b.managerId)});}
  if(rp&&req.method==='POST'&&rp.action==='tasks')return send(res,200,createTask(rp.id,await readBody(req)));
  if(rp&&req.method==='PATCH'&&/^tasks\/T[1-9]\d{0,3}$/.test(rp.action))return send(res,200,updateTask(rp.id,rp.action.split('/')[1],await readBody(req)));
  if(rp&&req.method==='DELETE'&&/^tasks\/T[1-9]\d{0,3}$/.test(rp.action))return send(res,200,archiveTask(rp.id,rp.action.split('/')[1]));
  if(rp&&req.method==='GET'&&rp.action==='ready-tasks')return send(res,200,readyTasks(rp.id));
  if(rp&&req.method==='POST'&&rp.action==='run-task'){const b=await readBody(req);return send(res,200,await runTask(rp.id,b.taskId,b.workerId,b.reviewerId,b.engineId));}
  if(rp&&req.method==='POST'&&rp.action==='run-ready'){const b=await readBody(req);return send(res,200,await runReadyBatch(rp.id,b));}

  if(req.method==='GET'){
    const rel=u.pathname==='/'?'index.html':u.pathname.slice(1);const p=path.resolve(PUB,rel);
    if(p===path.join(PUB,'index.html')||p.startsWith(PUB+path.sep)){if(fs.existsSync(p)&&fs.statSync(p).isFile())return send(res,200,(p===path.join(PUB,'index.html')?fs.readFileSync(p,'utf8').replace(/<!-- TAB:([a-z]+) -->/g,(_,tab)=>fs.readFileSync(path.join(PUB,'tabs',tab+'.html'),'utf8').replace('<!-- TAB:media-studio -->',fs.readFileSync(path.join(PUB,'tabs','media-studio.html'),'utf8'))):fs.readFileSync(p)),mime[path.extname(p)]||'application/octet-stream');}
  }
  return send(res,404,{error:'Not found'});
}catch(e){const code=typeof e?.code==='string'&&/^[A-Z][A-Z0-9_]{2,70}$/.test(e.code)?e.code:null;return send(res,code==='ORCHESTRATOR_INPUT'?422:code==='AI_DISPATCH_EXHAUSTED'?503:code==='LAUNCH_STORE'?503:code==='LAUNCH_VAULT_LOCKED'?423:code==='LAUNCH_NOT_FOUND'?404:code==='LAUNCH_CONFIG'?422:code?.startsWith('LAUNCH_')?409:500,{error:redactVaultSecrets(e?.message||e),code,retryAt:e?.retryAt||null});}});
server.on('error',e=>{if(e?.code==='EADDRINUSE'){console.error(`Port ${PORT} đang được dùng. Đóng phiên AI Project OS cũ hoặc ứng dụng đang chiếm cổng rồi chạy lại.`);process.exitCode=1;return;}console.error(e);process.exitCode=1;});
server.on('close',()=>{workCenter.close();deliveryLaunch.close();localAccess.discard();closeAccountSessions();integrations.stop();});
process.once('SIGTERM',()=>{closeAccountSessions();server.close();});
process.once('SIGINT',()=>{closeAccountSessions();server.close();});
server.listen(PORT,HOST,()=>{localAccess.expose();console.log(`AI Project OS Local v${VERSION}: http://${HOST}:${PORT} (access via launcher)`);});
const orchestratorTimer=setInterval(()=>{orchestrator.tick().catch(e=>console.warn('Orchestrator tick:',e.message));},60000);
orchestratorTimer.unref();
