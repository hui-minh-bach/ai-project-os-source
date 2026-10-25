/** R3 live fleet controller. Account truth and decorative poses are separate.
 * Preserves R2 geometry/demo. Serializes aisle transitions instead of making
 * robots pass through each other. A blocked route remains visibly waiting.
 */
import {STATIONS,CHAIR,clamp,mix,smooth,interval} from './design.mjs';
import {motionAt} from './motion.mjs';
import {BUSY_STATES,TYPING_STATES,normalizeFleetSnapshot} from './fleet-contract.mjs';
import {findWalkPath,waitingSlots} from './navigation.mjs';
const byStation=new Map(STATIONS.map(s=>[s.id,s]));
const angle=(a,b,t)=>a+(((b-a+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI)*t;
// A shorter chair pull leaves clearance to the next row without moving furniture.
const KEYS=[[3,.64,1.6,-Math.PI/2],[4.2,.64,1.6,-Math.PI/2],[6.7,.64,1.96,-Math.PI/2],[7.15,.64,1.96,-Math.PI/2],
 [8.7,.69,1.19,Math.PI],[10,0,1.19,Math.PI],[12.1,0,1.38,Math.PI],[14,0,.72,Math.PI],[19,0,.72,Math.PI],
 [21,0,1.38,Math.PI],[23,0,1.19,Math.PI],[24.2,.69,1.19,Math.PI],[25.1,.64,1.96,-Math.PI/2],[27.6,.64,1.6,-Math.PI/2]];
const WALK=[[4.2,6.7],[7.15,10],[23,25.1],[25.1,27.6]];
function compactPath(t){
 if(t<=3)return {x:KEYS[0][1],z:KEYS[0][2],yaw:KEYS[0][3]};
 for(let i=0;i<KEYS.length-1;i++){const a=KEYS[i],b=KEYS[i+1];if(t<=b[0]){const f=interval(t,a[0],b[0]);return {x:mix(a[1],b[1],f),z:mix(a[2],b[2],f),yaw:angle(a[3],b[3],f)};}}
 const k=KEYS.at(-1);return {x:k[1],z:k[2],yaw:k[3]};
}
function compactFeet(t,p){
 const window=WALK.find(([a,b])=>t>=a&&t<=b),span=[];let total=0,distance=0;
 if(window){const keys=KEYS.filter(k=>k[0]>=window[0]&&k[0]<=window[1]);for(let i=0;i<keys.length-1;i++){const a=keys[i],b=keys[i+1],len=Math.hypot(b[1]-a[1],b[2]-a[2]);span.push({a,b,len,start:total});if(t>=b[0])distance+=len;else if(t>a[0])distance+=len*interval(t,a[0],b[0]);total+=len;}}
 const blend=total?smooth(distance/.10)*smooth((total-distance)/.10):0;
 function sample(d,sign){d=clamp(d,0,total);const q=span.find(q=>d<=q.start+q.len)||span.at(-1);if(!q)return {x:p.x+Math.cos(p.yaw)*sign*.1104,z:p.z-Math.sin(p.yaw)*sign*.1104,yaw:p.yaw};const f=q.len?(d-q.start)/q.len:0,yaw=angle(q.a[3],q.b[3],f);return {x:mix(q.a[1],q.b[1],f)+Math.cos(yaw)*sign*.1104,z:mix(q.a[2],q.b[2],f)-Math.sin(yaw)*sign*.1104,yaw};}
 const out={};for(const [side,sign]of [['L',-1],['R',1]]){
  const rest={x:p.x+Math.cos(p.yaw)*sign*.1104,z:p.z-Math.sin(p.yaw)*sign*.1104,y:CHAIR.footY,yaw:p.yaw};
  if(!blend){out[side]=rest;continue;}const stride=.24,shift=side==='L'?0:.5,c=distance/stride+shift,n=Math.floor(c),f=c-n,swing=f>.62?smooth((f-.62)/.38):0,a=sample((n-shift)*stride+stride*.30,sign),b=sample((n-shift)*stride+stride*1.30,sign);
  out[side]={x:mix(rest.x,mix(a.x,b.x,swing),blend),z:mix(rest.z,mix(a.z,b.z,swing),blend),y:CHAIR.footY+Math.sin(swing*Math.PI)*.038*blend,yaw:angle(rest.yaw,angle(a.yaw,b.yaw,swing),blend)};
 }
 return {feet:out,blend};
}
export function workstationMotionAt(t,{typing=true,clock=t}={}){
 t=clamp(t,3,27.6);const m=motionAt(t),p=compactPath(t),g=compactFeet(t,p);
 return {...m,...p,chairZ:m.chairZ-.20*m.chairPull,footTargets:g.feet,gaitBlend:g.blend,walking:g.blend>.001,
  animationTime:clock,typing:typing?m.typing:0,robotPelvisY:mix(.692916-.035*g.blend,CHAIR.pelvisY,m.seated)};
}
function standingPose(x,z,yaw,clock){return {...motionAt(3),x,z,yaw,seated:0,seatContact:false,contact:0,typing:0,walking:false,gaitBlend:0,robotPelvisY:.692916,phase:'standby',animationTime:clock};}
function routePose(actor,clock){
 const p=standingPose(actor.x,actor.z,actor.yaw,clock);p.phase='travel';
 const spans=[];let total=0;for(let i=1;i<actor.path.length;i++){const a=actor.path[i-1],b=actor.path[i],len=Math.hypot(b.x-a.x,b.z-a.z);spans.push({a,b,len,start:total});total+=len;}
 const blend=smooth(actor.distance/.13)*smooth((total-actor.distance)/.13);
 const sample=(distance,sign)=>{distance=clamp(distance,0,total);const q=spans.find(s=>distance<=s.start+s.len)||spans.at(-1),f=q.len?(distance-q.start)/q.len:0,yaw=Math.atan2(q.b.x-q.a.x,q.b.z-q.a.z);return {x:mix(q.a.x,q.b.x,f)+Math.cos(yaw)*sign*.11,z:mix(q.a.z,q.b.z,f)-Math.sin(yaw)*sign*.11,yaw};};
 p.walking=blend>.001;p.gaitBlend=blend;p.robotPelvisY-=.025*blend;p.footTargets={};
 for(const [side,sign]of [['L',-1],['R',1]]){const stride=.27,shift=side==='L'?0:.5,c=actor.distance/stride+shift,n=Math.floor(c),f=c-n,swing=f>.62?smooth((f-.62)/.38):0,a=sample((n-shift)*stride+stride*.30,sign),b=sample((n-shift)*stride+stride*1.30,sign);
  const rest={x:actor.x+Math.cos(actor.yaw)*sign*.11,z:actor.z-Math.sin(actor.yaw)*sign*.11};
  p.footTargets[side]={x:mix(rest.x,mix(a.x,b.x,swing),blend),z:mix(rest.z,mix(a.z,b.z,swing),blend),y:CHAIR.footY+Math.sin(swing*Math.PI)*.04*blend,yaw:angle(actor.yaw,angle(a.yaw,b.yaw,swing),blend)};}
 return p;
}

// An AI request finishing is NOT the same as the parent job finishing.
export function hasUnfinishedWork(data){
 return BUSY_STATES.has(data?.state)||(data?.jobs||[]).some(j=>j.id&&!['completed','done','failed','cancelled','rejected','error'].includes(j.state));
}
export function createLiveFleetController({idleRestSeconds=60}={}){
 const actors=new Map(),seats=new Map();let hydrated=false,clock=0,trafficOwner=null,stale=false,paused=false,slots=[],receivedAt=0,snapshot=null;
 const position=a=>{if(a.seatId&&['seated','entering','exiting'].includes(a.phase)){const s=byStation.get(a.seatId),m=workstationMotionAt(a.phase==='seated'?16:a.motionTime);return {x:s.x+m.x,z:s.z+m.z};}return {x:a.x,z:a.z};};
 function release(a){if(a.seatId&&seats.get(a.seatId)===a.id)seats.delete(a.seatId);a.seatId=null;}
 function reserve(a){if(a.seatId)return true;const preferences=a.data.role==='founder'?['pm']:a.data.role==='reviewer'?['review']:a.data.role==='council'?['agent-8']:[];const s=[...preferences,...STATIONS.map(s=>s.id)].find(id=>!seats.has(id));if(!s)return false;seats.set(s,a.id);a.seatId=s;return true;}
 function freeSlot(){const used=new Set([...actors.values()].map(a=>a.slot));for(let i=0;i<slots.length;i++)if(!used.has(i))return i;return -1;}
 function update(input,nowMs=Date.now()){
  const next=normalizeFleetSnapshot(input);snapshot=next;receivedAt=nowMs;stale=false;slots=waitingSlots(Math.max(next.bots.length+12,28));
  const ids=new Set(next.bots.map(b=>b.connectionId));for(const [id,a]of actors)if(!ids.has(id)){release(a);actors.delete(id);if(trafficOwner===id)trafficOwner=null;}
  // The first *nonempty* roster must seat all available accounts, even when
  // the viewer initially received an empty snapshot while the API was loading.
  const firstRoster=actors.size===0;
  // Reserve the manager/reviewer workstations before generic workers consume
  // seats. This order affects chair choice only, not task execution.
  const order={founder:0,reviewer:1,council:2,worker:3,unassigned:4};
  const incoming=[...next.bots].sort((a,b)=>(order[a.role]??5)-(order[b.role]??5));
  for(const b of incoming){let a=actors.get(b.connectionId);if(a){const was=hasUnfinishedWork(a.data);a.data=b;if(was&&!hasUnfinishedWork(b)&&['completed','error'].includes(b.state))a.doneAt=clock;if(hasUnfinishedWork(b)){a.idleAt=clock;a.yieldSeat=false;if(a.phase==='exiting'||a.phase==='depart'){a.phase='exiting';a.returnToSeat=true;trafficOwner=a.id;}else if(a.phase==='travel'&&a.afterRoute==='standby'&&a.seatId){const st=byStation.get(a.seatId);startRoute(a,{x:st.x+.64,z:st.z+1.6},'entering');}}}
   else{const slot=freeSlot(),home=slots[slot]||null;a={id:b.connectionId,data:b,seatId:null,slot,home,visible:!!home,x:home?.x||0,z:home?.z||0,yaw:Math.PI,phase:'standby',motionTime:3,idleAt:clock,doneAt:null,retryAt:0,path:null,distance:0,waitingReason:'',yieldSeat:false,needsDesk:true};actors.set(a.id,a);
    if(firstRoster&&b.connected&&!['offline','quota','error'].includes(b.state)&&reserve(a)){a.phase='seated';a.motionTime=16;a.needsDesk=false;const p=position(a);a.x=p.x;a.z=p.z;a.visible=true;}}
  }
  hydrated=true;return view();
 }
 function startRoute(a,target,then){
  const occupied=[...actors.values()].filter(b=>b!==a&&b.visible).map(b=>({...position(b),radius:.25}));
  const route=findWalkPath({x:a.x,z:a.z},target,{occupied});
  if(!route){a.waitingReason='route-blocked';a.retryAt=clock+2;return false;}
  a.path=route;a.pathIndex=1;a.afterRoute=then;a.phase='travel';a.waitingReason='';a.distance=0;trafficOwner=a.id;return true;
 }
 function step(dt=0){
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);if(paused||stale)return view();clock+=dt;
  // Give a genuinely busy overflow account the next released chair, without replacing furniture.
  const overflow=[...actors.values()].find(a=>hasUnfinishedWork(a.data)&&!a.seatId);
  if(overflow&&seats.size>=STATIONS.length){const victim=[...actors.values()].find(a=>a.phase==='seated'&&!hasUnfinishedWork(a.data));if(victim)victim.yieldSeat=true;}
  for(const a of actors.values()){
   const busy=hasUnfinishedWork(a.data),bad=['offline','quota','error'].includes(a.data.state);
   if(a.phase==='seated'){
    if(busy){a.idleAt=clock;a.doneAt=null;continue;}
    // Stay at a real desk while connected/ready; a timer must never gather all
    // idle robots at the waiting rail. Completed work may go recharge.
    const leave=bad||a.yieldSeat||(a.data.state==='completed'&&a.doneAt!==null&&clock-a.doneAt>3);
    if(leave&&!trafficOwner){trafficOwner=a.id;a.phase='exiting';a.motionTime=19;a.waitingReason='';}
   }else if(a.phase==='entering'){
    a.motionTime=Math.min(14,a.motionTime+dt*1.15);
    if(a.motionTime>=14){a.phase='seated';a.motionTime=16;a.needsDesk=false;a.idleAt=clock;if(!busy&&a.data.state==='completed')a.doneAt=clock;trafficOwner=null;}
   }else if(a.phase==='exiting'){
    if(a.returnToSeat){a.motionTime=Math.max(14,a.motionTime-dt*1.15);if(a.motionTime<=14){a.phase='seated';a.motionTime=16;a.returnToSeat=false;a.needsDesk=false;trafficOwner=null;}continue;}
    a.motionTime=Math.min(27.6,a.motionTime+dt*1.15);
    if(a.motionTime>=27.6){const p=position(a);a.x=p.x;a.z=p.z;a.yaw=-Math.PI/2;a.phase='depart';}
   }else if(a.phase==='travel'){
    // Only one robot owns aisle traffic; seated workers continue independently.
    const goal=a.path[a.pathIndex],dx=goal.x-a.x,dz=goal.z-a.z,d=Math.hypot(dx,dz),distance=Math.min(d,dt*.78);
    const nx=a.x+(d?dx/d*distance:0),nz=a.z+(d?dz/d*distance:0);
    const obstructed=[...actors.values()].some(b=>b!==a&&b.visible&&Math.hypot(position(b).x-nx,position(b).z-nz)<.43);
    if(obstructed){
     a.waitingReason='traffic';
     // A newly linked account can occupy the old route. Replan without moving
     // the root through it; keep exclusive traffic ownership until safe again.
     if(clock>=a.retryAt){
      a.retryAt=clock+1.5;const end=a.path.at(-1),occupied=[...actors.values()].filter(b=>b!==a&&b.visible).map(b=>({...position(b),radius:.25}));
      const detour=findWalkPath({x:a.x,z:a.z},end,{occupied});
      if(detour){a.path=detour;a.pathIndex=1;a.distance=0;a.waitingReason='';}
     }
     continue;
    }
    a.waitingReason='';a.x=nx;a.z=nz;a.distance+=distance;if(d>.001)a.yaw=angle(a.yaw,Math.atan2(dx,dz),Math.min(1,dt*8));
    if(d<=distance+.001){a.pathIndex++;if(a.pathIndex>=a.path.length){a.path=null;a.phase=a.afterRoute;a.motionTime=3;if(a.phase==='standby'){release(a);trafficOwner=null;a.yieldSeat=false;}}}
   }else if(a.phase==='depart'){
    if(clock<a.retryAt)continue;
    if(trafficOwner&&trafficOwner!==a.id){a.waitingReason='traffic';continue;}
    if(a.home&&startRoute(a,a.home,'standby'))continue;
    a.waitingReason='route-blocked';trafficOwner=null;
   }else if(a.phase==='standby'){
    if((!busy&&!a.needsDesk)||!a.visible||clock<a.retryAt||!a.data.connected||bad)continue;
    if(trafficOwner){a.waitingReason='traffic';continue;}
    if(!reserve(a)){a.waitingReason='seat-unavailable';continue;}
    const s=byStation.get(a.seatId);
    if(!startRoute(a,{x:s.x+.64,z:s.z+1.6},'entering'))a.waitingReason='route-blocked';
   }
  }
  return view();
 }
 function view(){return [...actors.values()].map(a=>{
  let m,station={x:0,z:0};
  if(a.seatId&&['seated','entering','exiting'].includes(a.phase)){
   station=byStation.get(a.seatId);m=workstationMotionAt(a.phase==='seated'?16:a.motionTime,{typing:!stale&&TYPING_STATES.has(a.data.state)&&a.phase==='seated',clock});
   if(a.phase==='seated')m.phase=TYPING_STATES.has(a.data.state)&&!stale?'work':'seated-idle';
  }else m=a.phase==='travel'&&!stale?routePose(a,clock):standingPose(a.x,a.z,a.yaw,clock);
  if(stale)m.typing=0;
  const p={x:station.x+m.x,z:station.z+m.z};
  return {id:a.id,data:{...a.data,state:stale?'unknown':a.data.state},seatId:a.seatId,phase:a.phase,waitingReason:a.visible?a.waitingReason:'no-standing-space',visible:a.visible,station,motion:m,position:p,home:a.home};
 });}
 return {update,step,view,setPaused(value){paused=!!value;},isPaused:()=>paused,
  markStale(){stale=true;},isStale:()=>stale,receivedAt:()=>receivedAt,clock:()=>clock,
  clear(){actors.clear();seats.clear();hydrated=false;trafficOwner=null;snapshot=null;},
  stats:()=>({actors:actors.size,seats:seats.size,trafficOwner,stale,paused,clock}),
  snapshot:()=>snapshot};
}
