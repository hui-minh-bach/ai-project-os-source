// Boot each independent feature separately: one disconnected service must never
// make the entire 10-tab interface unusable or look as if no projects exist.
let customerBooting=false;
async function customerBootstrap(){
 if(customerBooting)return;
 customerBooting=true;
 const retry=$('#customerRetry');if(retry)retry.disabled=true;
 customerClearFailure();
 const steps=[
  ['Vault',vaultRefresh],
  ['kết nối AI',loadConnections],
  ['Skills',loadSkills],
  ['Engines',loadEngines],
  ['hệ thống',loadPrereq],
  ['dự án',loadProjects]
 ];
 const failures=[];
 for(const [name,load] of steps){
  try{await load();}catch(error){failures.push({name,error});}
 }
 if(state.connectionsError)failures.push({name:'kết nối AI',error:state.connectionsError});
 if(!state.prereqLoaded&&state.prereqError)failures.push({name:'trạng thái công cụ',error:new Error(state.prereqError)});
 if(failures.length){
  const first=failures[0];
  customerShowFailure(first.name,first.error);
  $('#customerErrorMessage').textContent+=` (${failures.length} mục chưa tải được). Hãy kiểm tra Local Worker rồi nhấn Thử kết nối lại.`;
 }
 try{renderHome();}catch(error){customerShowFailure('Trang chủ',error);}
 try{page('map');}catch{}
 customerBooting=false;if(retry)retry.disabled=false;
}
customerBootstrap();
