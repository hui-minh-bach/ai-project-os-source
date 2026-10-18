import crypto from 'node:crypto';
import { readJson, writeJson } from './store.mjs';
import { ask } from './providers.mjs';
import { projectBriefInput, briefContext, normalizeIdeaStack, normalizeAnalyzedBrief, IDEA_BRIEF_SCHEMA } from './idea-brief.mjs';
import { MODEL_ROLES, verifiedBinding, projectRoleTarget, roleRef, roleDescriptors, resolveBinding } from './model-bindings.mjs';
import { getConnection, redactVaultSecrets, createVaultSecretRedactor } from './vault.mjs';
import { COUNCIL_MEMBER_SCHEMA, COUNCIL_CHAIR_SCHEMA, parseCouncilJson, normalizeCouncilMember, normalizeCouncilChair, councilConsensus, currentCouncilBrief, councilBriefFingerprint, currentSpecification, approvedSpecification, specificationText } from './council-spec.mjs';
import { suggestSkillsForRole, skillPrompt } from './skills.mjs';
import { runNativeTask, reviewNativeTask, runTaskTests } from './native-agent.mjs';
import { runExternalTask } from './external-agents.mjs';
import { createTaskWorktree, commitTask, mergeTask, cleanupTaskWorktree, taskDiff, taskHead } from './task-git.mjs';

const FILE='projects.json';
const now=()=>new Date().toISOString();
const STARTABLE=new Set(['todo','failed','review','interrupted']);
const ACTIVE=new Set(['preparing','running','testing','repairing','reviewing','merging']);
const ROLES=new Set(['frontend','backend','database','design','qa','devops','research','security','architecture']);
const PRIORITIES=new Set(['low','medium','high','urgent']);
const TASK_ENGINES=new Set(['native','mini-swe-agent']);
const specificationCommitWindows=new Set();

const all=()=>readJson(FILE,[]);
const save=x=>writeJson(FILE,x);
export function listProjects(){return all();}
export function getProject(id){const p=all().find(x=>x.id===id);if(!p)throw new Error('Không tìm thấy dự án.');return p;}
function put(p){p.updatedAt=now();const a=all().filter(x=>x.id!==p.id);a.unshift(p);save(a);return p;}
function specificationState(p){return JSON.stringify([p.name,p.idea,p.productType,p.audience,p.goals,p.mainFeatures,p.briefRevision,p.analyzedBrief,p.councilBrief,p.currentCouncilRunId,p.currentSpecificationId,p.approvedSpecificationId,p.specifications]);}
function mutateProject(projectId,fn){const p=getProject(projectId),before=specificationCommitWindows.has(projectId)?specificationState(p):null;fn(p);if(before!==null&&before!==specificationState(p))throw new Error('Main đang commit kết quả task. Hãy chờ merge hoàn tất trước khi thay đổi brief/specification.');return put(p);}
function mutateTask(projectId,taskId,fn){return mutateProject(projectId,p=>{const task=p.tasks.find(x=>x.id===taskId);if(!task)throw new Error('Không tìm thấy task.');fn(task,p);});}

function settingsInput(input={},current={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Cấu hình dự án không hợp lệ.');
  const out={defaultEngine:'native',reviewRequired:true,sandboxMode:'safe',autoRepair:true,maxParallel:2,allowUnsafeExternal:false,...current};
  if('defaultEngine' in input){if(!TASK_ENGINES.has(input.defaultEngine))throw new Error('Engine chưa hỗ trợ thực thi task.');out.defaultEngine=input.defaultEngine;}
  if('reviewRequired' in input){if(typeof input.reviewRequired!=='boolean')throw new Error('reviewRequired cần boolean.');out.reviewRequired=input.reviewRequired;}
  if('sandboxMode' in input){const m=String(input.sandboxMode);if(!['safe','docker','host'].includes(m))throw new Error('Sandbox mode không hợp lệ.');out.sandboxMode=m;}
  if('autoRepair' in input){if(typeof input.autoRepair!=='boolean')throw new Error('autoRepair cần boolean.');out.autoRepair=input.autoRepair;}
  if('maxParallel' in input){if(!Number.isInteger(input.maxParallel)||input.maxParallel<1||input.maxParallel>4)throw new Error('maxParallel cần số nguyên từ 1 đến 4.');out.maxParallel=input.maxParallel;}
  if('allowUnsafeExternal' in input){if(typeof input.allowUnsafeExternal!=='boolean')throw new Error('allowUnsafeExternal cần boolean.');out.allowUnsafeExternal=input.allowUnsafeExternal;}
  return out;
}

export function createProject(input={}){
  const fields=projectBriefInput(input);
  const p={id:crypto.randomUUID(),...fields,briefRevision:0,analyzedBrief:null,createdAt:now(),updatedAt:now(),stage:'idea',messages:[],council:[],councilRuns:[],specifications:[],currentCouncilRunId:null,currentSpecificationId:null,approvedSpecificationId:null,finalSpec:'',stack:null,tasks:[],activity:[],settings:{defaultEngine:'native',reviewRequired:true,sandboxMode:'safe',autoRepair:true,maxParallel:2,allowUnsafeExternal:false}};
  p.activity.push({at:now(),text:'Tạo dự án'});return put(p);
}
export function updateProjectSettings(id,settings={}){return mutateProject(id,p=>{p.settings=settingsInput(settings,p.settings||{});p.activity.push({at:now(),text:'Cập nhật cấu hình dự án'});});}

export function updateProjectModelRoles(id,input={}) {
  const roles={};
  for(const role of MODEL_ROLES) { const b=input[role]; if(role==='council'){if(b!==undefined&&!Array.isArray(b))throw new Error('Council cần danh sách thành viên.');if((b||[]).length>8)throw new Error('Council hỗ trợ tối đa 8 thành viên.');roles.council=(b||[]).map(verifiedBinding);}else roles[role]=b?verifiedBinding(b):null; }
  return mutateProject(id,p=>{p.modelRoles=roles;p.activity.push({at:now(),text:'Cập nhật phân vai model'});});
}
export function saveProjectGithub(id,github){return mutateProject(id,p=>{p.settings={...p.settings,github:{...(p.settings?.github||{}),...github}};p.activity.push({at:now(),text:'Cập nhật liên kết repo GitHub'});});}
export function saveProjectDomain(id,domain){return mutateProject(id,p=>{p.settings={...p.settings,domain:{domain:domain.domain,deploymentUrl:domain.deploymentUrl,configuredAt:now()}};});}
export function projectModelRoles(id){const p=getProject(id);return {projectId:id,roles:p.modelRoles||{founder:null,council:[],worker:null,reviewer:null},descriptors:roleDescriptors(p)};}

const ideaPending=new Set();
function ideaStart(id){if(ideaPending.has(id))throw new Error('Founder đang xử lý yêu cầu của dự án.');ideaPending.add(id);}
export function updateProjectBrief(id,input={}){
  const current=getProject(id),fields=projectBriefInput(input,current);
  if(Object.keys(fields).every(k=>JSON.stringify(fields[k])===JSON.stringify(current[k]??(k==='mainFeatures'?[]:''))))return current;
  return mutateProject(id,p=>{Object.assign(p,fields);p.briefRevision=(p.briefRevision||0)+1;p.analyzedBrief=null;p.stack=null;p.councilBrief=null;p.activity.push({at:now(),text:'Lưu thông tin ý tưởng'});});
}
export function recoverInterruptedFounderChats(){
  const projects=all();let recovered=0;
  for(const p of projects){
    let projectRecovered=0;
    for(const message of p.messages||[]){
      if(message.role!=='user'||message.status!=='pending')continue;
      message.status='failed';message.interruptedAt=now();
      message.error='Phiên trước kết thúc khi Founder đang trả lời. Hãy gửi lại tin nhắn để tiếp tục.';
      recovered++;projectRecovered++;
    }
    if(projectRecovered){p.updatedAt=now();p.activity=p.activity||[];p.activity.push({at:now(),text:`${projectRecovered} tin nhắn Founder bị gián đoạn sau khi khởi động lại`});}
  }
  if(recovered)save(projects);return recovered;
}
export function clearFounderChat(id){
  if(ideaPending.has(id))throw new Error('Hãy chờ Founder hoàn tất trước khi xóa hội thoại.');
  return mutateProject(id,p=>{p.messages=[];p.analyzedBrief=null;p.councilBrief=null;p.stack=null;p.briefRevision=(p.briefRevision||0)+1;p.activity.push({at:now(),text:'Xóa hội thoại Founder'});});
}
export async function founderChat(id,connectionId,message){
  const initial=getProject(id);connectionId=projectRoleTarget(initial,'founder',connectionId);
  if(typeof message!=='string'||message.length>16000||!message.trim())throw new Error('Tin nhắn cần từ 1 đến 16.000 ký tự.');
  ideaStart(id);const messageId=crypto.randomUUID();
  try{
    mutateProject(id,p=>{if((p.messages||[]).length>=200)throw new Error('Hội thoại đã đạt 200 tin nhắn. Hãy xóa để bắt đầu lại.');p.messages.push({id:messageId,role:'user',content:message.trim(),at:now(),status:'pending'});p.stage=['idea','discovery'].includes(p.stage)?'discovery':p.stage;p.analyzedBrief=null;p.stack=null;p.councilBrief=null;p.briefRevision=(p.briefRevision||0)+1;});
    const snap=getProject(id);
    const reply=await ask(connectionId,{system:'Bạn là AI Founder/Project Manager cho người không chuyên kỹ thuật. Hãy biến ý tưởng mơ hồ thành sản phẩm rõ ràng, hỏi ít nhưng đúng trọng tâm, phát hiện login/data/payment/integration/cost/risk. Dùng thông tin dự án và toàn bộ trao đổi được cung cấp. Trả lời tiếng Việt dễ hiểu.'+skillPrompt(['founder-discovery','ux-beginner'],{role:'founder'}),prompt:briefContext(snap)});
    mutateProject(id,p=>{const user=p.messages.find(m=>m.id===messageId);if(user)user.status='sent';p.messages.push({id:crypto.randomUUID(),role:'assistant',content:reply,at:now(),status:'sent'});});return reply;
  }catch(e){mutateProject(id,p=>{const user=p.messages.find(m=>m.id===messageId);if(user)user.status='failed';});throw e;}
  finally{ideaPending.delete(id);}
}
export async function analyzeIdea(id){
  const p=getProject(id);const target=projectRoleTarget(p,'founder');
  if(!p.productType||!p.audience?.trim()||!p.goals?.trim())throw new Error('Hãy điền loại sản phẩm, đối tượng người dùng và mục tiêu.');
  ideaStart(id);
  try{
    const text=await ask(target,{system:'IDEA_BRIEF_V1. Bạn là solution architect và AI Founder. Phân tích ý tưởng thật, tránh tự bịa yêu cầu; đánh dấu câu hỏi chưa rõ trong openQuestions. Trả JSON thuần theo schema '+IDEA_BRIEF_SCHEMA+'. summary/problem/audience và goals/features/userFlows/successCriteria cần có nội dung. Mỗi danh sách tối đa 20 mục. Phân tích riêng GitHub, Vercel, Database, Auth, Storage, Domain, Payments và Backend. Chỉ chọn hạ tầng cần thiết. Không xem bản brief là specification đã được hội đồng duyệt.'+skillPrompt(['founder-discovery','system-architecture','security-review'],{role:'founder'}),prompt:briefContext(p)});
    const brief=normalizeAnalyzedBrief(extractJson(text));
    if((getProject(id).briefRevision||0)!==(p.briefRevision||0))throw new Error('Thông tin đã thay đổi trong khi phân tích. Hãy phân tích lại.');
    return mutateProject(id,x=>{x.analyzedBrief={...brief,analyzedAt:now(),revision:x.briefRevision||0};x.stack=brief.stack;x.councilBrief=null;x.activity.push({at:now(),text:'Founder phân tích structured project brief'});});
  }finally{ideaPending.delete(id);}
}
export function sendBriefToCouncil(id){
  const p=getProject(id);if(!p.analyzedBrief||p.analyzedBrief.revision!==(p.briefRevision||0))throw new Error('Hãy phân tích ý tưởng trước khi gửi sang AI Council.');
  return mutateProject(id,x=>{x.councilBrief={version:1,project:{name:x.name,productType:x.productType,audience:x.audience,goals:x.goals,mainFeatures:x.mainFeatures},...x.analyzedBrief,sentAt:now()};x.activity.push({at:now(),text:'Gửi project brief sang AI Council để phản biện'});});
}

const councilPending=new Set();
const councilProfiles=[{role:'Product strategist',skills:['product-strategy','research-evidence']},{role:'Technical architect',skills:['system-architecture','security-review']},{role:'Skeptical reviewer',skills:['security-review','qa-test']},{role:'UX advocate',skills:['ux-beginner','product-strategy']},{role:'Business/risk analyst',skills:['product-strategy','research-evidence']}];
function captureCouncilTarget(target){
  const binding=verifiedBinding(resolveBinding(target)),c=getConnection(binding.connectionId);
  return {binding,descriptor:{connectionId:c.id,provider:c.kind,name:redactVaultSecrets(c.name),model:binding.model,credentialVersion:c.credentialVersion||''}};
}
function assertCouncilTarget(snapshot){
  const c=getConnection(snapshot.binding.connectionId);
  if(c.kind!==snapshot.descriptor.provider||(c.credentialVersion||'')!==snapshot.descriptor.credentialVersion)throw new Error('Credential hoặc provider đã thay đổi trong phiên Council. Hãy phản biện lại.');
  verifiedBinding(snapshot.binding);
}
function assertCouncilCurrent(id,run){
  if(getProject(id).currentCouncilRunId!==run.id||councilBriefFingerprint(getProject(id))!==run.briefFingerprint)throw new Error('Project brief đã thay đổi trong phiên Council. Kết quả cũ không được dùng.');
}
function storeCouncilRun(id,run){return mutateProject(id,p=>{const i=(p.councilRuns||[]).findIndex(r=>r.id===run.id);if(i<0)throw new Error('Không tìm thấy phiên Council.');p.councilRuns[i]=structuredClone(run);p.council=run.members.filter(m=>m.status==='completed');});}
export function councilHistory(id){const p=getProject(id);return {currentRunId:p.currentCouncilRunId||null,currentSpecificationId:p.currentSpecificationId||null,runs:p.councilRuns||[],specifications:p.specifications||[]};}
export function recoverInterruptedCouncils(){
  const projects=all();let changed=0;
  for(const p of projects)for(const run of p.councilRuns||[]){if(run.status!=='running')continue;run.status='interrupted';run.completedAt=now();run.error='Phiên trước kết thúc khi Council đang phản biện. Hãy chạy lại; kết quả một phần được giữ trong lịch sử.';for(const m of [...run.members,run.chair])if(['pending','running'].includes(m.status)){m.status='interrupted';m.error=run.error;}if(p.currentCouncilRunId===run.id){p.currentSpecificationId=null;p.approvedSpecificationId=null;p.stage='council-interrupted';}p.updatedAt=now();changed++;}
  if(changed)save(projects);return changed;
}
export async function runCouncil(id,memberIds=[],chairId){
  if(councilPending.has(id))throw new Error('AI Council đang phản biện dự án này.');
  const p=getProject(id),brief=currentCouncilBrief(p),briefFingerprint=councilBriefFingerprint(p);
  if(p.modelRoles?.council?.length){memberIds=p.modelRoles.council.map((_,i)=>roleRef(id,'council',i));if(!memberIds.includes(chairId))chairId=memberIds[0];}
  if(!Array.isArray(memberIds)||!memberIds.length||memberIds.length>8)throw new Error('Hãy chọn từ 1 đến 8 thành viên AI Council.');if(!chairId)throw new Error('Hãy chọn AI chủ trì.');
  const members=memberIds.map((target,i)=>({...captureCouncilTarget(target),member:i+1,...councilProfiles[i%councilProfiles.length],status:'pending'}));
  const chair={...captureCouncilTarget(chairId),status:'pending'};
  const run={id:crypto.randomUUID(),status:'running',briefRevision:p.briefRevision||0,briefFingerprint,brief,startedAt:now(),members,chair,consensus:councilConsensus(members)};
  councilPending.add(id);
  try{
    mutateProject(id,x=>{x.councilRuns=x.councilRuns||[];x.specifications=x.specifications||[];x.councilRuns.push(structuredClone(run));x.currentCouncilRunId=run.id;x.currentSpecificationId=null;x.approvedSpecificationId=null;x.council=[];x.finalSpec='';x.stage='council';x.activity.push({at:now(),text:`AI Council bắt đầu với ${members.length} model độc lập`});});
    // Every first review receives exactly this immutable context. Earlier model
    // answers only enter the Chair prompt after all independent reviews finish.
    const context=JSON.stringify(brief);
    for(const member of members){
      assertCouncilCurrent(id,run);assertCouncilTarget(member);member.status='running';storeCouncilRun(id,run);
      try{
        member.text=await ask(member.binding,{usageContext:{role:'council',projectId:id},system:`COUNCIL_MEMBER_V1. Bạn là ${member.role}. Phản biện độc lập cùng project brief đóng băng, không nhận ý kiến thành viên khác. Tìm điểm mạnh, rủi ro, chi phí, phụ thuộc và khuyến nghị cụ thể. Vote agree khi phù hợp để triển khai, consider khi còn vấn đề cần xử lý, oppose khi không nên triển khai. Trả JSON thuần đúng schema ${COUNCIL_MEMBER_SCHEMA}. Không tự thêm trường. Dùng tiếng Việt.`+skillPrompt(member.skills,{role:'planning'}),prompt:context});
        member.review=normalizeCouncilMember(parseCouncilJson(member.text));member.status='completed';member.at=now();
      }catch(e){member.status='failed';member.error=redactVaultSecrets(e.message);member.at=now();throw e;}
      run.consensus=councilConsensus(members);storeCouncilRun(id,run);assertCouncilCurrent(id,run);
    }
    assertCouncilTarget(chair);chair.status='running';storeCouncilRun(id,run);
    try{
      chair.text=await ask(chair.binding,{usageContext:{role:'council',projectId:id},system:`COUNCIL_CHAIR_V1. Bạn là Council Chair. Đọc toàn bộ phản biện độc lập, đánh giá bằng lập luận và bằng chứng thay vì chỉ majority vote. Giải quyết mâu thuẫn, nêu quyết định, lý do và các thành viên liên quan (members đánh số từ 1). Không bịa yêu cầu còn thiếu; thể hiện giới hạn trong scope hoặc ngoài phạm vi. Tạo structured final specification cho MVP. Trả JSON thuần đúng schema ${COUNCIL_CHAIR_SCHEMA}. Không tự thêm trường. Bản này cần người dùng chốt trước khi tạo task. Dùng tiếng Việt.`+skillPrompt(['product-strategy','system-architecture','security-review','ux-beginner'],{role:'planning'}),prompt:JSON.stringify({brief,reviews:members.map(m=>({member:m.member,provider:m.descriptor.provider,model:m.binding.model,role:m.role,review:m.review}))})});
      chair.review=normalizeCouncilChair(parseCouncilJson(chair.text),members);chair.status='completed';chair.at=now();
    }catch(e){chair.status='failed';chair.error=redactVaultSecrets(e.message);chair.at=now();throw e;}
    assertCouncilCurrent(id,run);run.status='completed';run.completedAt=now();run.consensus=councilConsensus(members);
    const specification={id:crypto.randomUUID(),runId:run.id,version:(getProject(id).specifications||[]).length+1,status:'pending',createdAt:now(),briefRevision:run.briefRevision,briefFingerprint,specification:chair.review.specification,chair:chair.review};
    mutateProject(id,x=>{x.councilRuns[x.councilRuns.findIndex(r=>r.id===run.id)]=structuredClone(run);x.council=structuredClone(members);x.specifications.push(specification);x.currentSpecificationId=specification.id;x.finalSpec=specificationText(specification.specification);x.stage='pending-spec';x.activity.push({at:now(),text:`AI Council hoàn tất specification v${specification.version}, chờ người dùng chốt`});});
    return {runId:run.id,results:members,synthesis:chair.text,specification,consensus:run.consensus};
  }catch(e){
    try{assertCouncilCurrent(id,run);run.status='failed';}catch{run.status='stale';}
    run.error=redactVaultSecrets(e.message);run.completedAt=now();for(const m of [...members,chair])if(['pending','running'].includes(m.status))m.status='not-run';run.consensus=councilConsensus(members);
    if((getProject(id).councilRuns||[]).some(r=>r.id===run.id)){storeCouncilRun(id,run);mutateProject(id,x=>{if(x.currentCouncilRunId===run.id)x.stage='council-'+run.status;x.activity.push({at:now(),text:`Council ${run.status}: ${run.error}`});});}
    throw e;
  }finally{councilPending.delete(id);}
}
export function confirmCouncilSpecification(id,specificationId){
  const p=getProject(id),spec=currentSpecification(p);
  if(!spec||spec.id!==specificationId)throw new Error('Specification không còn là bản hiện tại. Hãy phản biện lại project brief.');
  return mutateProject(id,x=>{const s=x.specifications.find(s=>s.id===spec.id);if(s.status==='approved')return;s.status='approved';s.approvedAt=now();x.approvedSpecificationId=s.id;x.stage='approved-spec';x.activity.push({at:now(),text:`Người dùng chốt specification v${s.version}`});});
}

function extractJson(text){
  const raw=String(text||'').trim();const candidates=[raw];for(const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi))candidates.push(m[1].trim());
  for(const c of candidates){try{return JSON.parse(c)}catch{}}
  for(let i=0;i<raw.length;i++){if(raw[i]!=='{')continue;let d=0,str=false,esc=false;for(let j=i;j<raw.length;j++){const ch=raw[j];if(str){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')str=false;continue;}if(ch==='"'){str=true;continue;}if(ch==='{')d++;if(ch==='}')d--;if(d===0){try{return JSON.parse(raw.slice(i,j+1))}catch{}break;}}}
  throw new Error('AI không trả JSON hợp lệ.');
}
export async function analyzeStack(id,connectionId){
  const p=getProject(id);connectionId=projectRoleTarget(p,'founder',connectionId);
  const text=await ask(connectionId,{system:'STACK_ANALYZER_V1. Bạn là solution architect cho người mới. Trả JSON thuần theo schema '+IDEA_BRIEF_SCHEMA.slice(IDEA_BRIEF_SCHEMA.indexOf('"stack":')+8,-1)+'. Chỉ chọn thứ thật sự cần.'+skillPrompt(['system-architecture','database-postgres','vercel-deploy','supabase-setup'],{role:'planning'}),prompt:p.finalSpec||briefContext(p)});
  const stack=normalizeIdeaStack(extractJson(text),{legacy:true});if((getProject(id).briefRevision||0)!==(p.briefRevision||0))throw new Error('Thông tin đã thay đổi trong khi phân tích. Hãy phân tích lại.');mutateProject(id,x=>{x.stack=stack;x.activity.push({at:now(),text:'Phân tích hạ tầng/kết nối cần thiết'});});return stack;
}

function taskText(value,name,max,required=false){
  if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)||required&&!value.trim())throw new Error(`${name} không hợp lệ.`);
  return value.trim();
}
function criteriaInput(input,doneWhen=''){
  const values=input===undefined?String(doneWhen||'').split(/\n+/).filter(x=>x.trim()):input;
  if(!Array.isArray(values)||values.length>20)throw new Error('Tiêu chí nghiệm thu cần danh sách tối đa 20 mục.');
  return values.map((text,i)=>({id:`AC${i+1}`,text:taskText(text,'Tiêu chí nghiệm thu',1500,true),status:'not-run',source:null,evidence:null}));
}
function taskInput(raw,defaultEngine,{planned=false}={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Task không hợp lệ.');
  const role=planned?(ROLES.has(raw.role)?raw.role:'frontend'):raw.role||'frontend';
  if(!ROLES.has(role))throw new Error('Vai trò task không hợp lệ.');
  const priority=raw.priority??'medium';if(!PRIORITIES.has(priority))throw new Error('Độ ưu tiên task không hợp lệ.');
  const engineId=planned?defaultEngine:raw.engineId||defaultEngine||'native';if(!TASK_ENGINES.has(engineId))throw new Error('Engine chưa hỗ trợ thực thi task.');
  const dependsOn=raw.dependsOn??[];
  if(!Array.isArray(dependsOn)||dependsOn.length>100||dependsOn.some(x=>typeof x!=='string'||!/^T[1-9]\d{0,3}$/.test(x)))throw new Error('Task dependency không hợp lệ.');
  const doneWhen=taskText(raw.doneWhen??'','Tiêu chí hoàn thành',30000),criteria=criteriaInput(raw.acceptanceCriteria,doneWhen);
  const title=taskText(raw.title??(planned?'Task':''),'Tên task',180,true),description=taskText(raw.description??'','Mô tả task',6000);
  return {title,role,description,priority,dependsOn:[...new Set(dependsOn)],doneWhen:criteria.map(x=>x.text).join('\n'),acceptanceCriteria:criteria,engineId,
    assignedWorker:!planned&&raw.assignedWorker!==undefined&&raw.assignedWorker!==null?verifiedBinding(raw.assignedWorker):null,
    assignedReviewer:!planned&&raw.assignedReviewer!==undefined&&raw.assignedReviewer!==null?verifiedBinding(raw.assignedReviewer):null,
    skills:suggestSkillsForRole(role).slice(0,4)};
}
function validateTaskGraph(tasks){
  const ids=new Set();for(const task of tasks){if(!/^T[1-9]\d{0,3}$/.test(task.id)||ids.has(task.id))throw new Error('Task ID không hợp lệ hoặc trùng.');ids.add(task.id);if(task.priority!==undefined&&!PRIORITIES.has(task.priority))throw new Error('Độ ưu tiên task không hợp lệ.');}
  for(const task of tasks){if(!Array.isArray(task.dependsOn)||task.dependsOn.some(id=>!ids.has(id)||id===task.id))throw new Error(`${task.id}: dependency không hợp lệ.`);}
  const seen=new Set(),visiting=new Set(),byId=new Map(tasks.map(t=>[t.id,t]));
  function visit(id){if(visiting.has(id))throw new Error('Task dependencies không được tạo cycle.');if(seen.has(id))return;visiting.add(id);for(const dep of byId.get(id).dependsOn)visit(dep);visiting.delete(id);seen.add(id);}
  for(const id of ids)visit(id);
}
function freshTask(fields,id,specificationId,planId){return {...fields,id,specificationId,planId,status:'todo',progress:null,executionStage:'ready',createdAt:now(),updatedAt:now(),executionRuns:[],reviews:[],commits:[],agentLog:[],testReceipts:[],logs:[],branch:null,worktree:null,branchState:'not-created',worktreeState:'not-created'};}
function normalizePlan(raw,defaultEngine,specificationId,planId){
  if(!Array.isArray(raw)||!raw.length||raw.length>18)throw new Error('AI Project Manager cần trả từ 1 đến 18 task hợp lệ.');
  const tasks=raw.map((raw,i)=>{
    const fields=taskInput(raw,defaultEngine,{planned:true}),id=`T${i+1}`;
    for(const dep of fields.dependsOn){if(Number(dep.slice(1))>=i+1)throw new Error(`${id}: dependency "${dep}" không hợp lệ. Dependency phải trỏ tới task trước đó.`);}
    return freshTask(fields,id,specificationId,planId);
  });validateTaskGraph(tasks);return tasks;
}
function archivePlan(p,reason){
  if(!p.tasks?.length)return;
  p.planHistory=p.planHistory||[];
  p.planHistory.push({id:p.planId||crypto.randomUUID(),specificationId:p.planSpecificationId||null,createdAt:p.planCreatedAt||null,archivedAt:now(),reason,tasks:structuredClone(p.tasks)});
}
const planningPending=new Set();
export async function buildPlan(id,managerId){
  if(planningPending.has(id))throw new Error('AI Project Manager đang tạo task.');
  const p=getProject(id),spec=approvedSpecification(p);managerId=projectRoleTarget(p,'founder',managerId);if(p.modelRoles?.founder)managerId=verifiedBinding(resolveBinding(managerId));
  if((p.tasks||[]).some(t=>ACTIVE.has(t.status)))throw new Error('Hãy chờ task đang chạy hoàn tất trước khi lập kế hoạch lại.');
  planningPending.add(id);
  try{
    const text=await ask(managerId,{system:'Bạn là AI Project Manager. Trả JSON thuần schema {"tasks":[{"title":"...","role":"frontend|backend|database|design|qa|devops|research|security|architecture","description":"...","priority":"low|medium|high|urgent","dependsOn":["T1"],"doneWhen":"...","acceptanceCriteria":["..."]}]}. Task đầu không có dependency; task sau chỉ được phụ thuộc task đứng trước theo ID T1, T2... Chia MVP thành 6-14 task nhỏ, có QA/security/release khi phù hợp.'+skillPrompt(['product-strategy','system-architecture','git-release','qa-test'],{role:'planning'}),prompt:specificationText(spec.specification)});
    const planId=crypto.randomUUID(),tasks=normalizePlan(extractJson(text).tasks,p.settings?.defaultEngine||'native',spec.id,planId),latest=getProject(id);if(approvedSpecification(latest).id!==spec.id)throw new Error('Specification đã thay đổi trong khi tạo task. Hãy tạo lại.');
    if((latest.tasks||[]).some(t=>ACTIVE.has(t.status)))throw new Error('Task đã bắt đầu trong khi AI Project Manager tạo kế hoạch. Hãy chờ task hoàn tất trước khi lập kế hoạch lại.');
    mutateProject(id,x=>{archivePlan(x,'replanned');x.tasks=tasks;x.planId=planId;x.planSpecificationId=spec.id;x.planCreatedAt=now();x.stage='planned';x.activity.push({at:now(),text:`Đã chia ${tasks.length} nhiệm vụ từ specification v${spec.version}; kế hoạch trước được giữ trong lịch sử`});});return tasks;
  }finally{planningPending.delete(id);}
}
function ensureEditableTask(p,task){if(ACTIVE.has(task.status))throw new Error('Không thể sửa task đang thực thi.');if(task.status==='done')throw new Error('Task đã merge; tạo task mới để thay đổi yêu cầu.');const spec=approvedSpecification(p);if(task.specificationId!==spec.id||p.planSpecificationId!==spec.id)throw new Error('Task thuộc specification cũ. Hãy lập kế hoạch lại.');return spec;}
export function createTask(id,input={}){
  validateTaskMutationInput(input);
  return mutateProject(id,p=>{
    const spec=approvedSpecification(p);if(p.tasks?.length&&p.planSpecificationId!==spec.id)throw new Error('Kế hoạch thuộc specification cũ. Hãy lập kế hoạch lại.');
    if((p.tasks||[]).length>=100)throw new Error('Kế hoạch hỗ trợ tối đa 100 task.');
    if(!p.planId||p.planSpecificationId!==spec.id){p.planId=crypto.randomUUID();p.planCreatedAt=now();}p.planSpecificationId=spec.id;
    const max=Math.max(0,...(p.tasks||[]).map(t=>Number(t.id.slice(1))),...(p.taskArchive||[]).filter(t=>t.planId===p.planId).map(t=>Number(t.id.slice(1))));
    const task=freshTask(taskInput(input,p.settings?.defaultEngine||'native'),`T${max+1}`,spec.id,p.planId);const tasks=[...(p.tasks||[]),task];validateTaskGraph(tasks);p.tasks=tasks;p.stage='planned';p.activity.push({at:now(),text:`Tạo task ${task.id}: ${task.title}`});
  });
}
export function updateTask(id,taskId,input={}){
  validateTaskMutationInput(input);
  return mutateTask(id,taskId,(task,p)=>{
    ensureEditableTask(p,task);const criteria='acceptanceCriteria' in input?input.acceptanceCriteria:'doneWhen' in input?undefined:task.acceptanceCriteria?.map(c=>c.text);
    const fields=taskInput({...task,...input,acceptanceCriteria:criteria},task.engineId||p.settings?.defaultEngine);
    const proposed={...task,...fields};validateTaskGraph(p.tasks.map(t=>t.id===taskId?proposed:t));
    task.editHistory=task.editHistory||[];task.editHistory.push({at:now(),before:{title:task.title,description:task.description,role:task.role,priority:task.priority,dependsOn:task.dependsOn,acceptanceCriteria:task.acceptanceCriteria,engineId:task.engineId,assignedWorker:task.assignedWorker,assignedReviewer:task.assignedReviewer}});
    Object.assign(task,fields);task.updatedAt=now();p.activity.push({at:now(),text:`Cập nhật task ${taskId}`});
  });
}
function validateTaskMutationInput(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Task không hợp lệ.');
  const allowed=new Set(['title','description','role','priority','dependsOn','doneWhen','acceptanceCriteria','engineId','assignedWorker','assignedReviewer']);if(Object.keys(input).some(k=>!allowed.has(k)))throw new Error('Không cho phép cập nhật state thực thi từ client.');
}
export function archiveTask(id,taskId){
  return mutateProject(id,p=>{const task=p.tasks.find(t=>t.id===taskId);if(!task)throw new Error('Không tìm thấy task.');if(ACTIVE.has(task.status))throw new Error('Không thể lưu trữ task đang thực thi.');if(p.tasks.some(t=>t.dependsOn?.includes(taskId)))throw new Error('Task còn được task khác phụ thuộc.');p.taskArchive=p.taskArchive||[];p.taskArchive.push({...structuredClone(task),archivedAt:now()});p.tasks=p.tasks.filter(t=>t.id!==taskId);p.activity.push({at:now(),text:`Lưu trữ ${taskId}; giữ toàn bộ log, review và commit`});});
}
function depsDone(p,task){return (task.dependsOn||[]).every(dep=>p.tasks.find(t=>t.id===dep)?.status==='done');}
function taskCurrent(p,task){let spec;try{spec=approvedSpecification(p);}catch{return false;}return p.planSpecificationId===spec.id&&task.specificationId===spec.id&&(!p.planId||task.planId===p.planId);}
export function readyTasks(id){const p=getProject(id);return (p.tasks||[]).filter(t=>STARTABLE.has(t.status)&&taskCurrent(p,t)&&depsDone(p,t));}
export function recoverInterruptedTasks(){
  const projects=all();let changed=0;
  for(const p of projects)for(const t of p.tasks||[]){if(!ACTIVE.has(t.status))continue;t.status='interrupted';t.error='Phiên trước kết thúc khi task đang chạy. Main không được coi là đã hoàn tất; trạng thái cleanup chưa xác minh.';t.interruptedAt=now();t.worktreeState=t.worktree?'unknown':'not-created';t.branchState=t.branch?'unknown':'not-created';const run=t.executionRuns?.at(-1);if(run&&!run.completedAt){run.status='interrupted';run.outcome='interrupted';run.completedAt=now();run.error=t.error;run.durationMs=Date.parse(run.completedAt)-Date.parse(run.startedAt);}changed++;p.activity?.push({at:now(),text:`${t.id} được đánh dấu interrupted sau khi khởi động lại`});}
  if(changed)save(projects);return changed;
}
class StaleTaskError extends Error{constructor(message){super(message);this.name='StaleTaskError';}}
function assertExecutionCurrent(id,taskId,run){
  const p=getProject(id),task=p.tasks.find(t=>t.id===taskId);let spec;
  try{spec=approvedSpecification(p);}catch{throw new StaleTaskError('Brief hoặc specification đã thay đổi. Kết quả cũ không được merge.');}
  if(!task||spec.id!==run.specificationId||spec.briefFingerprint!==run.briefFingerprint||p.planSpecificationId!==run.specificationId||task.specificationId!==run.specificationId||(run.planId&&(p.planId!==run.planId||task.planId!==run.planId)))throw new StaleTaskError('Kế hoạch hoặc specification không còn khớp phiên thực thi. Kết quả cũ không được merge.');
  return p;
}
function frozenTaskTarget(project,task,role,explicit){
  const assigned=role==='worker'?task.assignedWorker:task.assignedReviewer;
  const target=explicit||assigned||projectRoleTarget(project,role);const binding=verifiedBinding(resolveBinding(target)),c=getConnection(binding.connectionId);
  return {binding,descriptor:{connectionId:c.id,provider:c.kind,name:redactVaultSecrets(c.name),model:binding.model}};
}
function promptTask(task){return {id:task.id,title:task.title,role:task.role,description:task.description,priority:task.priority||'medium',dependsOn:task.dependsOn||[],doneWhen:task.doneWhen||'',acceptanceCriteria:(task.acceptanceCriteria||[]).map(c=>({id:c.id,text:c.text})),specificationId:task.specificationId,planId:task.planId};}
function runMutation(id,taskId,runId,fn){return mutateTask(id,taskId,(task,p)=>{const run=task.executionRuns?.find(r=>r.id===runId);if(!run)throw new Error('Không tìm thấy phiên thực thi task.');fn(task,run,p);task.updatedAt=now();});}
function logEvent(id,taskId,runId,event){
  const entry={at:now(),...event};if(entry.message)entry.message=redactVaultSecrets(String(entry.message));
  return runMutation(id,taskId,runId,(task,run)=>{task.logs.push(entry);run.logs.push(entry);});
}
function phase(id,taskId,runId,status,stage,message){return runMutation(id,taskId,runId,(task,run,p)=>{task.status=status;task.executionStage=stage;run.status=status;const entry={at:now(),kind:'phase',stage,message};task.logs.push(entry);run.logs.push(entry);run.stages.push({at:entry.at,stage});p.activity.push({at:entry.at,text:`${taskId}: ${message}`});});}
function agentEvent(id,taskId,runId,pass,event){return runMutation(id,taskId,runId,(task,run)=>{const entry={...event,pass,runId};task.agentLog.push(entry);run.agentLog.push(entry);if(entry.receipt){task.testReceipts.push(entry.receipt);run.testReceipts.push(entry.receipt);}const summary={at:entry.at||now(),kind:entry.kind||'agent',pass,message:entry.kind==='tool'?`${entry.tool}: ${entry.status}${entry.path?' · '+entry.path:''}${entry.script?' · '+entry.script:''}`:`Worker lượt ${entry.turn}: ${entry.status}`};task.logs.push(summary);run.logs.push(summary);});}
function recordReceipt(id,taskId,runId,receipt){return runMutation(id,taskId,runId,(task,run)=>{task.testReceipts.push(receipt);run.testReceipts.push(receipt);run.latestTestReceipt=receipt;task.latestTestReceipt=receipt;const log={at:receipt.completedAt||now(),kind:'test',message:`Test ${receipt.status}: ${receipt.reason||receipt.command?.join(' ')||''}`};task.logs.push(log);run.logs.push(log);});}
function recordCommit(id,taskId,runId,sha,message,pass){return runMutation(id,taskId,runId,(task,run)=>{const commit={sha,message,pass,at:now(),branch:task.branch};task.commits.push(commit);run.commits.push(commit);task.commitSha=sha;run.commitSha=sha;const log={at:commit.at,kind:'git',message:`Commit ${sha.slice(0,12)} · ${message}`};task.logs.push(log);run.logs.push(log);});}
function recordReview(id,taskId,runId,review,pass){return runMutation(id,taskId,runId,(task,run)=>{
  const attempt={id:review.id||crypto.randomUUID(),...review,pass,at:now(),reviewerBinding:run.reviewerBinding};
  for(const attempts of [task.reviews,run.reviews]){const i=attempts.findIndex(r=>r.id===attempt.id);if(i<0)attempts.push(attempt);else attempts[i]=attempt;}task.review=attempt;
  for(const result of review.acceptance||[]){const criterion=task.acceptanceCriteria.find(c=>c.id===result.criterionId);if(criterion&&typeof result.met==='boolean'&&result.explanation){criterion.status=result.met?'met':'not-met';criterion.source='reviewer';criterion.evidence={runId,pass,reviewerBinding:run.reviewerBinding,explanation:result.explanation,at:attempt.at};}}
  const log={at:attempt.at,kind:'review',message:`Reviewer #${run.reviews.length}: ${review.status} · ${review.summary}`};task.logs.push(log);run.logs.push(log);
});}
async function persistCleanup(id,taskId,runId,wt,deleteBranch){
  let cleanup;try{cleanup=await cleanupTaskWorktree(id,wt,{deleteBranch});}catch(e){cleanup={at:now(),worktreeRemoved:false,worktreeExists:null,branchDeleted:false,branchRetained:false,errors:[redactVaultSecrets(e.message)]};}
  runMutation(id,taskId,runId,(task,run)=>{task.cleanup=cleanup;run.cleanup=cleanup;task.worktreeState=cleanup.worktreeRemoved?'removed':cleanup.worktreeExists?'retained':'unknown';task.branchState=cleanup.branchDeleted?'deleted':cleanup.branchRetained?'retained':'unknown';const log={at:now(),kind:'cleanup',message:`Worktree ${task.worktreeState}; branch ${task.branchState}${cleanup.errors.length?' · '+cleanup.errors.join('; '):''}`};task.logs.push(log);run.logs.push(log);});return cleanup;
}
function finishRun(id,taskId,runId,outcome,extra={}){return runMutation(id,taskId,runId,(task,run)=>{const completedAt=now(),durationMs=Date.parse(completedAt)-Date.parse(run.startedAt);Object.assign(run,{outcome,status:outcome,completedAt,durationMs,...extra});Object.assign(task,{status:outcome,completedAt,durationMs,...extra});});}
export async function runTask(id,taskId,workerId,reviewerId,engineId){
  const redact=createVaultSecretRedactor();
  const start=getProject(id),task0=start.tasks.find(x=>x.id===taskId);if(!task0)throw new Error('Không tìm thấy task.');const approved=approvedSpecification(start);
  if(!taskCurrent(start,task0))throw new Error('Task và kế hoạch không khớp specification đã chốt. Hãy lập kế hoạch lại.');
  validateTaskGraph(start.tasks);if(!STARTABLE.has(task0.status))throw new Error(`Task ${taskId} đang ở trạng thái ${task0.status}, không thể chạy lại lúc này.`);if(!depsDone(start,task0))throw new Error('Task còn dependency chưa hoàn tất.');
  const settings=settingsInput(start.settings||{},{}),sandboxMode=settings.sandboxMode;
  if(start.tasks.filter(t=>ACTIVE.has(t.status)).length>=settings.maxParallel)throw new Error(`Đã đạt giới hạn ${settings.maxParallel} task song song.`);
  engineId=engineId||task0.engineId||settings.defaultEngine;if(!TASK_ENGINES.has(engineId))throw new Error('Engine này chưa hỗ trợ thực thi task.');if(engineId==='mini-swe-agent'&&!settings.allowUnsafeExternal)throw new Error('External shell UNSAFE chưa được bật.');
  const worker=frozenTaskTarget(start,task0,'worker',workerId),reviewer=settings.reviewRequired?frozenTaskTarget(start,task0,'reviewer',reviewerId):null;
  const run={id:crypto.randomUUID(),planId:start.planId||null,specificationId:approved.id,briefFingerprint:approved.briefFingerprint,workerBinding:worker.binding,reviewerBinding:reviewer?.binding||null,workerDescriptor:worker.descriptor,reviewerDescriptor:reviewer?.descriptor||null,engineId,settings:structuredClone(settings),startedAt:now(),status:'preparing',stages:[],logs:[],agentLog:[],reviews:[],commits:[],testReceipts:[]};
  const task=promptTask({...task0,acceptanceCriteria:task0.acceptanceCriteria||criteriaInput(undefined,task0.doneWhen)}),spec=specificationText(approved.specification),guard=()=>assertExecutionCurrent(id,taskId,run);
  let wt=null,keepBranch=false;
  mutateTask(id,taskId,(task,p)=>{task.executionRuns=task.executionRuns||[];task.reviews=task.reviews||[];task.commits=task.commits||[];task.logs=task.logs||[];task.agentLog=task.agentLog||[];task.testReceipts=task.testReceipts||[];task.acceptanceCriteria=criteriaInput((task.acceptanceCriteria||criteriaInput(undefined,task.doneWhen)).map(c=>c.text));task.executionRuns.push(structuredClone(run));task.status='preparing';task.executionStage='preparing';task.workerBinding=worker.binding;task.reviewerBinding=reviewer?.binding||null;task.workerDescriptor=worker.descriptor;task.reviewerDescriptor=reviewer?.descriptor||null;task.workerId=worker.binding.connectionId;task.reviewerId=reviewer?.binding.connectionId||null;task.engineId=engineId;task.startedAt=run.startedAt;task.completedAt=null;task.durationMs=null;task.progress=null;task.error='';task.review=null;task.latestTestReceipt=null;task.commitSha=null;task.mergeSha=null;task.cleanup=null;task.rollback=null;task.mainState=null;task.branch=null;task.worktree=null;task.branchState='not-created';task.worktreeState='not-created';p.activity.push({at:now(),text:`${task.id} đang chuẩn bị worktree riêng`});});
  try{
    guard();wt=await createTaskWorktree(id,taskId);
    runMutation(id,taskId,run.id,(task,execution)=>{task.branch=wt.branch;task.worktree=wt.dir;task.branchState='active';task.worktreeState='active';execution.branch=wt.branch;execution.worktree=wt.dir;execution.baseSha=wt.baseSha;});
    guard();
    let work;
    for(let pass=1;pass<=2;pass++){
      guard();phase(id,taskId,run.id,pass===1?'running':'repairing',pass===1?'coding':'repairing',pass===1?'Worker đang thực thi trên branch riêng':'Worker đang sửa theo review');
      const prior=getProject(id).tasks.find(t=>t.id===taskId).review,extra=pass===2?'Reviewer fixes required:\n- '+(prior?.fixes||[]).join('\n- '):'';
      const options={root:wt.dir,workerId:worker.binding,spec,task,skills:task0.skills||[],maxTurns:pass===1?18:10,sandboxMode,extraContext:extra,assertCurrent:guard,onEvent:event=>agentEvent(id,taskId,run.id,pass,event)};
      work=engineId==='native'?await runNativeTask(options):await runExternalTask({...options,engineId,spec:spec+(extra?'\n\n'+extra:''),allowUnsafeHost:settings.allowUnsafeExternal});guard();
      runMutation(id,taskId,run.id,(task,execution)=>{task.summary=work.summary;execution.summary=work.summary;});
      const message=redact(pass===1?`AI ${taskId}: ${task0.title}`:`AI ${taskId}: reviewer fixes`),commit=await commitTask(wt,message);
      if(pass===1&&!commit)throw new Error('Agent kết thúc nhưng không tạo thay đổi file.');if(commit)recordCommit(id,taskId,run.id,commit,message,pass);
      guard();const head=await taskHead(wt);runMutation(id,taskId,run.id,(task,execution)=>{task.commitSha=head;execution.commitSha=head;});guard();
      phase(id,taskId,run.id,'testing','testing','Kiểm tra test script với sandbox đã chọn');
      const receipt=await runTaskTests({root:wt.dir,sandboxMode});recordReceipt(id,taskId,run.id,{...receipt,pass});guard();
      const diff=await taskDiff(wt);guard();let review;
      if(settings.reviewRequired){
        phase(id,taskId,run.id,'reviewing','reviewing','Reviewer độc lập đang kiểm tra diff và receipt thực');
        const attemptId=crypto.randomUUID();recordReview(id,taskId,run.id,{id:attemptId,approved:null,status:'RUNNING',summary:'Đang chờ Reviewer độc lập.',risks:[],fixes:[],acceptance:[],startedAt:now()},pass);
        try{review={id:attemptId,...await reviewNativeTask({reviewerId:reviewer.binding,spec,task,diff,testReceipts:getProject(id).tasks.find(t=>t.id===taskId).executionRuns.find(r=>r.id===run.id).testReceipts,skills:['security-review','qa-test',...(task0.skills||[])],assertCurrent:guard})};}
        catch(e){recordReview(id,taskId,run.id,{id:attemptId,approved:false,status:'ERROR',summary:redactVaultSecrets(e.message),risks:[],fixes:[],acceptance:[],completedAt:now()},pass);throw e;}
      }else review={approved:null,status:'SKIPPED',summary:'Review đã được tắt trong cấu hình; chưa có phê duyệt độc lập.',risks:[],fixes:[],acceptance:[]};
      if(['FAIL','TIMED_OUT','ERROR'].includes(receipt.status))review={...review,approved:false,status:'REJECTED',summary:review.summary+' · Test runtime thất bại.',risks:[...(review.risks||[]),`Trusted test: ${receipt.status}`],fixes:[...(review.fixes||[]),'Sửa test runtime đang thất bại; không tuyên bố PASS từ văn bản.']};
      recordReview(id,taskId,run.id,review,pass);
      guard();
      if(review.approved===true||review.status==='SKIPPED')break;
      if(pass===1&&settings.autoRepair&&review.fixes?.length)continue;
      finishRun(id,taskId,run.id,'review',{error:'Reviewer chưa duyệt',executionStage:'rejected'});await persistCleanup(id,taskId,run.id,wt,true);return {task:getProject(id).tasks.find(t=>t.id===taskId),review,merged:false,rolledBack:true};
    }
    guard();phase(id,taskId,run.id,'merging','merging','Đang merge branch đã review vào main');
    const merged=await mergeTask(id,wt,{guard,lockSpecification:()=>{guard();specificationCommitWindows.add(id);return ()=>specificationCommitWindows.delete(id);}});
    if(!merged.ok){keepBranch=true;finishRun(id,taskId,run.id,'merge-conflict',{error:merged.error,executionStage:'merge-conflict'});await persistCleanup(id,taskId,run.id,wt,false);return {task:getProject(id).tasks.find(t=>t.id===taskId),review:getProject(id).tasks.find(t=>t.id===taskId).review,merged:false,conflict:true};}
    finishRun(id,taskId,run.id,'done',{mergeSha:merged.sha,executionStage:'merged'});mutateProject(id,p=>{p.stage='building';p.activity.push({at:now(),text:`${taskId} đã merge vào main${settings.reviewRequired?' sau review':'; review SKIPPED'}`});});
    await persistCleanup(id,taskId,run.id,wt,true);return {task:getProject(id).tasks.find(t=>t.id===taskId),review:getProject(id).tasks.find(t=>t.id===taskId).review,merged:true,mergeSha:merged.sha};
  }catch(e){
    const stale=e instanceof StaleTaskError,rollbackFailed=e.rollback&&e.rollback.ok!==true;keepBranch=keepBranch||rollbackFailed;
    finishRun(id,taskId,run.id,rollbackFailed?'merge-rollback-failed':stale?'stale':'failed',{error:redact(e?.message||e),executionStage:rollbackFailed?'merge-rollback-failed':stale?'stale':'failed',...(e.rollback?{rollback:JSON.parse(redact(JSON.stringify(e.rollback))),mainState:rollbackFailed?'unknown':'restored'}:{})});logEvent(id,taskId,run.id,{kind:'error',message:redact(e?.message||e)});if(wt)await persistCleanup(id,taskId,run.id,wt,!keepBranch);throw e;
  }
}
export async function runReadyBatch(id,{workerId,reviewerId,engineId,limit}={}){
  const p=getProject(id);approvedSpecification(p);const settings=settingsInput(p.settings||{},{});
  if(limit!==undefined&&(!Number.isInteger(limit)||limit<1||limit>4))throw new Error('Giới hạn batch cần số nguyên từ 1 đến 4.');
  const available=Math.max(0,settings.maxParallel-p.tasks.filter(t=>ACTIVE.has(t.status)).length),max=Math.min(limit??settings.maxParallel,available),ready=readyTasks(id).slice(0,max);if(!ready.length)return {ok:true,runs:[],message:available?'Không có task sẵn sàng từ specification hiện tại.':'Đã đạt giới hạn chạy song song.'};
  const settled=await Promise.allSettled(ready.map(t=>runTask(id,t.id,workerId,reviewerId,engineId)));
  const runs=settled.map((x,i)=>{if(x.status!=='fulfilled')return {taskId:ready[i].id,status:getProject(id).tasks.find(t=>t.id===ready[i].id)?.status||'failed',error:redactVaultSecrets(x.reason?.message||x.reason)};return {taskId:ready[i].id,status:x.value?.task?.status||'unknown',result:x.value};});
  return {ok:runs.every(x=>x.status==='done'),runs};
}
