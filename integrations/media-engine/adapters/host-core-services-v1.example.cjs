'use strict';
// Registration recipe. NOT an implementation of the user's missing AI Project OS CoreServices v1.
const {registerMediaEngine}=require('../index.cjs');
function installMediaForHost({host,workspace,ffmpegBin,ffprobeBin}){
 // These functions MUST be wired by the AI Core owner to their actual stable v1 interfaces.
 // No modifications to AI Core, Vault, TaskQueue, EventBus, or UI are required here.
 const ports={
  ProviderGateway:{invoke:req=>host.models.invokeAuthorized(req)},
  TaskQueue:{registerTask:(name,handler)=>host.tasks.registerHandler(name,handler)},
  ArtifactStore:{putFile:r=>host.artifacts.putFile(r),putJson:r=>host.artifacts.putJson(r)},
  EventBus:{publish:(name,payload)=>host.events.publish(name,payload)}
 };
 return registerMediaEngine({CoreServices:ports,workspace,ffmpegBin,ffprobeBin});
}
module.exports={installMediaForHost};
