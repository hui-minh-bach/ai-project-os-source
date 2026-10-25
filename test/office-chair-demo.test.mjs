import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {officeChairAt,OFFICE_CHAIR_CANVAS as C,OFFICE_CHAIR_PHASES as P} from '../public/office-chair-choreography.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

const near=(a,b,eps=.00001)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
test('14 phases cover the full duration with no time gaps or overlaps',()=>{
 near(P[0].start,0);near(P.at(-1).end,C.duration);
 for(let i=1;i<P.length;i++)near(P[i-1].end,P[i].start);
 assert.equal(new Set(P.map(x=>x.state)).size,P.length);
});
test('narrative order is approach > turn > touch > pull > sit > work > stand > return',()=>{
 const q=['approach','align','reach','pull','stepToSeat','sit','scootIn','work','scootOut','stand','push','leave'];
 const seq=P.map(x=>x.state);
 for(let i=1;i<q.length;i++)assert.ok(seq.indexOf(q[i])>seq.indexOf(q[i-1]));
});
test('chair does not move before hand reaches its handle',()=>{
 for(let t=0;t<=6.5;t+=.025){const r=officeChairAt(t);near(r.chair.x,0);near(r.chair.y,0);}
 assert.ok(officeChairAt(7.15).chair.x>1,'chair pulled during pull phase');
});
test('no teleport on phase boundaries in projected screen-space',()=>{
 for(const p of P.slice(1)){
  const a=officeChairAt(p.start-.00001),b=officeChairAt(p.start+.00001);
  const jump=Math.hypot(a.robot.x-b.robot.x,a.robot.y-b.robot.y);
  assert.ok(jump<.05,`robot jumped ${jump}px at ${p.state}`);
  assert.ok(Math.hypot(a.chair.x-b.chair.x,a.chair.y-b.chair.y)<.05,`chair jumped at ${p.state}`);
 }
});
test('chair moves together with robot while scooting towards desk',()=>{
 const before=officeChairAt(9.7),after=officeChairAt(10.4);
 assert.ok(after.chair.x<before.chair.x,'chair scoots in');
 assert.ok(after.robot.x<before.robot.x,'robot follows chair');
});
test('chair starts exiting desk before standing and returns after push',()=>{
 assert.ok(officeChairAt(13.9).chair.x>officeChairAt(13.05).chair.x);
 near(officeChairAt(16.2).chair.x,0);near(officeChairAt(16.2).chair.y,0);
 near(officeChairAt(20).chair.x,0);near(officeChairAt(20).chair.y,0);
});
test('all time samples are finite, constrained and carry a valid animation clip',()=>{
 const ok=new Set(['Idle','Walk','Sit_Down','Seated_Idle','Seated_Work','Stand_Up','Reach_Chair','Pull_Chair','Lower_Arms','Push_Chair']);
 for(let i=-100;i<=3000;i++){
  const d=officeChairAt(i*.01);
  assert.ok(ok.has(d.clip),`undefined clip ${d.clip}`);
  for(const v of [d.robot.x,d.robot.y,d.robot.yaw,d.chair.x,d.chair.y,d.clipTime])assert.ok(Number.isFinite(v));
  assert.ok(d.chair.x>=0&&d.chair.x<=26.00001);assert.ok(d.chair.y>=0&&d.chair.y<=15.00001);
 }
 assert.equal(officeChairAt(-40).time,0);
 assert.equal(officeChairAt(100).time,20);
});
test('resources load in full release and keep old 2D office intact',()=>{
 for(const p of ['public/assets/office-iso-backdrop.jpg','public/assets/tam19.glb','public/assets/office-iso-fg/desk-pm.png','public/assets/chair-demo/chair-original-cutout.png','public/assets/chair-demo/office-iso-no-chair.jpg','public/vendor/three.module.min.js','public/vendor/addons/GLTFLoader.js']){
  assert.ok(fs.statSync(path.join(ROOT,p)).size>1000,p);
 }
 assert.ok(fs.readFileSync(path.join(ROOT,'public/tabs/idea.html'),'utf8').includes('id="officeChairPreview"'));
 const code=fs.readFileSync(path.join(ROOT,'public/tabs/team.js'),'utf8');
 assert.ok(code.includes('officeChairPreviewButton.onclick'));
 assert.ok(code.includes("await import('/office-chair-demo.mjs')"));
 assert.ok(code.includes('window.__officeChairDemoActive?.stop()'));
 const css=fs.readFileSync(path.join(ROOT,'public/tabs/team.css'),'utf8');
 assert.ok(css.includes('.office-room.office-iso.office-chair-demo-active'));
 assert.ok(css.includes('office-iso-no-chair.jpg'));
});
