/* AI Project OS v0.9.60: 3D locomotion and seat pose helpers.
 * No dependencies on DOM/Node; safe to import in browser and node tests.
 * Paths avoid desk footprints; the last step deliberately enters the chair.
 */
const STEP = 0.75;
const BOUNDS = {minX:-16.1,maxX:16.1,minZ:-10.35,maxZ:10.35};
const hypot=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const point=(p)=>({x:Number(p.x),z:Number(p.z)});
const finite=(p)=>Number.isFinite(p.x)&&Number.isFinite(p.z);
const inside=(p)=>p.x>=BOUNDS.minX&&p.x<=BOUNDS.maxX&&p.z>=BOUNDS.minZ&&p.z<=BOUNDS.maxZ;
const blocked=(p,obs)=>obs.some(o=>hypot(p,o)<(o.r||1.7));
const key=(x,z)=>x+','+z;
const dims={cols:Math.floor((BOUNDS.maxX-BOUNDS.minX)/STEP)+1,rows:Math.floor((BOUNDS.maxZ-BOUNDS.minZ)/STEP)+1};
const at=(x,z)=>({x:BOUNDS.minX+x*STEP,z:BOUNDS.minZ+z*STEP});
const cell=(p)=>({x:Math.max(0,Math.min(dims.cols-1,Math.round((p.x-BOUNDS.minX)/STEP))),z:Math.max(0,Math.min(dims.rows-1,Math.round((p.z-BOUNDS.minZ)/STEP)))});
function nearestOpen(p,obs){
 const c=cell(p);
 for(let r=0;r<20;r++){
  let chosen=null,best=Infinity;
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
   if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;
   const x=c.x+dx,z=c.z+dz;
   if(x<0||z<0||x>=dims.cols||z>=dims.rows)continue;
   const q=at(x,z);if(blocked(q,obs))continue;
   const dist=hypot(q,p);if(dist<best){best=dist;chosen={x,z};}
  }
  if(chosen)return chosen;
 }
 return c;
}
function clearLine(a,b,obs){
 const n=Math.ceil(hypot(a,b)/0.17);
 for(let i=1;i<n;i++)if(blocked({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},obs))return false;
 return true;
}
/** A* over the office floor, with a conservative circle around each desk. */
export function officeFindPath(start,end,obstacles=[]){
 if(!finite(start)||!finite(end))return [];
 const s=point(start),g=point(end);
 if(hypot(s,g)<0.08)return [g];
 if(clearLine(s,g,obstacles))return [g];
 const a=nearestOpen(s,obstacles),b=nearestOpen(g,obstacles);
 const source=key(a.x,a.z),dest=key(b.x,b.z);
 const frontier=[{x:a.x,z:a.z,f:0}],best=new Map([[source,0]]),parents=new Map(),closed=new Set();
 const turns=[[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 let found=false;
 for(let iter=0;frontier.length&&iter<dims.cols*dims.rows*5;iter++){
  let low=0;for(let j=1;j<frontier.length;j++)if(frontier[j].f<frontier[low].f)low=j;
  const cur=frontier.splice(low,1)[0],ck=key(cur.x,cur.z);
  if(closed.has(ck))continue;closed.add(ck);
  if(ck===dest){found=true;break;}
  for(const [dx,dz] of turns){
   const x=cur.x+dx,z=cur.z+dz;
   if(x<0||z<0||x>=dims.cols||z>=dims.rows)continue;
   const next=at(x,z);if(blocked(next,obstacles))continue;
   // Do not cut diagonally across the corners of furniture.
   if(dx&&dz&&(blocked(at(cur.x+dx,cur.z),obstacles)||blocked(at(cur.x,cur.z+dz),obstacles)))continue;
   const nk=key(x,z),cost=best.get(ck)+(dx&&dz?Math.SQRT2:1)*STEP;
   if(cost >= (best.get(nk)??Infinity))continue;
   best.set(nk,cost);parents.set(nk,ck);
   const h=Math.hypot(x-b.x,z-b.z)*STEP;
   frontier.push({x,z,f:cost+h});
  }
 }
 if(!found)return [g]; // Nonfatal fallback for unreachable manually pinned spots.
 const cells=[];let ck=dest;
 while(ck&&ck!==source){const [x,z]=ck.split(',').map(Number);cells.push(at(x,z));ck=parents.get(ck);}
 cells.reverse();
 // Cheap string-pulling removes grid zig-zag while keeping clearance.
 const nodes=[s,...cells,g],smooth=[];let i=0;
 while(i<nodes.length-1){let j=nodes.length-1;while(j>i+1&&!clearLine(nodes[i],nodes[j],obstacles))j--;
  smooth.push(nodes[j]);i=j;}
 return smooth;
}
export function officeChairPoint(station){
 const rot=Number(station.yaw??Math.PI),back=0.28;
 return {x:station.x+Math.sin(rot)*back,z:station.z+Math.cos(rot)*back,yaw:((rot+Math.PI)%(2*Math.PI))};
}
export function officeDeskApproach(station,obstacles=[]){
 const rot=station.yaw??Math.PI;
 // Seat is behind the desk; prefer a path from behind, then the two sides.
 const choices=[1.96,1.87,1.87,2.02].map((r,i)=>{
  const phi=rot+(i===1?Math.PI/2:i===2?-Math.PI/2:i===3?Math.PI:0);
  return {x:station.x+Math.sin(phi)*r,z:station.z+Math.cos(phi)*r};
 });
 return choices.find(p=>inside(p)&&!blocked(p,obstacles))||choices.find(inside)||point(station);
}
export function officeRoute(start,end,desks=[],{fromDesk=null,toDesk=null}={}){
 if(!finite(start)||!finite(end))return [];
 const obstacles=desks.map(x=>({...x,r:x.r??1.52}));
 const route=[];let launch=point(start);
 if(fromDesk&&hypot(start,fromDesk)<2.15){
  const exit=officeDeskApproach(fromDesk,obstacles);
  if(hypot(launch,exit)>.09){route.push(exit);launch=exit;}
 }
 const goal=toDesk?officeDeskApproach(toDesk,obstacles):point(end);
 route.push(...officeFindPath(launch,goal,obstacles));
 // The final unblocked leg is an intentional approach to the chair cushion.
 if(toDesk||hypot(goal,end)>.09)route.push(point(end));
 return route.filter((p,i)=>i===0||hypot(p,route[i-1])>.06);
}
function spin(THREE,base,x){
 return base.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),x));
}
/** Native THREE.AnimationClips, acting on TAM19's own articulated pivots. */
export function officeMakeTam19SeatClips(THREE,root){
 const body=root.getObjectByName('Body');
 const jointNames=['Hip_L','Hip_R','Knee_L','Knee_R','Ankle_L','Ankle_R','Shoulder_L','Shoulder_R','Elbow_L','Elbow_R','Wrist_L','Wrist_R','Head_Rig'];
 if(!body||!jointNames.every(n=>root.getObjectByName(n)))return null;
 const angle={Hip_L:-1.05,Hip_R:-1.05,Knee_L:1.43,Knee_R:1.43,Ankle_L:-.22,Ankle_R:-.22,Shoulder_L:-.36,Shoulder_R:-.36,Elbow_L:-.42,Elbow_R:-.42,Wrist_L:.10,Wrist_R:-.10,Head_Rig:.03};
 const native=new Map(jointNames.map(n=>[n,root.getObjectByName(n).quaternion.clone()]));
 const base=body.position.clone();
 const mk=(name,duration,frames,cycle='idle')=>{
  const times=frames.map(f=>f.t),progress=frames.map(f=>f.p);
  const drift=frames.map(f=>f.b??0);
  const tracks=[];
  for(const n of jointNames){
   const values=[];
   for(let i=0;i<times.length;i++){
    let amount=angle[n]*progress[i];
    if(cycle==='work'&&['Elbow_L','Elbow_R','Wrist_L','Wrist_R'].includes(n))amount+=drift[i]*(n.endsWith('L')?1:-1);
    if(cycle==='idle'&&n==='Head_Rig')amount+=drift[i]*.25;
    const q=spin(THREE,native.get(n),amount);values.push(q.x,q.y,q.z,q.w);
   }
   tracks.push(new THREE.QuaternionKeyframeTrack(`${n}.quaternion`,times,values));
  }
  const positions=[];
  for(let i=0;i<times.length;i++)positions.push(base.x,base.y-.28*progress[i]+(cycle==='idle'?drift[i]*.012:0),base.z);
  tracks.push(new THREE.VectorKeyframeTrack('Body.position',times,positions));
  return new THREE.AnimationClip(name,duration,tracks);
 };
 return {
  sitDown:mk('Sit_Down',1.05,[{t:0,p:0},{t:.16,p:.045},{t:.37,p:.28},{t:.62,p:.72},{t:.84,p:.96},{t:1.05,p:1}]),
  seatedIdle:mk('Seated_Idle',2.4,[{t:0,p:1,b:0},{t:.6,p:1,b:.05},{t:1.2,p:1,b:0},{t:1.8,p:1,b:-.05},{t:2.4,p:1,b:0}]),
  seatedWork:mk('Seated_Work',1.2,[{t:0,p:1,b:0},{t:.2,p:1,b:.13},{t:.4,p:1,b:-.1},{t:.6,p:1,b:.08},{t:.8,p:1,b:-.09},{t:1,p:1,b:.08},{t:1.2,p:1,b:0}], 'work'),
  standUp:mk('Stand_Up',.98,[{t:0,p:1},{t:.18,p:.95},{t:.42,p:.63},{t:.68,p:.24},{t:.84,p:.035},{t:.98,p:0}]),
 };
}
