/** Read-only projection for R3. Legacy fleet and execution logic are untouched. */
import { AI_KINDS, roleBindings } from './model-bindings.mjs';
import { fleetProviderLabel, fleetProviderColor } from './office-fleet.mjs';
import { FLEET_SCHEMA, ROLE_LABELS, STATE_LABELS, safeText } from '../../public/space-studio/fleet-contract.mjs';
const ACTIVE_TASKS=new Set(['preparing','running','repairing','testing','reviewing','merging']);
const TERMINAL_BAD=new Set(['failed','interrupted','merge-conflict','review']);
const when=v=>{const n=typeof v==='number'?v:Date.parse(v||'');return Number.isFinite(n)?n:0;};
const array=v=>Array.isArray(v)?v:[];
const rolesOf=p=>p?.modelRoles||{};
const conn=b=>typeof b==='string'?b:safeText(b?.connectionId||'');
const taskState=t=>t.status==='reviewing'?'reviewing':t.status==='testing'||t.status==='merging'?'rendering':'working';
const roleState=r=>r==='founder'||r==='council'?'planning':r==='reviewer'?'reviewing':'working';
const jobOf=(p,id,title,role,phase,source,state,model='')=>({id:safeText(id),projectId:safeText(p?.id),projectName:safeText(p?.name),title:safeText(title,200),role,phase,source,state,model:safeText(model,120)});
const phaseLabel=phase=>({coding:'\u0110ang vi\u1ebft code',repairing:'\u0110ang s\u1eeda theo review',testing:'Engine \u0111ang ki\u1ec3m th\u1eed',merging:'H\u1ec7 th\u1ed1ng \u0111ang g\u1ed9p k\u1ebft qu\u1ea3',preparing:'\u0110ang chu\u1ea9n b\u1ecb t\u00e1c v\u1ee5',reviewing:'Reviewer \u0111ang ki\u1ec3m tra'}[phase]||'');
export function deriveSpaceFleet({connections=[],projects=[],runs=[],activity=[],workJobs=[],nowMs=Date.now()}={}){
  const byConn=new Map(),recent=new Map(),projectById=new Map(array(projects).map(p=>[String(p.id),p]));
  for(const c of array(connections)){
    if(!c?.id||!AI_KINDS.includes(c.kind)||byConn.has(String(c.id)))continue;
    const cooling=when(c.coolingUntil)>nowMs;
    byConn.set(String(c.id),{connectionId:String(c.id),name:safeText(c.name||fleetProviderLabel(c.kind),100),provider:fleetProviderLabel(c.kind),
      kind:c.kind,color:fleetProviderColor(c.kind),connected:!!c.connected,roles:[],role:'unassigned',state:!c.connected?'offline':cooling?'quota':'ready',
      coolingUntil:cooling?c.coolingUntil:null,activeCalls:0,jobs:[],source:'connection',priority:0});
  }
  function addRole(cid,role){const b=byConn.get(String(cid));if(b&&Object.hasOwn(ROLE_LABELS,role)&&!b.roles.includes(role))b.roles.push(role);}
  function add(cid,job,priority){const b=byConn.get(String(cid));if(!b)return false;addRole(cid,job.role);
    if(!b.jobs.some(j=>j.id===job.id&&j.source===job.source&&j.role===job.role))b.jobs.push(job);
    if(priority>b.priority){b.priority=priority;b.state=job.state;b.role=job.role||b.role;b.source=job.source;b.activityLabel=phaseLabel(job.phase)||STATE_LABELS[job.state];}
    return true;
  }
  function finish(cid,state,time,job){const b=byConn.get(String(cid));time=when(time);if(!b||!time||time>nowMs+60000)return;
    const prior=recent.get(b.connectionId);if(!prior||time>prior.time)recent.set(b.connectionId,{state,time,job});
  }
  for(const p of array(projects)){
    const roles=rolesOf(p);for(const r of ['founder','worker','reviewer','council'])for(const b of roleBindings(p,r))addRole(conn(b),r);
    for(const task of array(p.tasks)){
      if(task.archivedAt||task.archived)continue;
      const execution=array(task.executionRuns).at(-1)||{};
      // Frozen bindings outrank present-day role settings. Never reassign old work by a new role selection.
      const worker=execution.servedWorkerBinding||task.servedWorkerBinding||execution.workerBinding||task.workerBinding||task.assignedWorker||roles.worker;
      const reviewer=execution.servedReviewerBinding||task.servedReviewerBinding||execution.reviewerBinding||task.reviewerBinding||task.assignedReviewer||roles.reviewer;
      const role=task.status==='reviewing'?'reviewer':'worker',binding=role==='reviewer'?reviewer:worker;
      const phase=safeText(task.executionStage||task.status,50),id=task.id||execution.id;
      if(ACTIVE_TASKS.has(task.status))add(conn(binding),jobOf(p,id,task.title,role,phase,'task',taskState(task),binding?.model),60);
      if(task.status==='reviewing'&&conn(worker)!==conn(reviewer))add(conn(worker),jobOf(p,id,task.title,'worker','waiting-review','task','waiting',worker?.model),30);
      else if(task.status==='review')add(conn(worker),jobOf(p,id,task.title,'worker','waiting-approval','task','waiting',worker?.model),30);
      else if(['todo','queued'].includes(task.status)){
        const assigned=task.assignedWorker||null;
        if(assigned)add(conn(assigned),jobOf(p,id,task.title,'worker','queued','task','waiting',assigned?.model),10);
      }
      const ended=task.completedAt||execution.completedAt;
      if(['done','completed',...TERMINAL_BAD].includes(task.status)){
        const outcome=task.status==='done'||task.status==='completed'?'completed':'error';
        finish(conn(worker),outcome,ended,jobOf(p,id,task.title,'worker',phase,'task',outcome,worker?.model));
      }
    }
    for(const run of array(p.councilRuns).slice(-4)){
      for(const member of [...array(run.members),...(run.chair?[run.chair]:[])]){
        const binding=member.served||member.binding||member.descriptor,cid=conn(binding);
        if(run.status==='running'&&member.status==='running')add(cid,jobOf(p,run.id,'AI Council','council','council','council','planning',binding?.model),70);
        else if(['completed','failed'].includes(member.status))finish(cid,member.status==='completed'?'completed':'error',member.at||run.completedAt,jobOf(p,run.id,'AI Council','council','council','council',member.status==='completed'?'completed':'error',binding?.model));
      }
    }
  }
  // A parent project job survives short provider calls and long local engine work.
  // Assigned participants keep their desk; activeCalls remains the observed truth.
  const activeProjects=new Map();
  for(const j of array(workJobs))if(['queued','running'].includes(j.state))activeProjects.set(String(j.projectId),j);
  for(const r of array(runs))if(r.state==='running'&&r.aiMode!=='simulated'&&!array(r.steps).some(s=>s.detail?.aiMode==='simulated'))activeProjects.set(String(r.projectId),r);
  for(const [pid,job] of activeProjects){const p=projectById.get(pid);if(!p)continue;
    for(const role of ['worker','reviewer']){const served=role==='worker'?job.script:job.review;const bindings=served?.connectionId?[served]:roleBindings(p,role);for(const binding of bindings)add(conn(binding),jobOf(p,job.id,job.title||p.name,role,'project-in-progress','project-assignment','waiting',binding?.model),25);}
    for(const binding of [job.script,job.review].filter(x=>x?.connectionId))add(binding.connectionId,jobOf(p,job.id,job.title,'worker','project-in-progress','project-participant','waiting',binding.model),26);
  }
  let unassignedRuns=0,simulatedRuns=0;
  for(const run of array(runs)){
    if(!['running','awaiting_approval','awaiting-approval','pending_approval'].includes(run?.state))continue;
    if(run.aiMode==='simulated'||array(run.steps).some(s=>s.detail?.aiMode==='simulated')){simulatedRuns++;continue;}
    const p=projectById.get(String(run.projectId));
    // Media stores the served identity, not only the originally selected model.
    const binding=run.script?.connectionId?{connectionId:run.script.connectionId,model:run.script.model}:run.workerBinding||rolesOf(p).worker;
    const step=array(run.steps).at(-1),phase=safeText(step?.name||'pipeline',50);
    // A render/publish pipeline is not itself an active AI request. Provider observation below identifies actual calls.
    const state=run.state==='running'?'rendering':'waiting';
    if(!add(conn(binding),jobOf(p,run.id,run.title,'worker',phase,'orchestrator',state,binding?.model),40))unassignedRuns++;
  }
  for(const call of array(activity)){
    const b=byConn.get(String(call.connectionId));if(!b)continue;
    const role=Object.hasOwn(ROLE_LABELS,call.role)?call.role:(b.roles.length===1?b.roles[0]:'unassigned');
    const p=projectById.get(String(call.projectId)),state=roleState(role);
    const j=jobOf(p,call.taskId||call.id,'AI request',role,'provider','provider',state,call.model);
    if(call.state==='running'){
      b.activeCalls++;add(call.connectionId,j,100);b.activityLabel=STATE_LABELS[state];
    }else{const parent=activeProjects.get(String(call.projectId));if(parent)add(call.connectionId,jobOf(p,parent.id,parent.title||p?.name,role,'project-in-progress','project-participant','waiting',call.model),26);finish(call.connectionId,call.state==='completed'?'completed':'error',call.endedAtMs,{...j,state:call.state==='completed'?'completed':'error'});}
  }
  const bots=[...byConn.values()].map(b=>{
    // Quota and unavailable credentials override merely inferred assignment, but never an observed active request.
    if(b.priority<100&&(!b.connected||b.coolingUntil)){b.state=!b.connected?'offline':'quota';b.activityLabel=STATE_LABELS[b.state];b.source='connection';}
    else if(b.priority===0){const e=recent.get(b.connectionId);if(e&&nowMs-e.time<(e.state==='completed'?12000:5*60*1000)){b.state=e.state;b.jobs=[e.job];b.source=e.job.source;}}
    if(b.role==='unassigned'&&b.roles.length)b.role=b.roles[0];
    b.activityLabel=b.activityLabel||STATE_LABELS[b.state];b.statusLabel=STATE_LABELS[b.state];
    const rank={provider:0,task:1,orchestrator:2,'project-participant':3,'project-assignment':4};b.jobs.sort((a,b)=>(rank[a.source]??5)-(rank[b.source]??5));b.jobs=b.jobs.slice(0,12);delete b.priority;return b;
  });
  return {schema:FLEET_SCHEMA,source:'live',generatedAt:new Date(nowMs).toISOString(),bots,unassignedRuns,simulatedRuns};
}
