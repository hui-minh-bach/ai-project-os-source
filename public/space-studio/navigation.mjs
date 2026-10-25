/** Conservative walk map for the APPROVED, unmodified R2 room. Metres, X/Z.
 * This is kinematic routing, not a physics engine. No route means wait.
 */
import {STATIONS,CHAIR} from './design.mjs';
export const WALK_RADIUS=.19;
export const WALK_BOUNDS=Object.freeze({minX:-8.38,maxX:8.38,minZ:-6.75,maxZ:6.75});
const rect=(x0,z0,x1,z1,id)=>({minX:x0,minZ:z0,maxX:x1,maxZ:z1,id});
export const WALK_OBSTACLES=Object.freeze([
 ...STATIONS.flatMap(s=>[
  rect(s.x-1.23,s.z-.73,s.x+1.23,s.z+.83,'desk-'+s.id),
  rect(s.x-.36,s.z+CHAIR.homeZ-.31,s.x+.36,s.z+CHAIR.homeZ+.38,'chair-'+s.id)
 ]),
 rect(-7.75,-7.0,-1.84,-2.84,'executive'),rect(-4.55,-3.35,-1.65,-2.57,'stairs'),
 ...[0,1,2,3].map(i=>rect(.56+i*1.38,-6.10,1.74+i*1.38,-4.90,'pod-'+i)),
 rect(6.02,-5.65,8.43,-3.06,'energy'),rect(2.98,-1.60,7.72,2.02,'control'),
 rect(1.9,2.90,7.70,6.88,'lounge'),
 ...[[-8,5.9,.23],[-8,-2.1,.23],[1.72,2.3,.24],[1.72,-2.35,.22],[7.9,6,.23],[-1.1,-6.6,.20]].map(([x,z,r],i)=>rect(x-r,z-r,x+r,z+r,'plant-'+i))
]);
export function walkable(p,{radius=WALK_RADIUS,occupied=[]}={}){
 const {x,z}=p||{};if(!Number.isFinite(x)||!Number.isFinite(z))return false;
 const b=WALK_BOUNDS;if(x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ)return false;
 if(WALK_OBSTACLES.some(o=>x>o.minX-radius&&x<o.maxX+radius&&z>o.minZ-radius&&z<o.maxZ+radius))return false;
 return !occupied.some(o=>Math.hypot(x-o.x,z-o.z)<(o.radius??.31)+radius);
}
export function clearSegment(a,b,options={}){
 const length=Math.hypot(a.x-b.x,a.z-b.z),n=Math.max(1,Math.ceil(length/.065));
 for(let i=0;i<=n;i++)if(!walkable({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},options))return false;return true;
}
class Heap{
 constructor(){this.a=[];}push(item){const a=this.a;a.push(item);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].f<=item.f)break;a[i]=a[p];i=p;}a[i]=item;}
 pop(){const a=this.a;if(!a.length)return null;const out=a[0],end=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=end.f)break;a[i]=a[c];i=c;}a[i]=end;}return out;}
}
export function findWalkPath(start,goal,options={}){
 if(!walkable(start,options)||!walkable(goal,options))return null;
 if(clearSegment(start,goal,options))return [{...start},{...goal}];
 const step=.16,b=WALK_BOUNDS,nx=Math.ceil((b.maxX-b.minX)/step)+1,nz=Math.ceil((b.maxZ-b.minZ)/step)+1;
 const point=id=>({x:b.minX+(id%nx)*step,z:b.minZ+Math.floor(id/nx)*step});
 const nearest=p=>{const cx=Math.round((p.x-b.minX)/step),cz=Math.round((p.z-b.minZ)/step);let best=null,dist=Infinity;
  for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const x=cx+dx,z=cz+dz;if(x<0||x>=nx||z<0||z>=nz)continue;const id=z*nx+x,q=point(id),d=Math.hypot(q.x-p.x,q.z-p.z);if(d<dist&&clearSegment(p,q,options)){best=id;dist=d;}}return best;};
 const s=nearest(start),g=nearest(goal);if(s===null||g===null)return null;
 const costs=new Float64Array(nx*nz).fill(Infinity),parents=new Int32Array(nx*nz).fill(-1),closed=new Uint8Array(nx*nz),valid=new Int8Array(nx*nz);valid.fill(-1);
 const isValid=id=>{if(valid[id]<0)valid[id]=walkable(point(id),options)?1:0;return valid[id]===1;};
 const h=id=>{const p=point(id),q=point(g);return Math.hypot(p.x-q.x,p.z-q.z);};
 const heap=new Heap();costs[s]=0;heap.push({id:s,f:h(s)});let found=false;
 for(let count=0;count<nx*nz*2;count++){
  const item=heap.pop();if(!item)break;const id=item.id;if(closed[id])continue;closed[id]=1;if(id===g){found=true;break;}
  const x=id%nx,z=Math.floor(id/nx);
  for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz)continue;const n=zz*nx+xx;if(closed[n]||!isValid(n))continue;
   if(dx&&dz&&(!isValid(z*nx+xx)||!isValid(zz*nx+x)))continue;
   const cost=costs[id]+step*Math.hypot(dx,dz);if(cost>=costs[n])continue;costs[n]=cost;parents[n]=id;heap.push({id:n,f:cost+h(n)});
  }
 }
 if(!found)return null;
 const chain=[];for(let id=g;id!==-1;id=parents[id]){chain.push(point(id));if(id===s)break;}chain.reverse();chain.unshift({...start});chain.push({...goal});
 const result=[chain[0]];let i=0;
 while(i<chain.length-1){let j=chain.length-1;while(j>i+1&&!clearSegment(chain[i],chain[j],options))j--;result.push(chain[j]);i=j;}
 if(result.some((p,i)=>i&&!clearSegment(result[i-1],p,options)))return null;return result;
}
export function waitingSlots(count){
 const candidates=[...[0,1,2,3].map(i=>({x:1.15+i*1.38,z:-4.23})),...Array.from({length:11},(_,i)=>({x:-7.55+i*.76,z:6.65}))];
 for(let z=-4.05;z<=6.65;z+=.81)for(let x=-8.3;x<=8.3;x+=.82)candidates.push({x,z});
 const out=[];for(const p of candidates){if(out.length>=count)break;if(walkable(p)&&out.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>.7))out.push(p);}return out;
}
