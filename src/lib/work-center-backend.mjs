import {assertCodeExecution} from './work-code-preflight.mjs';
import {getProject,projectModelRoles,acceptProjectWork,confirmCouncilSpecification,updateProjectSettings} from './projects.mjs';
import {currentSpecification,approvedSpecification} from './council-spec.mjs';
import {ensureProjectTeam} from './project-team.mjs';
import {vaultStatus} from './vault.mjs';
import {assertProductionReady,productionCapabilities,automaticProductionPlan} from './production-preflight.mjs';
const fail=(code,message)=>Object.assign(new Error(message),{code});
export function createWorkBackend({host,orchestrator,delivery}){
 function access(){if(!vaultStatus().unlocked)throw fail('VAULT_LOCKED','Mo Vault de giao viec.');}
 const related=(p,input)=>{const r=orchestrator.getRun(String(input.runId||''));if(!r||r.projectId!==p.id)throw fail('WORK_RUN','Luot san pham khong thuoc du an.');return r;};
 return {
  async validate(id,action,input){access();const p=getProject(id);
   if(delivery.isActive(id))throw fail('WORK_DELIVERY_BUSY','Luot ban giao web dang chay; theo doi ngay trong muc Cloud.');
   if(['produce','approve','run'].includes(action)&&input.confirm!==true)throw fail('WORK_CONSENT','Can chot yeu cau va dong y dung han muc AI truoc khi thuc hien.');
   if(action==='approve'){const spec=currentSpecification(p);if(!spec||spec.id!==input.specificationId)throw fail('WORK_STALE_SPEC','Yeu cau da thay doi; doc va duyet lai.');}
   if(action==='run')approvedSpecification(p);
   if(['approve','run'].includes(action))await assertCodeExecution({mode:input.testMode||p.settings?.sandboxMode,confirmHost:input.confirmHost===true});
   if(['produce','auto-produce'].includes(action)){
    if(!p.productionRequest)throw fail('WORK_INPUT','Chon tin/loai san pham truoc khi giao viec.');
    if(p.productionRequest.id!==input.requestId)throw fail('WORK_STALE_INPUT','Dau vao san pham da thay doi.');
    if(!['news-article','client-article'].includes(p.productionRequest.pipeline))host.refreshProductionStatus?.();
    if(action==='auto-produce'){
      if(input.fromReception!==true)throw fail('WORK_CONSENT','Chỉ nhận lệnh tự động từ thao tác chọn tin/làm việc rõ ràng.');
      const plan=automaticProductionPlan(host,p.productionRequest.pipeline,{imageSources:input.imageSources||[]});
      input.resolvedPlan=plan;
      if(plan.kind==='video'){
        assertProductionReady(host,p.productionRequest.pipeline,plan);
        await host.prepareProduction(plan); // probes genuine Concat RPC before image/TTS charges
      }
    } else assertProductionReady(host,p.productionRequest.pipeline,input);
    if(orchestrator.getConfig().pipelines[p.productionRequest.pipeline]?.aiMode==='simulated')throw fail('WORK_SIMULATED','Tat che do AI mo phong trong workflow truoc khi lam san pham that.');
   }
   if(['retry-media','receive'].includes(action))related(p,input);
  },
  async execute(id,action,input){access();let p=getProject(id);
   if(['prepare','produce','auto-produce','approve','run'].includes(action))p=ensureProjectTeam(id);
   if(action==='prepare'&&p.productionRequest)return {stage:'awaiting-media-approval',requestId:p.productionRequest.id,roles:projectModelRoles(id)};
   if(action==='prepare'){
    // Analysis must never become a code-execution backdoor on an approved project.
    if(p.approvedSpecificationId)return {stage:'awaiting-execution-confirmation',specificationId:p.approvedSpecificationId};
    return acceptProjectWork(id);
   }
   if(['approve','run'].includes(action)){
    updateProjectSettings(id,{sandboxMode:input.testMode||p.settings.sandboxMode,reviewRequired:true});
    if(action==='approve')confirmCouncilSpecification(id,input.specificationId);
    const result=await acceptProjectWork(id);
    if(result.ok===false)throw fail('WORK_TASKS_INCOMPLETE','Con task chua hoan tat. Xem loi va ket qua test tai danh sach cong viec; khong coi la san pham da xong.');
    return result;
   }
   if(['produce','auto-produce'].includes(action)){
    const r=p.productionRequest,c=productionCapabilities(host),choice=action==='auto-produce'?input.resolvedPlan:input;
    const previous=action==='auto-produce'?orchestrator.listRuns().find(x=>x.projectId===id&&x.requestId===r.id&&x.state==='failed'):null;
    const run=previous?await orchestrator.retryRun(previous.id):await orchestrator.startRun(r.pipeline,{projectId:id,requestId:r.id,cardId:r.cardId,title:r.title,ideaText:r.ideaText,voiceMode:choice.voiceMode||'narrated',ttsProvider:choice.ttsProvider||c.defaultVoice||'local',confirmPaidVoice:choice.confirmPaidVoice===true,visualMode:choice.visualMode,imageProvider:choice.imageProvider,imageSources:choice.imageSources,imagePool:choice.imagePool,visualStyle:choice.visualStyle,confirmImageQuota:choice.confirmImageQuota===true,confirmPaidImages:choice.confirmPaidImages===true,renderEngine:choice.renderEngine||'concat',effects:choice.effects||'gentle',voice:choice.voice,requireReview:true,deliverOnly:true});
    if(run.state==='failed')throw fail(run.error?.code||'WORK_PRODUCTION',run.error?.message||'San xuat that bai.');
    // Reception only delivers files locally. Do not leave another approval button
    // on an already quality-gated MP4, and never publish on behalf of the user.
    const delivered=action==='auto-produce'&&run.state==='awaiting-approval'?orchestrator.receiveRun(run.id):run;
    return {stage:'product-ready',runId:delivered.id,state:delivered.state,published:false,engine:delivered.renderEngine||choice.renderEngine||null,voiceProvider:delivered.ttsProvider||choice.ttsProvider||null,note:choice.note||null};
   }
   if(action==='retry-media'){const r=related(p,input);const run=await orchestrator.retryRun(r.id);if(run.state==='failed')throw fail(run.error?.code||'WORK_PRODUCTION',run.error?.message||'San xuat that bai.');return {stage:'product-ready',runId:run.id,state:run.state};}
   if(action==='receive'){const run=orchestrator.receiveRun(related(p,input).id);return {stage:'received-locally',runId:run.id,published:false};}
   throw fail('WORK_ACTION','Thao tac khong ho tro.');
  }
 };
}
