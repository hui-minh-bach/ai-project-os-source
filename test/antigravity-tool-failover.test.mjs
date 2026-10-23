// v0.9.62 — Antigravity tool-only results become a TYPED candidate failure:
// the model router rotates to the next account with the same model (no
// quota cooldown — the account is not out of quota), and a lone tool-only
// account surfaces a readable Vietnamese explanation instead of the old
// bare "Antigravity yêu cầu hoặc thực hiện công cụ…" step-killer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';

const FAKE_AGY = `#!/usr/bin/env node
const fs=require('node:fs'),path=require('node:path');
let mode='text';try{mode=fs.readFileSync(path.join(process.env.HOME||'','agy-mode'),'utf8').trim()}catch{}
let input='';process.stdin.on('data',d=>input+=d);process.stdin.on('end',()=>{
  console.log(JSON.stringify({event:'init',init:{permission_mode:'request-review',tools:[],cwd:process.cwd()}}));
  if(mode==='tool-only'){console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',tool_calls:[{name:'google_search'}],usage:{input_tokens:5,output_tokens:2}}}));return;}
  console.log(JSON.stringify({event:'result',result:{status:'SUCCESS',response:'Trả lời từ tài khoản dự phòng',usage:{input_tokens:5,output_tokens:2}}}));
});
`;

async function setup(label, modes) {
  const f = isolatedRuntime(label);
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-agy-bin-'));
  const agy = path.join(bin, 'agy');
  fs.writeFileSync(agy, FAKE_AGY, { mode: 0o755 });
  fs.chmodSync(agy, 0o755);
  const prevPath = process.env.PATH;
  process.env.PATH = bin + path.delimiter + prevPath;
  const vault = await f.import('src/lib/vault.mjs');
  const bindings = await f.import('src/lib/model-bindings.mjs');
  const providers = await f.import('src/lib/providers.mjs');
  const pool = await f.import('src/lib/account-pool.mjs');
  const agyMod = await f.import('src/lib/antigravity-account.mjs');
  vault.unlockVault('tool-failover-fixture-pass-2026');
  const conns = modes.map((mode, i) => {
    const c = vault.saveConnection({ kind: 'antigravity_account', name: 'AGY ' + (i + 1), meta: { authMode: 'antigravity-cli' }, model: 'gemini-test-flash' });
    bindings.recordAccountCatalog(vault.getConnection(c.id), ['gemini-test-flash']);
    const dir = agyMod.antigravityProfileDir(c.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'agy-mode'), mode);
    return vault.getConnection(c.id);
  });
  return { f, bin, prevPath, vault, providers, pool, conns };
}

test('router rotates to the next Antigravity account on a tool-only failure, without cooling the first (0.9.62)', async () => {
  const s = await setup('agy-failover', ['tool-only', 'text']);
  try {
    const out = await s.providers.ask(s.conns[0].id, { prompt: 'tìm tin tức về vàng sáng nay' });
    assert.equal(out, 'Trả lời từ tài khoản dự phòng');
    assert.equal(s.pool.cooldownUntilMs(s.conns[0].id), null, 'tool-only is not quota — the account must NOT be put to rest');
    const sw = s.pool.poolEvents().find(e => e.kind === 'pool.switch');
    assert.ok(sw, 'a pool.switch event must be journaled');
    assert.equal(sw.reason, 'tool-only');
    const feed = s.pool.poolFeedEvents();
    assert.ok(feed.some(e => e.kind === 'pool.switch' && e.text.includes('không trả lời bằng văn bản được')), 'feed text must say the real reason: ' + JSON.stringify(feed));
  } finally { process.env.PATH = s.prevPath; s.f.cleanup(); fs.rmSync(s.bin, { recursive: true, force: true }); }
});

test('a lone tool-only Antigravity account surfaces the readable typed explanation (0.9.62)', async () => {
  const s = await setup('agy-toolonly', ['tool-only']);
  try {
    await assert.rejects(s.providers.ask(s.conns[0].id, { prompt: 'tìm tin tức về vàng sáng nay' }), (e) => {
      assert.ok(e.message.includes('không trả lời bằng văn bản'), 'message must state what happened: ' + e.message);
      assert.ok(e.message.includes('thử lại một lần'), 'message must state what the app did: ' + e.message);
      return true;
    });
    assert.equal(s.pool.cooldownUntilMs(s.conns[0].id), null, 'still no cooldown for a tool-only failure');
  } finally { process.env.PATH = s.prevPath; s.f.cleanup(); fs.rmSync(s.bin, { recursive: true, force: true }); }
});
