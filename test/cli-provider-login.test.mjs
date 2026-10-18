// Isolated, adversarial contract tests for the official Claude/Gemini CLI
// pathways. A mock CLI cannot prove live provider entitlements; these tests
// verify that only non-empty model responses produce an available binding.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

function resetRuntime(label){return isolatedRuntime('cli-'+label)}

test('Claude CLI account fails closed before actual response and can be role-bound only after verified inference',async()=>{
 const f=resetRuntime('claude');
 try{
  const v=await f.import('src/lib/vault.mjs');const c=await f.import('src/lib/cli-account.mjs');const b=await f.import('src/lib/model-bindings.mjs');
  v.unlockVault('claude-local-vault-fixture-password');
  const account=c.createCliAccount('claude','Claude on this PC');
  assert.equal(account.kind,'claude');
  assert.equal(b.modelAvailability(account.id).status,'unverified');
  assert.throws(()=>b.verifiedBinding({connectionId:account.id,model:'sonnet'}),/xác minh/);
  await assert.rejects(()=>c.verifyCliAccountModel(account.id,'sonnet',{
   resolve:()=>({command:process.execPath,args:['ignored']}),invoke:async()=>({code:1,stdout:'',stderr:'ERROR secret=local-fixture-token'})
  }),e=>!/local-fixture-token/.test(e.message));
  assert.equal(b.modelAvailability(account.id).status,'unverified');
  let captured;
  const deps={resolve:(kind)=>{assert.equal(kind,'claude');return {command:process.execPath,args:['fake-claude.js']};},
   invoke:async(cmd,args,options)=>{captured={cmd,args,options};return {code:0,stdout:JSON.stringify({type:'result',is_error:false,result:'OK',model:'sonnet',usage:{input_tokens:7,output_tokens:1}})};}};
  await c.verifyCliAccountModel(account.id,'sonnet',deps);
  assert.equal(b.modelAvailability(account.id).status,'verified');
  assert.deepEqual(b.modelAvailability(account.id).models,['sonnet']);
  assert.equal(b.verifiedBinding({connectionId:account.id,model:'sonnet'}).model,'sonnet');
  assert.ok(captured.args.includes('--disallowedTools'));
  assert.ok(captured.args.includes('--strict-mcp-config'));
  assert.ok(captured.args.includes('--tools'));
  assert.ok(captured.args.includes(''));
  assert.equal(captured.options.inheritEnv,false);
  assert.equal(captured.options.env.ANTHROPIC_API_KEY,undefined);
  assert.equal(captured.options.env.GOOGLE_API_KEY,undefined);
  assert.equal(v.getConnection(account.id).model,'','verified model selection is a separate explicit operation');
  assert.throws(()=>c.createCliAccount('claude','Wrong alias'),/một tài khoản/);
  const stale=b.modelAvailability(account.id).models;
  assert.equal(stale.length,1);
  const reg=await f.import('src/lib/store.mjs');const r=reg.readJson('model-registry.json',{});
  r[account.id].modelVerifiedAt.sonnet='2001-01-01T00:00:00.000Z';reg.writeJson('model-registry.json',r);
  assert.equal(b.modelAvailability(account.id).status,'unverified','stale verified model is not assignable');
  v.lockVault();assert.equal(b.modelAvailability(account.id).status,'locked');
 }finally{f.cleanup()}
});

test('Gemini CLI uses restricted, private settings and rejects actual model fallback',async()=>{
 const f=resetRuntime('gemini');
 try{
  const v=await f.import('src/lib/vault.mjs');const c=await f.import('src/lib/cli-account.mjs');const b=await f.import('src/lib/model-bindings.mjs');
  v.unlockVault('gemini-local-vault-fixture-password');
  const {id}=c.createCliAccount('gemini','Gemini local account');
  const p=c.cliInferencePlan({...v.getConnection(id),model:'gemini-2.5-flash'},{system:'You are helpful',prompt:'Reply OK'});
  assert.ok(p.args.includes('--output-format'));assert.ok(p.args.includes('json'));
  assert.equal(JSON.parse(fs.readFileSync(p.settings)).tools.core.length,0);
  assert.deepEqual(JSON.parse(fs.readFileSync(p.settings)).mcpServers,{});
  assert.equal(p.env.GEMINI_API_KEY,undefined);
  assert.equal(p.env.GOOGLE_APPLICATION_CREDENTIALS,undefined);
  await assert.rejects(()=>c.verifyCliAccountModel(id,'gemini-2.5-flash',{
   resolve:()=>({command:process.execPath,args:['fixture-gemini']}),invoke:async()=>({code:0,stdout:JSON.stringify({response:'OK',stats:{models:{'other-model':{}}}})})
  }),/model khác/);
  assert.equal(b.modelAvailability(id).status,'unverified');
  const complete=await c.verifyCliAccountModel(id,'gemini-2.5-flash',{
   resolve:()=>({command:process.execPath,args:['fixture-gemini']}),invoke:async()=>({code:0,stdout:JSON.stringify({response:'OK',stats:{models:{'gemini-2.5-flash':{}}}})})
  });
  assert.equal(complete.ok,true);assert.equal(b.modelAvailability(id).status,'verified');
  const selected=v.saveConnection({...v.getConnection(id),model:'gemini-2.5-flash'});
  assert.equal(selected.model,'gemini-2.5-flash');
  assert.deepEqual(b.modelAvailability(id).models,['gemini-2.5-flash']);
  v.lockVault();
 }finally{f.cleanup()}
});

test('managed CLI installation is whitelisted, local-user scoped and has a Node portable npm path',async()=>{
 const f=resetRuntime('installer');
 try{
  const m=await f.import('src/lib/managed-cli.mjs');
  assert.throws(()=>m.resolveCli('bash',{env:{PATH:''},platform:'win32'}),/không được hỗ trợ/);
  await assert.rejects(()=>m.installManagedCli('other',{npmPath:'mock'}),/không được hỗ trợ/);
  const p=path.join(f.root,'node_modules','npm','bin','npm-cli.js');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'// fake npm test');
  assert.equal(m.npmCliPath({nodePath:path.join(f.root,'node.exe'),root:f.root}),p);
  let call;
  const installed=await m.installManagedCli('claude',{npmPath:p,invoke:async(command,args,opts)=>{
   call={command,args,opts};const out=path.join(m.TOOLS_DIR,'node_modules','@anthropic-ai','claude-code','cli.js');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,'console.log("fixture")');
   return {code:0,stdout:'',stderr:''};
  }});
  assert.equal(installed.ok,true);assert.equal(call.command,process.execPath);
  assert.deepEqual(call.args.slice(0,4),[p,'install','--prefix',m.TOOLS_DIR]);
  assert.ok(call.args.includes('@anthropic-ai/claude-code@latest'));
  assert.equal(call.opts.inheritEnv,false);assert.equal(call.opts.cwd,m.TOOLS_DIR);
  assert.ok(m.TOOLS_DIR.startsWith(f.root));
  assert.equal(m.resolveCli('claude',{env:{PATH:''},platform:'win32'}).source,'managed');
  const gemRoot=path.join(m.TOOLS_DIR,'node_modules','@google','gemini-cli');
  fs.mkdirSync(path.join(gemRoot,'bundle'),{recursive:true});
  fs.writeFileSync(path.join(gemRoot,'package.json'),JSON.stringify({name:'@google/gemini-cli',bin:{gemini:'bundle/gemini.js'}}));
  fs.writeFileSync(path.join(gemRoot,'bundle','gemini.js'),'console.log(\"fixture gemini\")');
  assert.match(m.managedEntry('gemini'),/bundle[\\/]gemini\.js$/, 'follow only the official package-declared bin');
  const gem=m.cliRuntime('gemini');const cla=m.cliRuntime('claude');assert.notEqual(gem.cwd,cla.cwd);
  assert.notEqual(gem.env.HOME,cla.env.HOME);
 }finally{f.cleanup()}
});
