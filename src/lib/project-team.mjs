import {getProject,updateProjectModelRoles} from './projects.mjs';
import {listConnections} from './vault.mjs';
import {AI_KINDS,modelAvailability,roleBindings} from './model-bindings.mjs';
export function ensureProjectTeam(id){
 const p=getProject(id),roles=structuredClone(p.modelRoles||{}),candidates=[];
 for(const c of listConnections().filter(c=>AI_KINDS.includes(c.kind))){const a=modelAvailability(c.id);for(const model of [...new Set([c.model,...(a.verifiedModels||[]),...(a.models||[])].filter(Boolean))])if((a.models||[]).includes(model))candidates.push({connectionId:c.id,model});}
 if(!candidates.length)throw Object.assign(new Error('Chua co AI san sang. Them ket noi va nap danh muc model tai Ket noi.'),{code:'TEAM_MISSING'});
 roles.founder??=candidates[0];roles.worker??=candidates.find(x=>x.connectionId!==roles.founder.connectionId)||roles.founder;
 roles.reviewer??=candidates.find(x=>x.connectionId!==roles.worker.connectionId)||candidates.find(x=>x.model!==roles.worker.model);
 if(!roles.reviewer||!roleBindings({...p,modelRoles:roles},'worker').every(w=>roleBindings({...p,modelRoles:roles},'reviewer').some(v=>v.connectionId!==w.connectionId||v.model!==w.model)))throw Object.assign(new Error('Can Worker va Reviewer khac binding tai khoan/model de kiem tra cheo. Chon ngay tai Truong phong.'),{code:'TEAM_REVIEWER'});
 if(!roles.council?.length)roles.council=[roles.founder,roles.reviewer].filter((x,i,a)=>a.findIndex(y=>y.connectionId===x.connectionId&&y.model===x.model)===i);
 if(JSON.stringify(roles)!==JSON.stringify(p.modelRoles))updateProjectModelRoles(id,{...roles,teams:Object.fromEntries(['founder','worker','reviewer'].map(k=>[k,roleBindings(p,k).length?roleBindings(p,k):roles[k]?[roles[k]]:[]])),backups:p.modelRoleBackups||{}});
 return getProject(id);
}
