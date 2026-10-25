import test from 'node:test';import assert from 'node:assert/strict';
import {integrationCatalog,bundledSkillText} from '../src/lib/integration-catalog.mjs';
import {listSkills,setSkillEnabled} from '../src/lib/skills.mjs';
test('all bundled instruction snapshots are readable with identities and hashes, without host credential claims',()=>{const c=integrationCatalog();assert.equal(c.counts.skills,83);assert.equal(c.hostTools.connected,false);assert.ok(c.hostTools.count>0);for(const s of c.skills){const r=bundledSkillText(s.id);assert.ok(r.text.length>30);assert.match(r.sha256,/^[a-f0-9]{64}$/);assert.equal(r.runtimeIncluded,false);}assert.throws(()=>bundledSkillText('../../private'));});
test('instruction references cannot silently become runtime-enabled skills',()=>{const skills=listSkills().filter(s=>s.bundled);assert.equal(skills.length,83);assert.ok(skills.every(s=>s.enabled===false));assert.throws(()=>setSkillEnabled(skills[0].id,true));});
