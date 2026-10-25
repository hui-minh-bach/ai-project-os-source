/** Account keyed mesh ownership. Shared model assets are disposed by the parent scene only. */
import * as T from '/vendor/three.module.min.js';
import {clone as cloneRig} from '/vendor/addons/SkeletonUtils.js';
export function createFleetScene({parent,template,prepareRig,poseRobot}){
 const root=new T.Group();root.name='LiveAccountRobots';parent.add(root);
 const records=new Map(),ringGeometry=new T.RingGeometry(.30,.33,40);let selected=null,last=[];
 function remove(record){record.root.removeFromParent();record.ring.removeFromParent();record.ring.material.dispose();/* Never dispose shared GLB geometry/material here. */}
 function update(actors){
  last=actors;const ids=new Set(actors.map(a=>a.id));for(const [id,record]of records)if(!ids.has(id)){remove(record);records.delete(id);}
  for(const a of actors){let record=records.get(a.id);if(!record&&template){
    const model=cloneRig(template);model.name='AccountRobot_'+a.id;model.userData.connectionId=a.id;root.add(model);
    const rig=prepareRig(model),ring=new T.Mesh(ringGeometry,new T.MeshBasicMaterial({color:a.data.color,transparent:true,opacity:.36,depthWrite:false,toneMapped:false}));
    ring.name='AccountSelection_'+a.id;ring.rotation.x=-Math.PI/2;root.add(ring);record={root:model,rig,ring,metrics:{}};records.set(a.id,record);
   }
   if(!record)continue;record.root.visible=!!a.visible;record.ring.visible=!!a.visible;
   record.ring.material.color.set(a.data.color);record.ring.material.opacity=a.id===selected ? .82 : .27;
   record.metrics=poseRobot(record.rig,a.motion,a.station);record.ring.position.set(a.position.x,.046,a.position.z);
  }
  return [...records].map(([id,r])=>({id,...r.metrics}));
 }
 function labels(camera,width,height){camera.updateMatrixWorld(true);return last.map(a=>{
  const r=records.get(a.id);if(!r||!a.visible)return {id:a.id,visible:false};
  const p=r.rig.bones.Head_Rig.getWorldPosition(new T.Vector3());p.y+=.38;p.project(camera);
  return {id:a.id,visible:root.visible&&p.z>=-1&&p.z<=1&&Math.abs(p.x)<1.06&&Math.abs(p.y)<1.06,x:(p.x+1)*width/2,y:(1-p.y)*height/2};
 });}
 function pick(ndc,camera){const ray=new T.Raycaster();ray.setFromCamera(ndc,camera);const hits=ray.intersectObjects([...records.values()].filter(r=>r.root.visible).map(r=>r.root),true);let node=hits[0]?.object;while(node){if(node.userData.connectionId)return node.userData.connectionId;node=node.parent;}return null;}
 return {root,update,labels,pick,setSelected(id){selected=id;},size:()=>records.size,
  dispose(){for(const record of records.values())remove(record);records.clear();ringGeometry.dispose();root.removeFromParent();}};
}
