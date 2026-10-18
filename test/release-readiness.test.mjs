import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {assessCommercialRelease} from '../scripts/release-readiness.mjs';
import fs from 'node:fs';
const release=JSON.parse(fs.readFileSync(new URL('../RELEASE.json',import.meta.url),'utf8'));
test('internal integration build fails closed until live commercial release gates have evidence',()=>{
 const a=assessCommercialRelease({release});
 assert.equal(a.version,'0.9.23');assert.equal(a.commercialReady,false);
 assert.ok(a.blocked.includes('S01'));assert.ok(a.blocked.includes('W01-W02'));
 assert.ok(a.blocked.includes('A02-A03'));assert.ok(a.blocked.includes('S02'));
 const actual=spawnSync(process.execPath,[new URL('../scripts/release-readiness.mjs',import.meta.url).pathname,'--enforce'],{encoding:'utf8'});
 assert.equal(actual.status,2);
 assert.equal(JSON.parse(actual.stdout).commercialReady,false);
});
test('even a fabricated self-signed attestations object cannot override unsigned EXE and missing license',()=>{
 const a=assessCommercialRelease({release,attestations:Object.fromEntries(['windowsClean','upgradeRollback','liveProviders','coreApprovalE2E','realWindowsMedia','optionalMediaTruth','productionWorkflows','windowsUiAudit','signatureAndUpdate','pilot'].map(x=>[x,true]))});
 assert.equal(a.commercialReady,false);assert.ok(a.blocked.includes('S01'));
});
