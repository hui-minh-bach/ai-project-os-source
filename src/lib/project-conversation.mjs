/** Project-scoped PUBLIC replies and recorded actions, never hidden reasoning. */
export function buildProjectConversation({project,runs=[],events=[],jobs=[],connections=[],calls=[]}={}){
 const out=[],names=new Map(connections.map(c=>[c.id,c.name]));
 const add=m=>{if(typeof m?.content!=='string'||!m.content.trim())return;out.push({id:String(m.id),at:m.at||null,kind:m.kind==='message'?'message':'activity',role:m.role||'system',actor:names.get(m.connectionId)||m.actor||({worker:'Worker',reviewer:'Reviewer',system:'Hệ thống'}[m.role])||'Đội AI',model:m.model||'',content:m.content.slice(0,12000)});};
 for(const run of runs.filter(r=>r.projectId===project?.id)){
  if(run.conversation?.length)for(const m of run.conversation)add(m);
  else{
   if(run.script?.text)add({id:run.id+':script',at:(run.steps||[]).find(s=>s.name==='ai.script')?.at||run.createdAt,role:'worker',connectionId:run.script.connectionId,actor:run.script.provider,model:run.script.model,content:run.script.text,kind:'message'});
   if(run.review?.feedback)add({id:run.id+':review',at:(run.steps||[]).filter(s=>s.name==='ai.review').at(-1)?.at||run.createdAt,role:'reviewer',connectionId:run.review.connectionId,actor:run.review.provider,model:run.review.model,content:run.review.feedback,kind:'message'});
  }
  for(const [i,s] of (run.steps||[]).entries())add({id:run.id+':step:'+i,at:s.at,kind:'activity',role:'system',content:({ 'ai.script':'Viết nội dung','ai.review':'Kiểm tra nội dung','produce.music':'Chuẩn bị nhạc','produce.story':'Dựng video','quality.media':'Kiểm tra MP4','delivery.local':'Lưu kết quả dự án' }[s.name]||s.name)+' · '+({running:'đang thực hiện',done:'hoàn thành',failed:'thất bại',revision:'cần sửa',waiting:'đang chờ'}[s.state]||s.state)});
  if(run.error)add({id:run.id+':error',at:run.steps?.at(-1)?.at,kind:'activity',role:'system',content:(run.error.code||'Lỗi')+': '+run.error.message});
 }
 for(const task of project?.tasks||[])for(const [i,execution] of (task.executionRuns||[]).entries()){
  const worker=execution.servedWorkerBinding||execution.workerBinding||task.servedWorkerBinding||task.workerBinding;
  if(execution.summary)add({id:task.id+':worker:'+i,at:execution.completedAt||execution.startedAt,kind:'message',role:'worker',connectionId:worker?.connectionId,model:worker?.model,content:execution.summary});
  for(const [j,review] of (execution.reviews||[]).entries())if(review.summary&&review.status!=='RUNNING'){const reviewer=execution.servedReviewerBinding||execution.reviewerBinding||task.servedReviewerBinding||task.reviewerBinding;add({id:task.id+':review:'+i+':'+j,at:review.completedAt||review.at,kind:'message',role:'reviewer',connectionId:reviewer?.connectionId,model:reviewer?.model,content:review.summary});}
 }
 for(const e of events){const p=e.payload||{};if(p.projectId&&p.projectId!==project?.id)continue;add({id:e.id,at:e.at,kind:'activity',connectionId:p.connectionId,actor:p.name,model:p.model,content:'Tạo ảnh cảnh '+(Number(p.scene||0)+1)+' · '+({running:'đang tạo',completed:'đã có ảnh',failed:'thất bại'}[p.state]||p.state)+(p.reason?' · '+p.reason:'')});}
 for(const j of jobs.slice(0,10))if(j.error)add({id:j.id+':error',at:j.updatedAt,kind:'activity',role:'system',content:(j.error.code||'Lỗi')+': '+j.error.message});
 for(const c of calls)if(c.projectId===project?.id&&c.state==='running')add({id:'call:'+c.id,at:Number.isFinite(c.startedAtMs)?new Date(c.startedAtMs).toISOString():null,kind:'activity',connectionId:c.connectionId,model:c.model,content:c.role==='image'?'Đang tạo ảnh':c.role==='reviewer'?'Đang kiểm tra nội dung':'Đang trả lời'});
 const unique=[...new Map(out.map(m=>[m.id,m])).values()];unique.sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));const selected=[...unique.filter(m=>m.kind==='message').slice(-80),...unique.filter(m=>m.kind!=='message').slice(-80)];selected.sort((a,b)=>String(a.at||'').localeCompare(String(b.at||'')));return selected;
}
