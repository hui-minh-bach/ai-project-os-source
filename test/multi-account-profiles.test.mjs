// v0.9.56 — multi-account CLI profiles. Until 0.9.55 Antigravity had ONE
// fixed session folder for the whole kind (and Claude/Gemini CLI accounts
// were hard-limited to one per machine), so a second account could not
// exist. These tests pin the per-connection pattern (the ChatGPT/Codex
// shape): every connection gets its own session folder + environment,
// the earliest-created connection adopts the LEGACY folder untouched
// (the owner's existing login survives the upgrade), deletes never touch
// a sibling's session, and two accounts of a kind rotate as pool peers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ROOT=path.resolve(import.meta.dirname,'..');
function fixtureAgyPath(){
 const bin=fs.mkdtempSync(path.join(os.tmpdir(),'aios-agy-bin-'));
 fs.writeFileSync(path.join(bin,'agy'),'#!/bin/sh\nexit 0\n',{mode:0o755});
 const old=process.env.PATH||'';
 process.env.PATH=bin+path.delimiter+old;
 return ()=>{process.env.PATH=old;fs.rmSync(bin,{recursive:true,force:true});};
}

test('Antigravity: two accounts, two session folders; the first adopts the legacy folder with its session untouched',async()=>{
 const f=isolatedRuntime('agy-multi');const restore=fixtureAgyPath();
 try{
  const v=await f.import('src/lib/vault.mjs');const ag=await f.import('src/lib/antigravity-account.mjs');const store=await f.import('src/lib/store.mjs');
  v.unlockVault('agy-multi-vault-password');
  const legacy=path.join(store.DATA_DIR,'cli-profiles','antigravity');
  // The owner's pre-upgrade Google session, already sitting in the legacy
  // folder (this is "Ngọc" on the real machine) — adoption must not move,
  // copy or delete any of it.
  fs.mkdirSync(legacy,{recursive:true});fs.writeFileSync(path.join(legacy,'session-owner.txt'),'ngoc-google-session');
  const a1=ag.createAntigravityAccount('Ngọc');
  assert.equal(ag.antigravityProfileDir(a1.id),legacy,'earliest-created connection adopts the legacy profile');
  const env1=ag.antigravityEnvironment(a1.id);
  assert.equal(env1.env.HOME,legacy);assert.equal(env1.env.USERPROFILE,legacy);
  assert.equal(fs.readFileSync(path.join(legacy,'session-owner.txt'),'utf8'),'ngoc-google-session','the existing session survives first use untouched');
  await sleep(5); // distinct createdAt, like real sequential adds
  const a2=ag.createAntigravityAccount('Antigravity 2');
  assert.notEqual(a2.id,a1.id,'a second Antigravity account can be created (no single-account block)');
  const dir2=path.join(store.DATA_DIR,'cli-profiles','antigravity-accounts',a2.id);
  assert.equal(ag.antigravityProfileDir(a2.id),dir2,'later connections get their own per-connection folder');
  const env2=ag.antigravityEnvironment(a2.id);
  assert.equal(env2.env.HOME,dir2);assert.notEqual(env2.env.HOME,env1.env.HOME,'login environments differ per account');
  assert.ok(!fs.existsSync(path.join(dir2,'session-owner.txt')),'the second account does NOT see the first account’s session');
  assert.ok(fs.existsSync(path.join(legacy,'.gemini','antigravity-cli','settings.json')),'locked-down settings written in account 1 profile');
  assert.ok(fs.existsSync(path.join(dir2,'.gemini','antigravity-cli','settings.json')),'locked-down settings written in account 2 profile');
  assert.equal(v.listConnections().filter(c=>c.kind==='antigravity_account').length,2);
  v.lockVault();
 }finally{restore();f.cleanup()}
});

test('Antigravity delete isolation: removing one account never touches the other’s session; a removed legacy session is parked, not inherited',async()=>{
 const f=isolatedRuntime('agy-del');const restore=fixtureAgyPath();
 try{
  const v=await f.import('src/lib/vault.mjs');const ag=await f.import('src/lib/antigravity-account.mjs');const store=await f.import('src/lib/store.mjs');
  v.unlockVault('agy-del-vault-password');
  const a1=ag.createAntigravityAccount('First');await sleep(5);const a2=ag.createAntigravityAccount('Second');
  const legacy=path.join(store.DATA_DIR,'cli-profiles','antigravity');
  const dir2=path.join(store.DATA_DIR,'cli-profiles','antigravity-accounts',a2.id);
  ag.antigravityEnvironment(a1.id);ag.antigravityEnvironment(a2.id);
  fs.writeFileSync(path.join(legacy,'s1.txt'),'session-1');fs.writeFileSync(path.join(dir2,'s2.txt'),'session-2');
  // Remove the SECOND account: the first account's folder is untouched and
  // the removed account's own folder is left on disk (logout is the
  // owner's explicit act, per the standing remove semantics).
  ag.removeAntigravityAccount(a2.id);v.deleteConnection(a2.id);
  assert.equal(fs.readFileSync(path.join(legacy,'s1.txt'),'utf8'),'session-1','sibling session untouched by the delete');
  assert.equal(ag.antigravityProfileDir(a1.id),legacy,'remaining account still resolves to its own folder');
  assert.equal(fs.readFileSync(path.join(dir2,'s2.txt'),'utf8'),'session-2','removed account’s own folder is parked, not wiped');
  // Re-add a sibling, then remove the LEGACY adopter: its session must be
  // parked under its own per-id slot — never inherited by the promoted one.
  await sleep(5);const a3=ag.createAntigravityAccount('Third');
  ag.removeAntigravityAccount(a1.id);v.deleteConnection(a1.id);
  const parked=path.join(store.DATA_DIR,'cli-profiles','antigravity-accounts',a1.id);
  assert.equal(fs.readFileSync(path.join(parked,'s1.txt'),'utf8'),'session-1','legacy session parked under the removed account’s own slot');
  assert.equal(ag.antigravityProfileDir(a3.id),legacy,'the next account in creation order now adopts the legacy folder');
  assert.ok(!fs.existsSync(path.join(legacy,'s1.txt')),'the promoted account does NOT inherit the removed account’s session');
  v.lockVault();
 }finally{restore();f.cleanup()}
});

test('Antigravity pool rotation: a quota hit on one account rotates the step to the other account of the kind',async()=>{
 const f=isolatedRuntime('agy-pool');const restore=fixtureAgyPath();
 try{
  const v=await f.import('src/lib/vault.mjs');const ag=await f.import('src/lib/antigravity-account.mjs');const mb=await f.import('src/lib/model-bindings.mjs');const pool=await f.import('src/lib/account-pool.mjs');
  v.unlockVault('agy-pool-vault-password');
  const a1=ag.createAntigravityAccount('Pool One');await sleep(5);const a2=ag.createAntigravityAccount('Pool Two');
  mb.recordAccountCatalog(v.getConnection(a1.id),['gemini-x-flash']);
  mb.recordAccountCatalog(v.getConnection(a2.id),['gemini-x-flash']);
  assert.equal(mb.verifiedBinding({connectionId:a2.id,model:'gemini-x-flash'}).model,'gemini-x-flash','the second account binds from its own catalog');
  const primary={...v.getConnection(a1.id),model:'gemini-x-flash'};
  const before=pool.poolCandidates(primary);
  assert.deepEqual(before.candidates.map(c=>c.id),[a1.id,a2.id],'both accounts of the kind are pool candidates, primary first');
  pool.noteQuotaHit(v.getConnection(a1.id),new Error('quota exhausted: resource_exhausted'));
  const after=pool.poolCandidates(primary);
  assert.deepEqual(after.candidates.map(c=>c.id),[a2.id],'the resting account is skipped — the step continues on the other Antigravity account');
  assert.equal(after.cooling.length,1);assert.equal(after.cooling[0].id,a1.id);assert.ok(after.cooling[0].until>Date.now(),'the resting account reports its reset time');
  v.lockVault();
 }finally{restore();f.cleanup()}
});

test('Claude/Gemini CLI accounts: same per-connection pattern (audit fix) — second account, isolated profiles, delete parking',async()=>{
 const f=isolatedRuntime('cli-multi');
 try{
  const v=await f.import('src/lib/vault.mjs');const c=await f.import('src/lib/cli-account.mjs');const m=await f.import('src/lib/managed-cli.mjs');const store=await f.import('src/lib/store.mjs');
  v.unlockVault('cli-multi-vault-password');
  const claudeLegacy=path.join(store.DATA_DIR,'cli-profiles','claude');
  const c1=c.createCliAccount('claude','Claude One');await sleep(5);const c2=c.createCliAccount('claude','Claude Two');await sleep(5);const g1=c.createCliAccount('gemini','Gemini One');
  assert.equal(c.cliAccountProfileDir(v.getConnection(c1.id)),claudeLegacy,'first Claude account adopts the legacy per-kind profile');
  assert.equal(c.cliAccountProfileDir(v.getConnection(c2.id)),path.join(store.DATA_DIR,'cli-profiles','claude-accounts',c2.id),'second Claude account gets its own profile folder');
  assert.equal(c.cliAccountProfileDir(v.getConnection(g1.id)),path.join(store.DATA_DIR,'cli-profiles','gemini'),'first Gemini account adopts its own kind’s legacy profile');
  const p1=c.cliInferencePlan({...v.getConnection(c1.id),model:'sonnet'});
  const p2=c.cliInferencePlan({...v.getConnection(c2.id),model:'sonnet'});
  assert.equal(p1.env.HOME,claudeLegacy);assert.equal(p2.env.HOME,path.join(store.DATA_DIR,'cli-profiles','claude-accounts',c2.id));
  assert.notEqual(p1.env.HOME,p2.env.HOME,'inference environments differ per account — sessions can never mix');
  assert.throws(()=>m.cliProfileDir('claude','../../escape'),/không hợp lệ/,'a non-UUID id can never become a path');
  // Delete isolation + legacy parking, same rule as Antigravity.
  fs.mkdirSync(claudeLegacy,{recursive:true});fs.writeFileSync(path.join(claudeLegacy,'session.txt'),'claude-one-session');
  c.removeCliAccount(c1.id);v.deleteConnection(c1.id);
  assert.equal(fs.readFileSync(path.join(store.DATA_DIR,'cli-profiles','claude-accounts',c1.id,'session.txt'),'utf8'),'claude-one-session','removed legacy session parked under its own slot');
  assert.equal(c.cliAccountProfileDir(v.getConnection(c2.id)),claudeLegacy,'the surviving account is promoted to the legacy folder');
  assert.ok(!fs.existsSync(path.join(claudeLegacy,'session.txt')),'the promoted account does NOT inherit the removed session');
  v.lockVault();
 }finally{f.cleanup()}
});

test('UI + launcher contract: add-account affordances exist, logins carry the connection id, single-account blocks are gone',()=>{
 const conn=fs.readFileSync(path.join(ROOT,'public/tabs/connections.js'),'utf8');
 assert.ok(conn.includes('ccAgyAddAnother')&&conn.includes('Thêm tài khoản Antigravity khác'),'the Antigravity dialog offers “add another account” like ChatGPT');
 assert.ok(conn.includes('ccCliAddAnother'),'the Claude/Gemini CLI dialog offers “add another account” too');
 assert.ok(conn.includes("/api/antigravity/login")&&conn.includes('JSON.stringify({id:target.id})'),'the login window is opened FOR a specific connection id');
 assert.ok(!conn.includes('ccAgyConnect')&&!conn.includes('ccCliCreate'),'the old create-after-login flow (which landed every login in one shared profile) is gone');
 const cmd=fs.readFileSync(path.join(ROOT,'LOGIN-ANTIGRAVITY-WINDOWS.cmd'),'utf8');
 assert.ok(cmd.includes('AIOS_AGY_PROFILE')&&cmd.includes('AIOS_AGY_ACCOUNT'),'the Antigravity login window honors the per-account profile + names the account in its title');
 const tool=fs.readFileSync(path.join(ROOT,'tools/cli-login.mjs'),'utf8');
 assert.ok(tool.includes('AIOS_CLI_PROFILE_DIR'),'the Claude/Gemini login tool honors the per-account profile folder');
 const agy=fs.readFileSync(path.join(ROOT,'src/lib/antigravity-account.mjs'),'utf8');
 assert.ok(!agy.includes('Đã có kết nối Antigravity'),'the Antigravity single-account block is removed');
 assert.ok(agy.includes('antigravity-accounts')&&agy.includes('antigravityProfileDir'),'per-connection Antigravity profile resolution ships');
 const cli=fs.readFileSync(path.join(ROOT,'src/lib/cli-account.mjs'),'utf8');
 assert.ok(!cli.includes('hiện hỗ trợ một tài khoản'),'the Claude/Gemini single-account block is removed');
 assert.ok(cli.includes('cliAccountProfileDir'),'per-connection CLI profile resolution ships');
});
