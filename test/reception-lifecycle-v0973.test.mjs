import test from 'node:test';import assert from 'node:assert/strict';
import {deriveSpaceFleet} from '../src/lib/space-fleet.mjs';import {createLiveFleetController} from '../public/space-studio/live-motion.mjs';import {buildProjectConversation} from '../src/lib/project-conversation.mjs';
const now=Date.parse('2026-10-25T03:00:00Z');const connections=['a','b','c'].map(id=>({id,kind:'chatgpt_account',name:'Account '+id,connected:true}));
const project={id:'p',name:'Long media work',modelRoles:{founder:{connectionId:'a',model:'m-a'},worker:{connectionId:'b',model:'m-b'},reviewer:{connectionId:'c',model:'m-c'}},tasks:[]};
test('provider reply completion cannot release assigned team while parent pipeline renders',()=>{
 const run={id:'r',projectId:'p',title:'Video',state:'running',script:{connectionId:'b',model:'actual-model'},review:{connectionId:'c',model:'review-model'},steps:[{name:'produce.music',state:'done'}]};
 const controller=createLiveFleetController();const snap=()=>deriveSpaceFleet({connections,projects:[project],runs:[run],activity:[{id:'call',connectionId:'c',projectId:'p',role:'reviewer',state:'completed',endedAtMs:now-1000}],nowMs:now});
 controller.update(snap());const seats=controller.view().map(a=>[a.id,a.seatId]);
 for(let i=0;i<6000;i++){if(i%100===0)controller.update(snap());controller.step(.1);}
 assert.deepEqual(controller.view().map(a=>[a.id,a.seatId]),seats);assert.ok(controller.view().filter(a=>['b','c'].includes(a.id)).every(a=>a.phase==='seated'&&a.motion.typing===0));assert.ok(snap().bots.filter(b=>['b','c'].includes(b.connectionId)).every(b=>b.jobs.some(j=>j.id==='r')));assert.ok(snap().bots.every(b=>b.activeCalls===0));
});
test('queued/running reception job holds desks before an orchestrator run exists',()=>{
 const r=deriveSpaceFleet({connections,projects:[project],workJobs:[{id:'j',projectId:'p',state:'running'}],nowMs:now});assert.ok(r.bots.filter(b=>['b','c'].includes(b.connectionId)).every(b=>b.jobs.some(j=>j.id==='j')));assert.ok(r.bots.filter(b=>['b','c'].includes(b.connectionId)).every(b=>b.state==='waiting'));
 const done=deriveSpaceFleet({connections,projects:[project],workJobs:[{id:'j',projectId:'p',state:'failed'}],nowMs:now});assert.ok(done.bots.every(b=>b.jobs.length===0));
});
test('seat-exit boundary is cancelled when a new active job starts before movement',()=>{
 const c=createLiveFleetController(),make=(state,jobs=[])=>({schema:1,source:'live',generatedAt:new Date().toISOString(),bots:[{connectionId:'a',name:'A',connected:true,state,role:'worker',roles:['worker'],jobs}]});
 c.update(make('working'));c.update(make('completed'));for(let i=0;i<31;i++)c.step(.1);assert.equal(c.view()[0].phase,'exiting');const position=c.view()[0].position;
 c.update(make('working',[{id:'new',state:'running'}]));assert.deepEqual(c.view()[0].position,position);for(let i=0;i<100;i++)c.step(.1);assert.equal(c.view()[0].phase,'seated');assert.ok(c.view()[0].seatId);
});
test('conversation shows exact public worker/reviewer replies, scope and names; never private reasoning',()=>{
 const run={id:'r',projectId:'p',createdAt:'2026-10-25T03:00:00Z',conversation:[{id:'m1',at:'2026-10-25T03:00:01Z',role:'worker',connectionId:'b',model:'served',content:'Nội dung thật <b>không phải HTML</b>',kind:'message'},{id:'m2',at:'2026-10-25T03:00:02Z',role:'reviewer',connectionId:'c',content:'Cần sửa nguồn dẫn.',kind:'message'}],privateReasoning:'MUST_NOT_APPEAR',steps:[{at:'2026-10-25T03:00:03Z',name:'produce.story',state:'running'}]};
 const m=buildProjectConversation({project,runs:[run,{...run,projectId:'another',conversation:[{id:'other',content:'PRIVATE OTHER PROJECT',kind:'message'}]}],connections});
 assert.equal(m[0].content,run.conversation[0].content);assert.equal(m[0].actor,'Account b');assert.equal(m[0].model,'served');assert.equal(m[1].actor,'Account c');assert.equal(m[2].kind,'activity');assert.ok(!JSON.stringify(m).includes('MUST_NOT_APPEAR'));assert.ok(!JSON.stringify(m).includes('PRIVATE OTHER PROJECT'));
});
test('old runs use stored actual script/review feedback, not invented conversation',()=>{
 const m=buildProjectConversation({project,connections,runs:[{id:'old',projectId:'p',script:{text:'Existing script',connectionId:'b'},review:{feedback:'Existing review',connectionId:'c'},steps:[]}]});assert.equal(m.filter(x=>x.kind==='message').length,2);assert.equal(m[0].content,'Existing script');assert.equal(m[1].content,'Existing review');
});

test('image progress is project-scoped and cannot crowd public model replies out of reception',()=>{
 const events=Array.from({length:200},(_,i)=>({id:'e'+i,at:'2026-10-25T03:00:03Z',payload:{projectId:'p',scene:i,state:'running',name:'Local image'}}));events.push({id:'other',payload:{projectId:'other',state:'failed',reason:'PRIVATE OTHER PROJECT'}});
 const result=buildProjectConversation({project,events,connections,runs:[{id:'r',projectId:'p',script:{text:'Keep this actual reply',connectionId:'b'}}]});assert.ok(result.some(m=>m.content==='Keep this actual reply'));assert.ok(result.some(m=>m.content.includes('Tạo ảnh cảnh')));assert.ok(!JSON.stringify(result).includes('PRIVATE OTHER PROJECT'));
});
