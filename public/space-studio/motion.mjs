/** Deterministic choreography shared by the browser and offline frame capture.
 * Scripted contact-constrained kinematics, NOT a rigid-body physics simulation.
 */
import {CHAIR,DURATION,clamp,smooth,mix,interval} from './design.mjs';
export const PHASES=Object.freeze([
 [0,3,'approach'],[3,4.2,'reach'],[4.2,6.7,'pull'],[6.7,10,'align'],
 [10,12.1,'sit'],[12.1,14,'scoot-in'],[14,19,'work'],[19,21,'scoot-out'],
 [21,23,'stand'],[23,25.1,'return-approach'],[25.1,27.6,'return'],[27.6,30,'leave']
]);
export const PHASE_LABELS=Object.freeze({
 approach:'\u0110i \u0111\u1ebfn gh\u1ebf',reach:'Tay ch\u1ea1m l\u01b0ng gh\u1ebf',pull:'K\u00e9o gh\u1ebf ra',
 align:'\u0110\u1ee9ng tr\u01b0\u1edbc m\u1eb7t gh\u1ebf',sit:'Ng\u1ed3i xu\u1ed1ng',
 'scoot-in':'D\u1ecbch v\u00e0o b\u00e0n',work:'L\u00e0m vi\u1ec7c', 'scoot-out':'L\u00f9i gh\u1ebf ra',
 stand:'\u0110\u1ee9ng d\u1eady','return-approach':'\u0110i v\u00f2ng b\u00ean gh\u1ebf',return:'Tr\u1ea3 gh\u1ebf v\u1ec1 ch\u1ed7',leave:'R\u1eddi tr\u1ea1m'
});
const keyframes=[
 [0,1.72,2.40,-2.26],[2.7,.64,1.60,-Math.PI/2],[4.2,.64,1.60,-Math.PI/2],
 [6.7,.64,2.16,-Math.PI/2],[7.15,.64,2.16,-Math.PI/2],[8.7,.69,1.19,Math.PI],[10,0,1.19,Math.PI],
 [12.1,0,1.58,Math.PI],[14,0,.72,Math.PI],[19,0,.72,Math.PI],[21,0,1.58,Math.PI],
 [23,0,1.19,Math.PI],[24.2,.69,1.19,Math.PI],[25.1,.64,2.16,-Math.PI/2],
 [27.6,.64,1.60,-Math.PI/2],[28.1,.64,1.60,-Math.PI/2],[30,1.72,2.40,.88]
];
function yawMix(a,b,t){let d=((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;return a+d*t;}
function path(t){
 for(let i=0;i<keyframes.length-1;i++){
  const a=keyframes[i],b=keyframes[i+1];if(t<=b[0]){const s=interval(t,a[0],b[0]);return {x:mix(a[1],b[1],s),z:mix(a[2],b[2],s),yaw:yawMix(a[3],b[3],s)};}
 }
 const k=keyframes.at(-1);return {x:k[1],z:k[2],yaw:k[3]};
}
export function motionAt(time){
 const t=clamp(Number.isFinite(time)?time:0,0,DURATION),p=path(t);
 const phase=PHASES.find(a=>t>=a[0]&&t<a[1])?.[2]||'leave';
 const seated=interval(t,10,12.1)*(1-interval(t,21,23));
 let pull=interval(t,4.2,6.7)-interval(t,12.1,14)+interval(t,19,21)-interval(t,25.1,27.6);
 pull=clamp(pull);const chairZ=CHAIR.homeZ+CHAIR.pull*pull-.30*(interval(t,12.1,14)-interval(t,19,21));
 const contact=phase==='reach'?interval(t,3,4.2):phase==='pull'?1:phase==='align'?1-interval(t,6.7,7.15):phase==='return-approach'?interval(t,24.65,25.1):phase==='return'?1:phase==='leave'?1-interval(t,27.6,28.1):0;
 const typing=interval(t,13.2,14.3)*(1-interval(t,18.3,19.3));
 const gait=gaitState(t);const walking=gait.blend>0.001;
 return {time:t,phase,...p,seated,chairZ,chairPull:pull,contact,typing,walking,gaitBlend:gait.blend,seatContact:seated>.999,grounded:!walking,robotPelvisY:mix(.692916-.035*gait.blend,CHAIR.pelvisY,seated)};
}

// Distance-driven steps: stance feet remain at a world-space contact anchor.
// Small ease-in/out windows settle the feet at starts/stops; no physics claim.
const WALK_WINDOWS=[[0,2.7],[4.2,6.7],[7.15,10],[23,25.1],[25.1,27.6],[28.1,30]];
function gaitState(t){
 const win=WALK_WINDOWS.find(([a,b])=>t>=a&&t<=b);if(!win)return {blend:0};
 const [a,b]=win,keys=keyframes.filter(k=>k[0]>=a&&k[0]<=b);
 const ap=path(a),bp=path(b);if(!keys.length||keys[0][0]!==a)keys.unshift([a,ap.x,ap.z,ap.yaw]);if(keys.at(-1)[0]!==b)keys.push([b,bp.x,bp.z,bp.yaw]);
 let length=0,distance=0;const spans=[];
 for(let i=0;i<keys.length-1;i++){const k=keys[i],n=keys[i+1],len=Math.hypot(n[1]-k[1],n[2]-k[2]);spans.push({a:k,b:n,start:length,len});if(t>=n[0])distance+=len;else if(t>k[0])distance+=len*interval(t,k[0],n[0]);length+=len;}
 const blend=smooth(distance/.11)*smooth((length-distance)/.11);return {blend,distance,length,spans};
}
export function gaitFootAt(time,side='L'){
 const t=clamp(Number.isFinite(time)?time:0,0,DURATION),p=path(t),g=gaitState(t),sign=side==='L'?-1:1,offset=.108*1.022;
 const rest={x:p.x+Math.cos(p.yaw)*sign*offset,z:p.z-Math.sin(p.yaw)*sign*offset,y:CHAIR.footY,yaw:p.yaw,stance:true};
 if(!g.blend)return rest;
 const sample=d=>{d=clamp(d,0,g.length);const q=g.spans.find(s=>d<=s.start+s.len)||g.spans.at(-1),f=q.len?(d-q.start)/q.len:0,yaw=yawMix(q.a[3],q.b[3],f);return {x:mix(q.a[1],q.b[1],f)+Math.cos(yaw)*sign*offset,z:mix(q.a[2],q.b[2],f)-Math.sin(yaw)*sign*offset,yaw};};
 const stride=.28,shift=side==='L'?0:.5,cycle=g.distance/stride+shift,n=Math.floor(cycle),f=cycle-n,anchor=(n-shift)*stride+stride*.30;
 const a=sample(anchor),b=sample(anchor+stride),swing=f>.62?smooth((f-.62)/.38):0;
 return {x:mix(rest.x,mix(a.x,b.x,swing),g.blend),z:mix(rest.z,mix(a.z,b.z,swing),g.blend),y:CHAIR.footY+Math.sin(swing*Math.PI)*.045*g.blend,yaw:yawMix(rest.yaw,yawMix(a.yaw,b.yaw,swing),g.blend),stance:f<=.62};
}

/** Analytical two-bone IK in plain 3-vectors. Returns bounded solve + residual. */
export function twoBone(start,target,L1,L2,pole){
 if([...start,...target,...pole,L1,L2].some(v=>!Number.isFinite(v))||L1<=0||L2<=0)throw new TypeError('Finite vectors and positive limb lengths are required.');
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),scale=(a,b)=>a.map(v=>v*b),add=(a,b)=>a.map((v,i)=>v+b[i]);
 let dV=sub(target,start),distance=Math.hypot(...dV),dir=distance>1e-8?scale(dV,1/distance):[0,-1,0];
 const distanceSolved=clamp(distance,Math.abs(L1-L2)+1e-6,L1+L2-1e-6);
 let u=sub(pole,scale(dir,dot(pole,dir))),ul=Math.hypot(...u);
 if(ul<1e-8){const fallback=Math.abs(dir[0])<.8?[1,0,0]:[0,0,1];u=sub(fallback,scale(dir,dot(fallback,dir)));ul=Math.hypot(...u);}
 u=scale(u,1/ul);
 const along=(L1*L1-L2*L2+distanceSolved*distanceSolved)/(2*distanceSolved),side=Math.sqrt(Math.max(0,L1*L1-along*along));
 const joint=add(start,add(scale(dir,along),scale(u,side))),end=add(start,scale(dir,distanceSolved));
 return {joint,end,residual:Math.abs(distance-distanceSolved),reachable:Math.abs(distance-distanceSolved)<.001};
}
