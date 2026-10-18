import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { workspaceDir, applyFiles, snapshot } from '../src/lib/workspace.mjs';

test('workspace writes safe relative files',()=>{const id='test-safe';const d=workspaceDir(id);fs.rmSync(d,{recursive:true,force:true});fs.mkdirSync(d,{recursive:true});applyFiles(id,[{path:'src/a.txt',content:'ok'}]);assert.equal(fs.readFileSync(path.join(d,'src/a.txt'),'utf8'),'ok');assert.equal(snapshot(id)[0].path,'src/a.txt');});
test('workspace blocks traversal',()=>assert.throws(()=>applyFiles('test-safe',[{path:'../bad.txt',content:'x'}])));
test('workspace blocks env',()=>assert.throws(()=>applyFiles('test-safe',[{path:'.env',content:'SECRET=x'}])));

import { engineCatalog } from '../src/lib/engines.mjs';
import { listSkills, skillPrompt } from '../src/lib/skills.mjs';

test('high-risk GPT-Pilot is blocked in engine catalog',()=>{const e=engineCatalog().find(x=>x.id==='gpt-pilot-blocked');assert.equal(e?.risk,'blocked');assert.equal(e?.mode,'blocked');});
test('skill registry includes security and QA',()=>{const ids=listSkills().map(x=>x.id);assert.ok(ids.includes('security-review'));assert.ok(ids.includes('qa-test'));assert.match(skillPrompt(['security-review']),/Threat|threat|secret/i);});
