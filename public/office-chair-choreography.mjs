/**
 * Idea Studio B2 / TAM19 physical-looking chair action (V1 showcase).
 * Pure timeline in original source-pixel space, 1920 x 1280.
 * Use only as a visual preview until the exact seat is mapped to a live station.
 * Never changes an AI task's running, approved or completed state.
 *
 * AUTHORITATIVE STYLE: office-iso-backdrop.jpg + a cut-out from that image.
 * AUTHORITATIVE 3D ROBOT: /assets/tam19.glb; keyframes on existing joints.
 */
export const OFFICE_CHAIR_CANVAS = Object.freeze({width:1920,height:1280,chairLeft:605,chairTop:811,chairWidth:101,chairHeight:106,duration:20});
export const OFFICE_CHAIR_PHASES = Object.freeze([
 {start:0,end:1.6,state:'idle'},
 {start:1.6,end:4.8,state:'approach'},
 {start:4.8,end:5.5,state:'align'},
 {start:5.5,end:6.5,state:'reach'},
 {start:6.5,end:7.6,state:'pull'},
 {start:7.6,end:8.5,state:'stepToSeat'},
 {start:8.5,end:9.65,state:'sit'},
 {start:9.65,end:10.5,state:'scootIn'},
 {start:10.5,end:13,state:'work'},
 {start:13,end:14,state:'scootOut'},
 {start:14,end:15.1,state:'stand'},
 {start:15.1,end:16.2,state:'push'},
 {start:16.2,end:18.5,state:'leave'},
 {start:18.5,end:20,state:'done'}
]);
const clamp=x=>Math.max(0,Math.min(1,x));
export const officeChairEase=x=>{x=clamp(x);return x*x*(3-2*x);};
const ease=(t,a,b)=>officeChairEase((t-a)/(b-a));
const mix=(a,b,p)=>a+(b-a)*p;
const along=(t,points)=>{
 if(t<=points[0][0])return points[0][1];
 for(let i=0;i<points.length-1;i++){
  const [a,av]=points[i],[b,bv]=points[i+1];
  if(t<=b)return mix(av,bv,ease(t,a,b));
 }
 return points.at(-1)[1];
};

/** State must be evaluated on an elapsed-time clock (seconds), not setTimeout chains. */
export function officeChairAt(time){
 const t=Math.max(0,Math.min(20,Number.isFinite(time)?time:0));
 let phase,clip,clipTime,x,y,yaw;
 if(t<1.6){phase='idle';clip='Idle';clipTime=t;x=792;y=919;yaw=-115;}
 else if(t<4.8){
  phase='approach';clip='Walk';clipTime=(t-1.6);let q=ease(t,1.6,4.8);
  if(q<.5){x=mix(792,736,officeChairEase(q*2));y=mix(919,914,officeChairEase(q*2));}
  else{x=mix(736,687,officeChairEase((q-.5)*2));y=mix(914,910,officeChairEase((q-.5)*2));}
  yaw=-115;
 } else if(t<5.5){phase='align';clip='Idle';clipTime=t-4.8;x=687;y=910;yaw=mix(-115,-60,ease(t,4.8,5.5));}
 else if(t<6.5){phase='reach';clip='Reach_Chair';clipTime=Math.min(.899,t-5.5);x=687;y=910;yaw=-60;}
 else if(t<7.6){phase='pull';clip='Pull_Chair';clipTime=Math.min(1.099,t-6.5);const k=ease(t,6.5,7.6);x=mix(687,703,k);y=mix(910,923,k);yaw=-60;}
 else if(t<8.5){phase='stepToSeat';clip='Lower_Arms';clipTime=Math.min(.899,t-7.6);const k=ease(t,7.6,8.5);x=mix(703,671,k);y=mix(923,909,k);yaw=-60;}
 else if(t<9.65){phase='sit';clip='Sit_Down';clipTime=Math.min(1.049,(t-8.5)*1.05);x=671;y=909;yaw=-60;}
 else if(t<10.5){phase='scootIn';clip='Seated_Idle';clipTime=(t-9.65);const k=ease(t,9.65,10.5);x=mix(671,655,k);y=mix(909,901,k);yaw=-60;}
 else if(t<13){phase='work';clip='Seated_Work';clipTime=(t-10.5)%1.2;x=655;y=901;yaw=-60;}
 else if(t<14){phase='scootOut';clip='Seated_Idle';clipTime=(t-13);const k=ease(t,13,14);x=mix(655,671,k);y=mix(901,909,k);yaw=-60;}
 else if(t<15.1){phase='stand';clip='Stand_Up';clipTime=Math.min(.979,(t-14)*.9);x=671;y=909;yaw=-60;}
 else if(t<16.2){phase='push';clip='Push_Chair';clipTime=Math.min(1.099,t-15.1);const k=ease(t,15.1,16.2);x=mix(671,695,k);y=mix(909,897,k);yaw=-60;}
 else if(t<18.5){phase='leave';clip='Walk';clipTime=(t-16.2)*.95;const k=ease(t,16.2,18.5);x=mix(695,804,k);y=mix(897,935,k);yaw=-118;}
 else{phase='done';clip='Idle';clipTime=t-18.5;x=804;y=935;yaw=-118;}
 const move=along(t,[[0,0],[6.5,0],[7.6,1],[9.65,1],[10.5,.38],[13,.38],[14,1],[15.1,1],[16.2,0],[20,0]]);
 return Object.freeze({phase,time:t,clip,clipTime,robot:Object.freeze({x,y,yaw}),chair:Object.freeze({x:26*move,y:15*move})});
}

const ARM={Shoulder_L:-.90,Elbow_L:-.12,Wrist_L:.15,Shoulder_R:.1,Elbow_R:-.1,Head_Rig:.10};
const ARM_Z={Shoulder_L:.25,Shoulder_R:-.08,Wrist_L:.05};
const BONES=['Hip_L','Hip_R','Knee_L','Knee_R','Ankle_L','Ankle_R','Shoulder_L','Shoulder_R','Elbow_L','Elbow_R','Wrist_L','Wrist_R','Head_Rig'];
/** Build native Three.js clips on the ORIGINAL TAM19 joints, no model swapping. */
export function officeMakeTam19ChairClips(THREE,root){
 if(!BONES.every(n=>root.getObjectByName(n))||!root.getObjectByName('Body'))return null;
 const origins=new Map(BONES.map(n=>[n,root.getObjectByName(n).quaternion.clone()]));
 const body=root.getObjectByName('Body');const pos=body.position.clone();
 const xaxis=new THREE.Vector3(1,0,0),zaxis=new THREE.Vector3(0,0,1);
 function make(name,frames){
  const ts=frames.map(f=>f[0]);const tracks=[];
  for(const bone of BONES){
   const vals=[];
   for(const [,reach,lean] of frames){
    const qx=new THREE.Quaternion().setFromAxisAngle(xaxis,(ARM[bone]||0)*reach);
    const qz=new THREE.Quaternion().setFromAxisAngle(zaxis,(ARM_Z[bone]||0)*reach);
    const q=origins.get(bone).clone().multiply(qz).multiply(qx);
    vals.push(q.x,q.y,q.z,q.w);
   }
   tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`,ts,vals));
  }
  const v=[];for(const [,reach,lean] of frames)v.push(pos.x,pos.y-.034*lean,pos.z);
  tracks.push(new THREE.VectorKeyframeTrack('Body.position',ts,v));
  return new THREE.AnimationClip(name,ts.at(-1),tracks);
 }
 return {
  Reach_Chair:make('Reach_Chair',[[0,0,0],[.22,.1,.05],[.52,.65,.65],[.9,1,1]]),
  Pull_Chair:make('Pull_Chair',[[0,1,1],[.24,1,1],[.6,1,1.3],[1.1,1,.6]]),
  Lower_Arms:make('Lower_Arms',[[0,1,.6],[.24,.74,.3],[.5,.42,0],[.9,0,0]]),
  Push_Chair:make('Push_Chair',[[0,0,0],[.23,.55,.3],[.54,1,.7],[.8,.8,.3],[1.1,0,0]])
 };
}
