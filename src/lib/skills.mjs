import crypto from 'node:crypto';
import { readJson, writeJson } from './store.mjs';

const CUSTOM_FILE='custom-skills.json';
export const WORKFLOW_SKILL_ID='ai-project-os-workflow';
const workflowRoles={
 founder:'Chốt mục tiêu, đầu ra và tiêu chí quan sát được; chỉ hỏi khi thiếu thông tin làm đổi kết quả. Không bắt yêu cầu đơn giản qua nhiều vòng Council.',
 planning:'Lập packet cho từng nhiệm vụ: phạm vi, nguồn cần đọc, đầu ra, tiêu chí, công cụ/quyền, kiểm tra và giới hạn. Worker chỉ nhận đúng nhiệm vụ và ảnh liên quan; kiểm chứng rồi review trước khi giao.',
 worker:'Đọc nguồn liên quan bằng tìm kiếm có mục tiêu, làm trong phạm vi packet. Dùng công cụ thật, chạy kiểm tra bắt buộc; UI cần screenshot thật. Handoff ngắn với sản phẩm, phiên bản, bằng chứng và giới hạn (SHA khi dùng Git); không tự APPROVE hoặc merge.',
 reviewer:'Kiểm độc lập đúng phiên bản sản phẩm và bằng chứng theo tiêu chí; với code kiểm candidate SHA và diff. Không suy live success từ fixture hoặc đồng thuận model. Trả APPROVE hoặc REJECT với lỗi, mức độ, tái hiện và điều kiện đạt; không sửa source hoặc merge.'
};
const workflowPrompt='Giữ model người dùng đã chọn. Chỉ đọc ngữ cảnh cần thiết; không lặp tài liệu dài. Chốt đầu ra → packet → thực hiện → kiểm chứng thật → review → giao → checkpoint. Tiếp tục phần đã được cho phép; checkpoint ghi SHA, cổng đã đạt/còn lại, findings và bước tiếp theo. Không fake trạng thái, usage hoặc mức tiết kiệm; không bỏ kiểm tra bắt buộc để giảm token.';


const BUILTIN=[
  {id:'founder-discovery',name:'Founder Discovery',icon:'💡',category:'product',roles:['founder','product','research'],description:'Làm rõ ý tưởng, người dùng, giá trị cốt lõi, phạm vi MVP và giả định rủi ro.',prompt:'Tập trung làm rõ vấn đề, người dùng, giá trị, giả định và phạm vi MVP. Hỏi ít nhưng đúng trọng tâm; ưu tiên phương án đơn giản, kiểm chứng được.'},
  {id:'product-strategy',name:'Product Strategy',icon:'🎯',category:'product',roles:['product','manager','research'],description:'Định nghĩa outcome, MVP, ngoài phạm vi, metric và roadmap.',prompt:'Đánh giá product-market fit sơ bộ, outcome, metric, phạm vi MVP và những thứ phải bỏ để ra sản phẩm nhanh.'},
  {id:'ux-beginner',name:'Beginner UX',icon:'🧭',category:'design',roles:['design','frontend','product'],description:'Thiết kế giao diện cho người không kỹ thuật, có wizard và hướng dẫn trực quan.',prompt:'Thiết kế trải nghiệm ưu tiên người mới: ít thuật ngữ, wizard từng bước, trạng thái rõ, undo an toàn, giải thích bằng ngôn ngữ đời thường.'},
  {id:'system-architecture',name:'System Architecture',icon:'🏗️',category:'engineering',roles:['architecture','backend','devops','manager'],description:'Chia module, boundary, API contract, data flow và failure modes.',prompt:'Thiết kế kiến trúc module rõ ràng, API contract tối thiểu, dữ liệu đi đâu, failure mode, khả năng thay thế provider và tránh coupling.'},
  {id:'frontend-web',name:'Frontend Web',icon:'🖥️',category:'engineering',roles:['frontend','design'],description:'Xây UI responsive, accessible, có state/loading/error đầy đủ.',prompt:'Tạo frontend responsive, accessible, trạng thái loading/error/empty rõ ràng, không nhét secret vào client, code dễ đọc và ít phụ thuộc.'},
  {id:'backend-api',name:'Backend API',icon:'⚙️',category:'engineering',roles:['backend','architecture'],description:'API/server logic, validation, auth boundary, idempotency và error handling.',prompt:'Thiết kế backend với validation chặt, auth/authorization rõ, idempotency khi cần, lỗi có cấu trúc, không log secret.'},
  {id:'database-postgres',name:'Database/Postgres',icon:'🗄️',category:'data',roles:['database','backend'],description:'Schema, migration, RLS, index, backup và dữ liệu nhạy cảm.',prompt:'Thiết kế schema Postgres tối giản, migration an toàn, index hợp lý, RLS/least privilege, không lưu plaintext secret, có chiến lược backup.'},
  {id:'security-review',name:'Security Review',icon:'🛡️',category:'quality',roles:['security','qa','backend','devops','reviewer'],description:'Threat model, secret handling, injection, authz, dependency và supply-chain.',prompt:'Review theo threat model: secret, authz, injection, path traversal, SSRF, dependency/supply-chain, logging dữ liệu nhạy cảm, privilege tối thiểu.'},
  {id:'qa-test',name:'QA & Test',icon:'🧪',category:'quality',roles:['qa','reviewer','frontend','backend'],description:'Acceptance criteria, smoke test, regression, negative cases.',prompt:'Biến yêu cầu thành acceptance criteria, chạy smoke/regression/negative tests phù hợp, chỉ tuyên bố pass khi có bằng chứng.'},
  {id:'git-release',name:'Git & Release',icon:'🌿',category:'delivery',roles:['devops','release','manager'],description:'Branch, commit, PR, release notes và rollback.',prompt:'Ưu tiên branch nhỏ, commit rõ, PR reviewable, không force push production, release có rollback và ghi lại thay đổi.'},
  {id:'vercel-deploy',name:'Vercel Deploy',icon:'▲',category:'delivery',roles:['devops','release','frontend'],description:'Preview/production deploy, env separation, logs và rollback.',prompt:'Tách preview/production, secret chỉ ở server env, kiểm build/runtime logs, xác minh URL sau deploy, giữ đường rollback.'},
  {id:'supabase-setup',name:'Supabase Setup',icon:'⚡',category:'data',roles:['database','backend','devops'],description:'Postgres/Auth/Storage, RLS và project setup cho người mới.',prompt:'Chỉ đề xuất Supabase khi cần dữ liệu/auth/storage; giải thích từng bước, bật RLS, phân biệt publishable/server secret và tách staging/production.'},
  {id:'research-evidence',name:'Research & Evidence',icon:'🔎',category:'research',roles:['research','product','architecture'],description:'So sánh lựa chọn, kiểm tra tài liệu hiện hành và ghi nguồn.',prompt:'Khi phụ thuộc thông tin thay đổi theo thời gian, xác minh tài liệu hiện hành, so sánh lựa chọn và ghi rõ giả định/nguồn thay vì đoán.'},
];

export const SKILL_CATEGORIES=['planning','build','design','deploy','research','ops','other'];
export const SKILL_ROLES=['founder','product','manager','research','design','frontend','architecture','backend','devops','database','security','qa','reviewer','release'];
const display=[
 ['Founder Discovery','planning',['planning','research','strategy'],'Phân tích ý tưởng, khám phá vấn đề, phỏng vấn người dùng, tìm product-market fit.'],
 ['Product Strategy','planning',['planning','strategy','research'],'Xây dựng chiến lược sản phẩm, roadmap, định vị, go-to-market.'],
 ['UX Design','design',['design','prototype','ui'],'Thiết kế trải nghiệm người dùng, wireframe, prototype, UI/UX.'],
 ['Architecture','planning',['planning','architecture','tech'],'Thiết kế kiến trúc hệ thống, lựa chọn công nghệ, tối ưu hiệu năng.'],
 ['Frontend','build',['build','frontend','nextjs'],'Phát triển giao diện người dùng với Next.js, React, Tailwind CSS.'],
 ['Backend','build',['build','api','backend'],'Phát triển API, xử lý nghiệp vụ, tích hợp dịch vụ, tối ưu hệ thống.'],
 ['PostgreSQL','other',['database','data','postgresql'],'Thiết kế database, tối ưu truy vấn, quản lý dữ liệu, backup và migration.'],
 ['Security','ops',['security','auth','compliance'],'Đánh giá bảo mật, quản lý quyền, bảo vệ dữ liệu và tuân thủ.'],
 ['QA','ops',['testing','qa','automation'],'Viết test, kiểm thử chức năng, kiểm thử tự động, đảm bảo chất lượng.'],
 ['Git / Release','deploy',['git','ci/cd','release'],'Quản lý mã nguồn, code review, CI/CD, phát hành phiên bản.'],
 ['Vercel','deploy',['deploy','hosting','vercel'],'Triển khai web app, cấu hình domain, monitoring, tối ưu hiệu suất.'],
 ['Supabase','deploy',['backend','database','realtime'],'Database, auth, storage, realtime, tích hợp với ứng dụng.'],
 ['Research','research',['research','analysis','market'],'Nghiên cứu thị trường, phân tích đối thủ, tổng hợp thông tin.']
];
BUILTIN.push({id:WORKFLOW_SKILL_ID,name:'AI Project OS Workflow',icon:'⇄',category:'ops',roles:SKILL_ROLES,prompt:workflowPrompt,rolePrompts:workflowRoles});
display.push(['AI Project OS Workflow','ops',['workflow','checkpoint','review'],'Giao việc gọn theo vai trò, kiểm chứng thật và tiếp tục từ checkpoint; giữ model đã chọn.']);
const builtinIds=new Set(BUILTIN.map(s=>s.id));
const SETTINGS_FILE='skill-settings.json';
const aliases={product:'planning',engineering:'build',data:'other',quality:'ops',delivery:'deploy',custom:'other'};
function customs(){const raw=readJson(CUSTOM_FILE,[]);return (Array.isArray(raw)?raw:[]).filter(x=>x&&typeof x.id==='string'&&!builtinIds.has(x.id));}
export function listSkills(){
  const settings=readJson(SETTINGS_FILE,{});
  return [...BUILTIN.map((s,i)=>({...s,name:display[i][0],category:display[i][1],tags:display[i][2],description:display[i][3],builtin:true,recommended:[6,7,12].includes(i)})),...customs().map(s=>({...s,category:aliases[s.category]||s.category,builtin:false,tags:[aliases[s.category]||s.category,...(s.roles||[]).slice(0,2)]}))].map(s=>({...s,enabled:typeof settings[s.id]==='boolean'?settings[s.id]:s.enabled!==false}));
}
export function getSkill(id){return listSkills().find(x=>x.id===id)||null;}
export function suggestSkillsForRole(role){return listSkills().filter(s=>s.enabled&&(s.roles||[]).includes(role)).sort((a,b)=>Number(b.id===WORKFLOW_SKILL_ID)-Number(a.id===WORKFLOW_SKILL_ID)).map(s=>s.id);}
export function skillPrompt(ids=[],{role}={}){
  // Reserve one of four slots for the enabled workflow, including older tasks.
  // Resolve on every call so disabling a skill immediately affects the next request.
  const contextual=Object.hasOwn(workflowRoles,role||'');
  const selected=[...new Set(contextual?[WORKFLOW_SKILL_ID,...ids]:ids)].map(getSkill).filter(s=>s?.enabled).slice(0,contextual?4:Infinity);
  return selected.length?'\n\nSKILLS ÁP DỤNG:\n'+selected.map(s=>`- ${s.name}: ${s.prompt}${s.id===WORKFLOW_SKILL_ID&&contextual?' '+workflowRoles[role]:''}`).join('\n'):'';
}
export const SKILL_SAMPLES=[
 {id:'mvp',name:'Xây dựng MVP cho ứng dụng AI note',roles:['product','frontend','database','devops']},
 {id:'frontend',name:'Phát triển giao diện web',roles:['frontend']},
 {id:'backend',name:'Xây dựng API và nghiệp vụ',roles:['backend']},
 {id:'qa',name:'Kiểm thử và review bảo mật',roles:['qa']},
 {id:'research',name:'Nghiên cứu và khám phá ý tưởng',roles:['research']}
];
export function sampleSkillMapping(id='mvp'){
 const sample=SKILL_SAMPLES.find(s=>s.id===id);if(!sample)throw new Error('Nhiệm vụ mẫu không hợp lệ.');
 const matches=new Map();for(const role of sample.roles)for(const id of suggestSkillsForRole(role).slice(0,4)){if(!matches.has(id))matches.set(id,{...getSkill(id),matchedRoles:[]});matches.get(id).matchedRoles.push(role);}
 return {samples:SKILL_SAMPLES,sample,skills:[...matches.values()],rule:'Tối đa 4 kỹ năng đã bật cho mỗi role; Workflow được ưu tiên một vị trí khi bật. MVP là nhóm task theo các role.'};
}
function validId(id){if(typeof id!=='string'||!/^custom-[a-zA-Z0-9_-]{1,83}$/.test(id))throw new Error('ID custom skill không hợp lệ.');return id;}
function field(value,name,max,required=true){if(typeof value!=='string'||value.trim().length>max||(required&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new Error(`${name} không hợp lệ (tối đa ${max} ký tự).`);return value.trim();}
export function saveCustomSkill(input,{updateId=null}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Skill không hợp lệ.');
 if(input.id&&builtinIds.has(input.id)||updateId&&builtinIds.has(updateId))throw new Error('Không thể thay đổi built-in skill.');
 const id=updateId?validId(updateId):input.id?validId(input.id):`custom-${crypto.randomUUID()}`;
 const all=customs(),old=all.find(s=>s.id===id);
 if(updateId&&!old)throw new Error('Không tìm thấy custom skill.');if(!updateId&&old)throw new Error('ID skill đã tồn tại.');
 if(updateId&&input.id&&input.id!==updateId)throw new Error('Không thể đổi ID skill.');
 const name=field(input.name,'Tên',80),prompt=field(input.prompt,'Hướng dẫn',5000),category=input.category||'other';
 if(!SKILL_CATEGORIES.includes(category))throw new Error('Category không hợp lệ.');
 if(!Array.isArray(input.roles)||!input.roles.length||input.roles.length>14||input.roles.some(r=>!SKILL_ROLES.includes(r)))throw new Error('Roles không hợp lệ; chọn ít nhất một role.');
 if(input.enabled!==undefined&&typeof input.enabled!=='boolean')throw new Error('Enabled phải là boolean.');
 const item={id,name,prompt,category,roles:[...new Set(input.roles)],description:field(input.description??'Kỹ năng tùy chỉnh','Mô tả',240,false),icon:field(input.icon??'🧩','Icon',8),enabled:old?.enabled??input.enabled??true};
 writeJson(CUSTOM_FILE,[...all.filter(s=>s.id!==id),item]);return getSkill(id);
}
export function setSkillEnabled(id,enabled){
 if(typeof enabled!=='boolean')throw new Error('Enabled phải là boolean.');if(!getSkill(id))throw new Error('Không tìm thấy skill.');
 const settings=readJson(SETTINGS_FILE,{});settings[id]=enabled;writeJson(SETTINGS_FILE,settings);return getSkill(id);
}
export function deleteCustomSkill(id){
 if(builtinIds.has(id))throw new Error('Không thể xóa built-in skill.');validId(id);if(!customs().some(s=>s.id===id))throw new Error('Không tìm thấy custom skill.');
 writeJson(CUSTOM_FILE,customs().filter(s=>s.id!==id));const settings=readJson(SETTINGS_FILE,{});delete settings[id];writeJson(SETTINGS_FILE,settings);return {ok:true};
}

// Skill IDs are historical task metadata. Only skillPrompt supplies active instructions.
export function skillTaskContext(task){const {skills,...context}=task||{};return context;}
