import test from 'node:test';
import assert from 'node:assert/strict';
import {motionAt,twoBone,gaitFootAt,PHASES} from '../public/space-studio/motion.mjs';
import {STATIONS,CHAIR,DESK,DURATION} from '../public/space-studio/design.mjs';
const near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('R2 world: nine distinct metre-scale stations and feasible desk/chair heights',()=>{
 assert.equal(STATIONS.length,9);assert.equal(new Set(STATIONS.map(s=>s.id)).size,9);
 assert.equal(STATIONS.filter(s=>s.id==='pm').length,1);assert.ok(CHAIR.seatY<DESK.height);assert.ok(DESK.keyboardY>DESK.height);
 for(let i=0;i<STATIONS.length;i++)for(let j=i+1;j<STATIONS.length;j++)assert.ok(Math.hypot(STATIONS[i].x-STATIONS[j].x,STATIONS[i].z-STATIONS[j].z)>2.6);
});
test('R2 phases: continuous coverage, all contact actions, no missing timeline',()=>{
 near(PHASES[0][0],0);near(PHASES.at(-1)[1],DURATION);
 for(let i=1;i<PHASES.length;i++)near(PHASES[i-1][1],PHASES[i][0]);
 for(const p of PHASES)assert.equal(motionAt((p[0]+p[1])/2).phase,p[2]);
});
test('R2 motion clamps invalid time and never produces NaN',()=>{
 for(const t of [NaN,Infinity,-10,0,30,100])for(const v of Object.values(motionAt(t)))if(typeof v==='number')assert.ok(Number.isFinite(v));
 near(motionAt(-1).time,0);near(motionAt(100).time,30);
});
test('R2 3001 poses: chair bounds, floor contact and finite transforms',()=>{
 for(let i=0;i<=3000;i++){const t=i/100,m=motionAt(t);for(const v of Object.values(m))if(typeof v==='number')assert.ok(Number.isFinite(v));assert.ok(m.chairZ>=.72-1e-8&&m.chairZ<=1.58+1e-8);for(const side of ['L','R']){const foot=gaitFootAt(t,side);assert.ok(foot.y>=CHAIR.footY-1e-10);assert.ok(foot.y<=CHAIR.footY+.046);}}
});
test('R2 pelvis follows the chair during full seated contact',()=>{
 for(let t=12.1;t<=21;t+=.01){const m=motionAt(t);assert.equal(m.seatContact,true);near(m.z,m.chairZ);near(m.robotPelvisY,CHAIR.pelvisY);}
});
test('R2 chair moves only with a grip or seated robot; finishes home',()=>{
 near(motionAt(0).chairZ,CHAIR.homeZ);near(motionAt(30).chairZ,CHAIR.homeZ);
 for(let t=.01;t<30;t+=.01){const a=motionAt(t-.005),b=motionAt(t+.005),m=motionAt(t);if(Math.abs(a.chairZ-b.chairZ)>1e-7)assert.ok(m.contact>.99||m.seatContact,`unheld chair at ${t}`);}
});
test('R2 transitions preserve position and chair/pelvis continuity',()=>{
 for(const [t] of PHASES.slice(1)){const a=motionAt(t-1e-5),b=motionAt(t+1e-5);for(const k of ['x','z','chairZ','robotPelvisY','contact','seated'])near(a[k],b[k],.002);}
});
test('R2 gait: stance foot is world-anchored away from blend edges',()=>{
 let checked=0;
 for(let t=.1;t<2.65;t+=.002){const a=gaitFootAt(t,'L'),b=gaitFootAt(t+.001,'L');if(a.stance&&b.stance&&motionAt(t).gaitBlend>.999999&&motionAt(t+.001).gaitBlend>.999999){near(a.x,b.x,1e-8);near(a.z,b.z,1e-8);checked++;}}
 assert.ok(checked>100);
});
test('R2 IK: reachable endpoints preserve both limb lengths',()=>{
 const start=[0,0,0],target=[.2,-.4,.1],r=twoBone(start,target,.3,.3,[0,0,1]);assert.equal(r.reachable,true);near(Math.hypot(...r.joint),.3);near(Math.hypot(...r.end.map((v,i)=>v-r.joint[i])),.3);for(let i=0;i<3;i++)near(r.end[i],target[i]);
});
test('R2 IK: out-of-reach is bounded and explicitly reports residual',()=>{
 const r=twoBone([0,0,0],[0,-5,0],.3,.2,[0,-1,0]);assert.equal(r.reachable,false);assert.ok(r.residual>4);assert.ok(Math.hypot(...r.end)<.501);assert.ok(r.joint.every(Number.isFinite));
});
test('R2 IK: coincident points and parallel pole do not break the solve',()=>{
 for(const target of [[0,0,0],[0,-.2,0]]){const r=twoBone([0,0,0],target,.3,.3,[0,-1,0]);assert.ok([...r.joint,...r.end].every(Number.isFinite));}
});
test('R2 IK rejects invalid vectors and nonpositive lengths',()=>{
 for(const args of [[[0,0,0],[NaN,0,0],.3,.3,[1,0,0]],[[0,0,0],[1,0,0],0,.3,[1,0,0]]])assert.throws(()=>twoBone(...args),TypeError);
});
