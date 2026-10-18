import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDbPassword } from '../src/lib/supabase.mjs';
import { engineCatalog } from '../src/lib/engines.mjs';

test('generated Supabase password is strong enough for provisioning',()=>{const p=generateDbPassword();assert.ok(p.length>=24);assert.match(p,/[A-Z]/);assert.match(p,/[a-z]/);assert.match(p,/\d/);assert.match(p,/!/);});
test('only native and mini-swe are marked full task execution engines',()=>{const full=engineCatalog().filter(x=>x.execution==='full').map(x=>x.id).sort();assert.deepEqual(full,['native']);const mini=engineCatalog().find(x=>x.id==='mini-swe-agent');assert.equal(mini.execution,'unsafe-host');});
