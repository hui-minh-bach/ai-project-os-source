import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFleet, FLEET_DESKS } from '../src/lib/office-fleet.mjs';

const NOW = Date.parse('2026-10-19T10:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const CONNS = [
  { id: 'c-gpt', kind: 'chatgpt_account', name: 'ChatGPT · Lam', connected: true },
  { id: 'c-claude', kind: 'claude_account', name: 'Claude · Lam', connected: true },
  { id: 'c-gem', kind: 'gemini_account', name: 'Gemini · Lam', connected: false },
];
const WORKER = { p1: 'c-gpt', p2: 'c-claude', p3: 'c-gem' };

test('fleet: no runs — connected bots charge, unverified stays offline in the bay', () => {
  const { bots, overflow } = deriveFleet({ connections: CONNS, runs: [], workerConnByProject: WORKER, nowMs: NOW });
  assert.equal(overflow, 0);
  assert.equal(bots.length, 3);
  assert.equal(bots[0].state, 'charging');
  assert.equal(bots[0].station, 'bay');
  assert.equal(bots[0].baySlot, 0);
  assert.equal(bots[2].state, 'offline');
  assert.equal(bots[2].station, 'bay');
  assert.equal(bots[0].provider, 'ChatGPT');
  assert.equal(bots[1].color, '#d97757');
});

test('fleet: a running run puts its project worker at the first desk', () => {
  const runs = [{ id: 'r1', projectId: 'p2', state: 'running', createdAt: iso(NOW - 60000), updatedAt: iso(NOW - 1000) }];
  const { bots } = deriveFleet({ connections: CONNS, runs, workerConnByProject: WORKER, nowMs: NOW });
  const claude = bots.find(b => b.connectionId === 'c-claude');
  assert.equal(claude.state, 'working');
  assert.equal(claude.station, FLEET_DESKS[0]);
  assert.equal(claude.deskIndex, 0);
  assert.equal(claude.runId, 'r1');
  assert.equal(bots.find(b => b.connectionId === 'c-gpt').state, 'charging');
});

test('fleet: latest failure sends the bot to the cage and frees its desk for the next worker', () => {
  const runs = [
    { id: 'r-fail', projectId: 'p1', state: 'failed', createdAt: iso(NOW - 7200000), updatedAt: iso(NOW - 3600000) },
    { id: 'r2', projectId: 'p2', state: 'running', createdAt: iso(NOW - 60000), updatedAt: iso(NOW - 1000) },
  ];
  const { bots } = deriveFleet({ connections: CONNS, runs, workerConnByProject: WORKER, nowMs: NOW });
  const gpt = bots.find(b => b.connectionId === 'c-gpt');
  assert.equal(gpt.state, 'failed');
  assert.equal(gpt.station, 'cage');
  assert.equal(gpt.runId, 'r-fail');
  // Bot thay thế: Claude đang chạy được bàn đầu tiên (bàn của GPT đã trống).
  const claude = bots.find(b => b.connectionId === 'c-claude');
  assert.equal(claude.state, 'working');
  assert.equal(claude.deskIndex, 0);
});

test('fleet: a completed run after the failure releases the bot back to charging', () => {
  const runs = [
    { id: 'r-fail', projectId: 'p1', state: 'failed', createdAt: iso(NOW - 7200000), updatedAt: iso(NOW - 3600000) },
    { id: 'r-ok', projectId: 'p1', state: 'completed', createdAt: iso(NOW - 1800000), updatedAt: iso(NOW - 900000) },
  ];
  const { bots } = deriveFleet({ connections: CONNS, runs, workerConnByProject: WORKER, nowMs: NOW });
  assert.equal(bots.find(b => b.connectionId === 'c-gpt').state, 'charging');
});

test('fleet: failures older than 24h and runs of unbound projects are ignored; cap is 10 bots', () => {
  const old = [{ id: 'r-old', projectId: 'p1', state: 'failed', createdAt: iso(NOW - 90000000), updatedAt: iso(NOW - 90000000) },
               { id: 'r-x', projectId: 'p-unknown', state: 'running', createdAt: iso(NOW - 1000), updatedAt: iso(NOW - 1000) }];
  const many = Array.from({ length: 12 }, (_, i) => ({ id: 'm' + i, kind: 'openai', name: 'K' + i, connected: true }));
  const a = deriveFleet({ connections: CONNS, runs: old, workerConnByProject: WORKER, nowMs: NOW });
  assert.equal(a.bots.find(b => b.connectionId === 'c-gpt').state, 'charging');
  const b = deriveFleet({ connections: many, runs: [], workerConnByProject: {}, nowMs: NOW });
  assert.equal(b.bots.length, 10);
  assert.equal(b.overflow, 2);
});
