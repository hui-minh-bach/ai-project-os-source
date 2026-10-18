// Safe model registry and role descriptors. Credentials remain inside Vault.
import { readJson, writeJson } from './store.mjs';
import { getConnection, vaultStatus } from './vault.mjs';

export const MODEL_ROLES = Object.freeze(['founder', 'council', 'worker', 'reviewer']);
export const MODEL_REGISTRY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FILE = 'model-registry.json';
export const AI_KINDS = Object.freeze(['chatgpt_account', 'claude_account', 'gemini_account', 'antigravity_account', 'openai', 'gemini', 'anthropic', 'openai_compatible']);
const registry = () => readJson(FILE, {});
const safeModel = x => typeof x === 'string' && x.length > 0 && x.length <= 120 && !/[\x00-\x1f]/.test(x);

export function recordModels(connection, models) {
  const current=getConnection(connection.id);
  if(current.credentialVersion!==connection.credentialVersion||current.kind!==connection.kind)throw new Error('Credential đã thay đổi trong khi tải model. Hãy làm mới.');
  const ids = [...new Set(models.filter(safeModel))].sort();
  if (ids.length > 10000) throw new Error('Provider trả quá nhiều model.');
  const all = registry();
  all[connection.id] = { connectionId: connection.id, kind: connection.kind, revision: connection.credentialVersion || '', status: 'verified', models: ids, verifiedAt: new Date().toISOString() };
  writeJson(FILE, all);
  return ids;
}
export function invalidateModels(id) {
  const all = registry(); delete all[id]; writeJson(FILE, all);
}
export function registryEntry(id) {
  const c = getConnection(id), r = registry()[id];
  const hasCredential=c.kind==='chatgpt_account'?Boolean(c.meta?.accountIdentity):['claude_account','gemini_account'].includes(c.kind)?c.meta?.authMode==='cli-account':c.kind==='antigravity_account'?c.meta?.authMode==='antigravity-cli':Boolean(c.secret);
  if (!AI_KINDS.includes(c.kind)||!hasCredential) throw new Error('Kết nối không có AI credential.');
  if (!r || r.revision !== (c.credentialVersion || '') || r.status !== 'verified') throw new Error('Chưa xác minh danh sách model. Hãy làm mới kết nối.');
  if (!Number.isFinite(Date.parse(r.verifiedAt)) || Date.now() - Date.parse(r.verifiedAt) > MODEL_REGISTRY_MAX_AGE_MS) throw new Error('Danh sách model đã cũ. Hãy làm mới kết nối.');
  if(['chatgpt_account','claude_account','gemini_account','antigravity_account'].includes(c.kind)){const models=r.models.filter(m=>Number.isFinite(Date.parse(r.modelVerifiedAt?.[m]))&&Date.now()-Date.parse(r.modelVerifiedAt[m])<=MODEL_REGISTRY_MAX_AGE_MS);if(!models.length)throw new Error('Chưa có model tài khoản được xác minh phản hồi.');return {...r,models};}
  return r;
}
export function modelAvailability(id) {
  if (!vaultStatus().unlocked) return { status: 'locked', models: [], message: 'Vault đang khóa — trạng thái chưa xác định.' };
  try { const r = registryEntry(id); return { status: 'verified', models: r.models, verifiedAt: r.verifiedAt,catalogModels:r.catalogModels||[] }; }
  catch (e) { let c;try{c=getConnection(id)}catch{return {status:'unverified',models:[],message:e.message}}const r=registry()[id];return { status: 'unverified', models: [], catalogModels:['chatgpt_account','claude_account','gemini_account','antigravity_account'].includes(c.kind)&&r?.revision===c.credentialVersion?r.catalogModels||[]:[], message: e.message }; }
}
export function verifiedBinding(input) {
  if (!input || typeof input !== 'object') throw new Error('Phân vai model không hợp lệ.');
  const connectionId = String(input.connectionId || ''), model = String(input.model || '');
  const r = registryEntry(connectionId);
  if (!r.models.includes(model)) throw new Error('Model không còn khả dụng cho kết nối này.');
  const c=getConnection(connectionId);
  if(['chatgpt_account','claude_account','gemini_account','antigravity_account'].includes(c.kind)){if(input.credentialVersion&&input.credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi. Hãy phân vai lại.');return {connectionId,model,credentialVersion:c.credentialVersion};}
  return { connectionId, model };
}
export function roleRef(projectId, role, member = 0) {
  if (!MODEL_ROLES.includes(role)) throw new Error('Vai trò model không hợp lệ.');
  return `role:${projectId}:${role}:${member}`;
}
export function projectRoleTarget(project, role, explicitId, member = 0) {
  const configured = project.modelRoles?.[role];
  if (role === 'council' ? configured?.length : configured) return roleRef(project.id, role, member);
  if (!explicitId) throw new Error(`Chưa phân vai ${role} cho dự án.`);
  return explicitId;
}
export function resolveBinding(target) {
  let binding;
  if (typeof target === 'string' && target.startsWith('role:')) {
    const [, projectId, role, index] = target.split(':');
    if (!MODEL_ROLES.includes(role) || !/^\d+$/.test(index || '')) throw new Error('Tham chiếu vai trò không hợp lệ.');
    const project = readJson('projects.json', []).find(p => p.id === projectId);
    if (!project) throw new Error('Không tìm thấy dự án cho vai trò.');
    binding = role === 'council' ? project.modelRoles?.council?.[Number(index)] : project.modelRoles?.[role];
    if (!binding) throw new Error(`Chưa phân vai ${role} cho dự án.`);
    return { ...verifiedBinding(binding), projectId, role, member: Number(index) };
  }
  if (target && typeof target === 'object') return {...verifiedBinding(target),role:target.usageContext?.role||null,projectId:target.usageContext?.projectId||null};
  // Existing explicit connection IDs keep their original account-default behavior.
  const c = getConnection(target);
  return { connectionId: c.id, model: c.model };
}
export function resolveModelConnection(target) {
  const b = resolveBinding(target), c = getConnection(b.connectionId);
  return { ...c, model: b.model, usageContext: {role:b.role||null,projectId:b.projectId||null} };
}
export function roleDescriptors(project) {
  const out = {};
  for (const role of MODEL_ROLES) {
    const bindings = role === 'council' ? project.modelRoles?.council || [] : project.modelRoles?.[role] ? [project.modelRoles[role]] : [];
    out[role] = bindings.map((b, i) => {
      let status = 'verified', message = '';
      try { verifiedBinding(b); } catch (e) { status = vaultStatus().unlocked ? 'unavailable' : 'locked'; message = e.message; }
      return { ...b, ref: roleRef(project.id, role, i), status, message };
    });
  }
  return out;
}

export function recordAccountCatalog(c,models){
 const current=getConnection(c.id);if(current.credentialVersion!==c.credentialVersion)throw new Error('Tài khoản đã thay đổi.');const all=registry(),old=all[c.id],catalogModels=[...new Set(models.filter(safeModel))].sort(),same=old?.revision===c.credentialVersion;
 const verified=same?(old.models||[]).filter(m=>catalogModels.includes(m)):[];all[c.id]={connectionId:c.id,kind:c.kind,revision:c.credentialVersion,status:verified.length?'verified':'catalog',models:verified,modelVerifiedAt:same?old.modelVerifiedAt||{}:{},verifiedAt:same?old.verifiedAt||null:null,catalogModels};writeJson(FILE,all);
}
export function recordAccountModel(c,model){const all=registry(),r=all[c.id];if(getConnection(c.id).credentialVersion!==c.credentialVersion||r?.revision!==c.credentialVersion||!r.catalogModels?.includes(model))throw new Error('Tài khoản/model đã thay đổi.');r.models=[...new Set([...r.models,model])];r.status='verified';r.verifiedAt=new Date().toISOString();r.modelVerifiedAt={...r.modelVerifiedAt,[model]:r.verifiedAt};writeJson(FILE,all);}
