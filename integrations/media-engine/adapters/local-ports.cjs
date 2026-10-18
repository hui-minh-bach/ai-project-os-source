'use strict';
// ONLY a local integration-test adapter. Production must be supplied with real CoreServices v1 ports.
const {fs,path,mkdir,sha,insist,jsonWrite}=require('../src/utils.cjs');
function makeLocalPorts(root,{gateway=null,log=()=>{}}={}){
 const handlers=new Map(),jobs=[];const artifacts=mkdir(path.join(root,'artifacts'));
 return {
  ProviderGateway:gateway||{invoke:async()=>{throw Object.assign(new Error('Model provider not configured'),{code:'BLOCKED_PROVIDER'})}},
  TaskQueue:{registerTask:(name,handler)=>{insist(!handlers.has(name),'Duplicate media task');handlers.set(name,handler)},async dispatch(name,payload){insist(handlers.has(name),'Unknown task');jobs.push({name,payload});return handlers.get(name)(payload)}},
  ArtifactStore:{async putFile({jobId,source,name}){const dir=mkdir(path.join(artifacts,String(jobId).replace(/[^a-zA-Z0-9_-]/g,'_')));const target=path.join(dir,path.basename(name||source));if(path.resolve(source)!==path.resolve(target))fs.copyFileSync(source,target);return {uri:target,sha256:sha(fs.readFileSync(target))};},async putJson({jobId,name,data}){const dir=mkdir(path.join(artifacts,String(jobId).replace(/[^a-zA-Z0-9_-]/g,'_')));const dest=path.join(dir,path.basename(name));jsonWrite(dest,data);return {uri:dest,sha256:sha(fs.readFileSync(dest))};}},
  EventBus:{publish:(event,payload)=>log(event,payload)},
  _test:{handlers,jobs}
 };
}
module.exports={makeLocalPorts};
