import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { officeFindPath,officeChairPoint,officeDeskApproach,officeRoute,officeMakeTam19SeatClips } from '../public/office-motion.mjs';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const src=fs.readFileSync(path.join(HERE,'../public/tabs/team.js'),'utf8');
const collision=(a,b,circle)=>{
 const steps=50;
 for(let i=0;i<=steps;i++){
  const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
  if(Math.hypot(x-circle.x,z-circle.z)<circle.r-.03)return true;
 }
 return false;
};
test('nav: A* goes around desk rather than walking through it',()=>{
 const obstacle={x:0,z:0,r:1.5},start={x:-5,z:0},dest={x:5,z:0};
 const path=officeFindPath(start,dest,[obstacle]);
 assert.ok(path.length>1,'detour creates at least one waypoint');
 const pts=[start,...path];
 for(let i=0;i<pts.length-1;i++)assert.equal(collision(pts[i],pts[i+1],obstacle),false,'route segment clears desk');
 assert.ok(Math.hypot(path.at(-1).x-dest.x,path.at(-1).z-dest.z)<.02);
});
test('nav: chair point follows the actual 180-degree rotated desk',()=>{
 const seat=officeChairPoint({x:4.7,z:-4,yaw:Math.PI});
 assert.ok(Math.abs(seat.x-4.7)<1e-8);
 assert.ok(Math.abs(seat.z+4.28)<1e-8);
 assert.ok(Math.abs(seat.yaw)<1e-8);
});
test('nav: approach lands in clear aisle and final leg ends at chair',()=>{
 const desk={x:0,z:-2,yaw:Math.PI,r:1.52};
 const chair=officeChairPoint(desk);
 const approach=officeDeskApproach(desk,[desk]);
 assert.ok(Math.hypot(approach.x,approach.z+2)>desk.r);
 const route=officeRoute({x:6,z:1},chair,[desk],{toDesk:desk});
 assert.ok(route.length>=2);
 assert.deepEqual(route.at(-1),{x:chair.x,z:chair.z});
});
test('nav: route out of an occupied chair begins with an exit waypoint',()=>{
 const oldDesk={x:-4,z:-3,yaw:Math.PI,r:1.52};
 const newDesk={x:4,z:2,yaw:Math.PI,r:1.52};
 const route=officeRoute(officeChairPoint(oldDesk),officeChairPoint(newDesk),[oldDesk,newDesk],{fromDesk:oldDesk,toDesk:newDesk});
 assert.ok(route.length>=3);
 assert.ok(Math.hypot(route[0].x-oldDesk.x,route[0].z-oldDesk.z)>oldDesk.r);
});
test('native pose: real THREE.AnimationMixer applies Sit_Down and Stand_Up to TAM19 joints',async()=>{
 const THREE=await import('../public/vendor/three.module.min.js');
 const root=new THREE.Group(),body=new THREE.Group();body.name='Body';root.add(body);
 for(const name of ['Hip_L','Hip_R','Knee_L','Knee_R','Ankle_L','Ankle_R','Shoulder_L','Shoulder_R','Elbow_L','Elbow_R','Wrist_L','Wrist_R','Head_Rig']){
  const o=new THREE.Group();o.name=name;body.add(o);
 }
 const clips=officeMakeTam19SeatClips(THREE,root);assert.ok(clips);
 assert.ok(clips.sitDown.tracks.some(t=>t.name==='Hip_L.quaternion'));
 const mixer=new THREE.AnimationMixer(root);
 const sit=mixer.clipAction(clips.sitDown);sit.setLoop(THREE.LoopOnce,1);sit.clampWhenFinished=true;sit.play();
 mixer.update(clips.sitDown.duration);
 assert.ok(Math.abs(body.position.y+.28)<.002,'body lowered by physical seat offset');
 assert.ok(Math.abs(body.getObjectByName('Knee_L').rotation.x)>1.2,'knees bend through real tracks');
 sit.stop();const stand=mixer.clipAction(clips.standUp);stand.setLoop(THREE.LoopOnce,1);stand.clampWhenFinished=true;stand.play();
 mixer.update(clips.standUp.duration);
 assert.ok(Math.abs(body.position.y)<.002,'standing returns to native height');
 assert.ok(Math.abs(body.getObjectByName('Knee_L').rotation.x)<.002);
});
test('model loading: all robots use stock TAM19 unless replaced by uploaded GLB',()=>{
 assert.match(src,/for\(const A of Object.values\(agents\)\)officeAttachTam\(A\)/);
 assert.match(src,/source:'stock'/);
 assert.match(src,/source:'upload'/);
 assert.match(src,/officeWrapProcedural\(built\)/);
});
