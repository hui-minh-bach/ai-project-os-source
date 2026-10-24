import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { DATA_DIR,readJson,writeJson } from '../src/lib/store.mjs';
import { listSkills,getSkill,saveCustomSkill,setSkillEnabled,deleteCustomSkill,skillPrompt,suggestSkillsForRole,sampleSkillMapping,SKILL_SAMPLES } from '../src/lib/skills.mjs';
import { runNativeTask,reviewNativeTask } from '../src/lib/native-agent.mjs';
import { runExternalTask } from '../src/lib/external-agents.mjs';
import { lockVault,unlockVault,saveConnection } from '../src/lib/vault.mjs';
import { recordModels } from '../src/lib/model-bindings.mjs';
import { createProject,createTask,getProject,founderChat,buildPlan } from '../src/lib/projects.mjs';
import { prepareApprovedSpecification } from './helpers/council-fixtures.mjs';
const files=['custom-skills.json','skill-settings.json'];
function reset(){for(const f of files)for(const suffix of ['','.bak'])fs.rmSync(path.join(DATA_DIR,f+suffix),{force:true});}
const custom={name:'Contract skill',category:'build',roles:['frontend'],description:'A contract fixture',prompt:'SKILL_CUSTOM_MARKER'};

test('skill registry preserves stable IDs and custom CRUD validates identity, schema and built-in protection',()=>{reset();try{
 const builtin=listSkills();assert.equal(builtin.length,20);assert.equal(new Set(builtin.map(s=>s.id)).size,20);assert.ok(builtin.every(s=>s.enabled&&s.builtin));
 for(const id of ['founder-discovery','ux-beginner','system-architecture','frontend-web','database-postgres','security-review','qa-test','git-release','vercel-deploy','supabase-setup'])assert.ok(getSkill(id));
 for(const input of [{...custom,id:'frontend-web'},{...custom,id:'../../evil'},{...custom,name:''},{...custom,prompt:'x'.repeat(5001)},{...custom,category:'bad'},{...custom,roles:['invalid']},{...custom,roles:[]},{...custom,roles:'frontend'},{...custom,enabled:'false'}])assert.throws(()=>saveCustomSkill(input));
 const s=saveCustomSkill({...custom,id:'custom-contract'});assert.equal(s.builtin,false);assert.equal(s.enabled,true);assert.throws(()=>saveCustomSkill({...custom,id:s.id}),/tồn tại/);assert.throws(()=>saveCustomSkill({...custom,id:'custom-different'},{updateId:s.id}),/đổi ID/);
 setSkillEnabled(s.id,false);const changed=saveCustomSkill({...custom,name:'Updated'},{updateId:s.id});assert.equal(changed.name,'Updated');assert.equal(changed.enabled,false);assert.equal(readJson('custom-skills.json',[])[0].name,'Updated');
 assert.throws(()=>deleteCustomSkill('frontend-web'),/built-in/);assert.throws(()=>saveCustomSkill(custom,{updateId:'frontend-web'}),/built-in/);assert.throws(()=>saveCustomSkill(custom,{updateId:'custom-missing'}),/tìm thấy/);
 writeJson('custom-skills.json',[...readJson('custom-skills.json',[]),{...custom,id:'frontend-web',prompt:'SHADOW_ATTACK'}]);assert.equal(listSkills().filter(s=>s.id==='frontend-web').length,1);assert.doesNotMatch(skillPrompt(['frontend-web']),/SHADOW_ATTACK/);
 deleteCustomSkill(s.id);assert.equal(getSkill(s.id),null);assert.equal(skillPrompt([s.id]),'');assert.throws(()=>deleteCustomSkill(s.id),/tìm thấy/);
 }finally{reset()}});

test('enabled state survives a fresh process and removes stale IDs from prompt and every sample mapping',()=>{reset();try{
 const id='frontend-web',prompt=getSkill(id).prompt;setSkillEnabled(id,false);assert.equal(getSkill(id).enabled,false);assert.ok(!suggestSkillsForRole('frontend').includes(id));assert.doesNotMatch(skillPrompt([id,id]),new RegExp(prompt.slice(0,20)));assert.equal(skillPrompt([id,'unknown']), '');
 const fresh=spawnSync(process.execPath,['--input-type=module','-e',"import {getSkill} from './src/lib/skills.mjs';console.log(getSkill('frontend-web').enabled)"],{cwd:path.resolve(DATA_DIR,'..'),encoding:'utf8'});assert.equal(fresh.status,0);assert.equal(fresh.stdout.trim(),'false');
 for(const sample of SKILL_SAMPLES){const mapped=sampleSkillMapping(sample.id),expected=[...new Set(sample.roles.flatMap(role=>suggestSkillsForRole(role).slice(0,4)))];assert.deepEqual(mapped.skills.map(s=>s.id),expected);assert.ok(mapped.skills.every(s=>s.enabled&&s.matchedRoles.length));assert.ok(!expected.includes(id));}
 const p=createProject({name:'Mapping contract'});prepareApprovedSpecification(p.id);createTask(p.id,{title:'Frontend task',description:'Implement UI',role:'frontend',doneWhen:'UI works'});assert.deepEqual(getProject(p.id).tasks[0].skills,sampleSkillMapping('frontend').skills.map(s=>s.id));
 setSkillEnabled(id,true);assert.ok(skillPrompt([id]).includes(prompt));assert.throws(()=>setSkillEnabled(id,'false'),/boolean/);assert.throws(()=>setSkillEnabled('missing',false),/tìm thấy/);assert.throws(()=>sampleSkillMapping('bad'),/hợp lệ/);
 }finally{reset()}});

function setupConnection(baseUrl){lockVault();for(const f of ['vault.enc.json','model-registry.json'])for(const ext of ['','.bak'])fs.rmSync(path.join(DATA_DIR,f+ext),{force:true});unlockVault('skills-contract-password-2026');const c=saveConnection({kind:'openai',name:'Skills fixture',model:'skills-model',secret:'synthetic-skills-key',baseUrl});recordModels(c,['skills-model']);return c;}
test('Native uses current enabled registry on each actual provider call without replacing frozen binding',{timeout:15000},async()=>{reset();const root=fs.mkdtempSync(path.join(os.tmpdir(),'skills-native-')),requests=[];const skill=saveCustomSkill(custom);const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);requests.push(body);if(requests.length===1)setSkillEnabled(skill.id,false);res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:JSON.stringify(requests.length===1?{tool:'list',path:'.'}:{tool:'done',summary:'fixture complete'})}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const c=setupConnection(`http://127.0.0.1:${server.address().port}`);const result=await runNativeTask({root,workerId:{connectionId:c.id,model:'skills-model'},spec:'Fixture spec',task:{id:'T1',skills:[skill.id,'frontend-web']},skills:[skill.id],maxTurns:3});assert.equal(requests.length,2);assert.match(requests[0].instructions,/SKILL_CUSTOM_MARKER/);assert.doesNotMatch(requests[1].instructions,/SKILL_CUSTOM_MARKER/);assert.ok(requests.every(r=>r.model==='skills-model'));assert.ok(requests.every(r=>!r.input.includes(skill.id)&&!r.input.includes('frontend-web')));assert.equal(result.summary,'fixture complete');
 }finally{server.closeAllConnections();server.close();reset();fs.rmSync(root,{recursive:true,force:true});}});

test('supported external runner receives enabled skill prompt only and keeps unsafe opt-in',{timeout:15000},async()=>{reset();const root=fs.mkdtempSync(path.join(os.tmpdir(),'skills-external-')),bin=fs.mkdtempSync(path.join(os.tmpdir(),'skills-mini-')),oldPath=process.env.PATH;try{
 const s=saveCustomSkill(custom);setSkillEnabled('frontend-web',false);const c=setupConnection('http://127.0.0.1:1');const captured=path.join(bin,'prompt.txt');fs.writeFileSync(path.join(bin,'mini'),`#!/usr/bin/env node\nconst fs=require('fs'),a=process.argv.slice(2);if(a.includes('--task')){fs.writeFileSync(${JSON.stringify(captured)},a[a.indexOf('--task')+1]);fs.writeFileSync(a[a.indexOf('--output')+1],'{}');}\n`);fs.chmodSync(path.join(bin,'mini'),0o755);process.env.PATH=bin+path.delimiter+oldPath;
 const opts={engineId:'mini-swe-agent',root,workerId:c.id,spec:'fixture',task:{id:'T1',skills:[s.id,'frontend-web']},skills:[s.id,'frontend-web']};await assert.rejects(runExternalTask(opts),/unsafe/);await runExternalTask({...opts,allowUnsafeHost:true});const prompt=fs.readFileSync(captured,'utf8');assert.match(prompt,/SKILL_CUSTOM_MARKER/);assert.ok(!prompt.includes(getSkill('frontend-web').prompt));assert.doesNotMatch(prompt,/synthetic-skills-key|frontend-web/);assert.ok(!prompt.includes(s.id));
 }finally{process.env.PATH=oldPath;reset();fs.rmSync(root,{recursive:true,force:true});fs.rmSync(bin,{recursive:true,force:true});}});

test('workflow reserves mapping slot, persists toggle and reaches real Founder/planning/Worker/Reviewer payloads once',{timeout:20000},async()=>{
 reset();const root=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-')),requests=[],id='ai-project-os-workflow';
 const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);requests.push(body);const system=body.instructions||'';const output=system.includes('AI Project Manager.')?{tasks:[{title:'Build fixture',role:'frontend',description:'Create fixture',doneWhen:'Fixture exists'}]}:system.includes('senior reviewer')?{approved:true,summary:'fixture only',risks:[],fixes:[]}:system.includes('AI Founder/Project Manager')?'Founder fixture':{tool:'done',summary:'fixture complete'};res.setHeader('content-type','application/json');res.end(JSON.stringify({output_text:typeof output==='string'?output:JSON.stringify(output)}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const c=setupConnection(`http://127.0.0.1:${server.address().port}`),binding={connectionId:c.id,model:'skills-model'},p=createProject({name:'Workflow contract'});
 for(const enabled of [true,false,true]){
 setSkillEnabled(id,enabled);
 const fresh=spawnSync(process.execPath,['--input-type=module','-e',`import {getSkill} from './src/lib/skills.mjs';console.log(getSkill('${id}').enabled)`],{cwd:path.resolve(DATA_DIR,'..'),encoding:'utf8'});assert.equal(fresh.status,0);assert.equal(fresh.stdout.trim(),String(enabled));
 for(const role of ['founder','manager','frontend','backend','qa','reviewer'])assert.equal(suggestSkillsForRole(role).slice(0,4).includes(id),enabled);
 const start=requests.length;
 await founderChat(p.id,binding,'Clarify fixture');prepareApprovedSpecification(p.id);await buildPlan(p.id,binding);
 await runNativeTask({root,workerId:binding,spec:'fixture',task:{id:'T1'},skills:['frontend-web','qa-test','ux-beginner','vercel-deploy',id,id],maxTurns:1});
 await reviewNativeTask({reviewerId:binding,spec:'fixture',task:{id:'T1'},diff:'fixture',skills:['security-review','qa-test',id,id]});
 const batch=requests.slice(start);assert.equal(batch.length,4);
 for(const payload of batch){assert.equal(payload.model,'skills-model');assert.equal((payload.instructions.match(/AI Project OS Workflow:/g)||[]).length,enabled?1:0);assert.doesNotMatch(payload.instructions,/146209c|file 7|GPT-6 Astra/);assert.ok((payload.instructions.split('SKILLS ÁP DỤNG:')[1]||'').split('\n').filter(x=>x.startsWith('- ')).length<=4);}
 if(enabled){for(const [i,role] of ['founder','planning','worker','reviewer'].entries())assert.ok(batch[i].instructions.includes(getSkill(id).rolePrompts[role]));}
 }
 }finally{server.closeAllConnections();server.close();reset();fs.rmSync(root,{recursive:true,force:true});}
});


test('Factory skill instructions have registry entries and can be disabled',()=>{reset();try{
 const ids=['project-manager','requirements-to-spec','task-dispatcher','checkpoint-resume','quality-gate','delivery-manager'];
 for(const id of ids){assert.ok(getSkill(id));assert.equal(getSkill(id).builtin,true);assert.ok(getSkill(id).enabled);assert.throws(()=>saveCustomSkill({...custom,id}),/built-in/);}
 assert.ok(suggestSkillsForRole('manager').includes('project-manager'));
 assert.ok(suggestSkillsForRole('qa').includes('quality-gate'));
 setSkillEnabled('quality-gate',false);
 assert.ok(!suggestSkillsForRole('qa').includes('quality-gate'));
 setSkillEnabled('quality-gate',true);
}finally{reset();}});
