// Operator channel + reception meeting feed (2026-10-20): the token is
// hash-only at rest, scopes gate each capability, publishing approval is a
// separate default-off scope, and the feed renders only recorded run facts.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isolatedRuntime } from './helpers/isolated-runtime.mjs';
import { buildRunFeed } from '../src/lib/orchestrator.mjs';

test('operator token lifecycle: hash-only storage, scoped verify, revoke', async () => {
  const f = isolatedRuntime('operator');
  try {
    const op = await f.import('src/lib/operator.mjs');
    assert.equal(op.operatorStatus().enabled, false);
    const { token, scopes } = op.createOperatorToken({ run: true, note: true });
    assert.match(token, /^aios-op-[0-9a-f]{48}$/);
    assert.deepEqual(scopes, { run: true, note: true, approvePublish: false });
    // Only the hash is persisted — the raw token must not appear on disk.
    let stored = '';
    const walk = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, n.name); if (n.isDirectory()) walk(p); else if (n.name === 'operator.json') stored = fs.readFileSync(p, 'utf8'); } };
    walk(f.root);
    assert.ok(stored && !stored.includes(token), 'raw token must never be written to disk');
    const auth = op.verifyOperatorToken(token);
    assert.ok(auth && op.operatorCan(auth, 'run') && op.operatorCan(auth, 'note'));
    assert.equal(op.operatorCan(auth, 'approvePublish'), false, 'boss keeps the publish gate by default');
    assert.equal(op.verifyOperatorToken('aios-op-' + '0'.repeat(48)), null);
    assert.equal(op.verifyOperatorToken('garbage'), null);
    const note = op.addOperatorNote('Ưu tiên tin công nghệ tuần này.');
    assert.equal(op.listOperatorNotes().length, 1);
    const ev = op.operatorNoteEvents();
    assert.equal(ev[0].kind, 'operator.note');
    assert.equal(ev[0].id, 'opnote:' + note.id);
    op.revokeOperatorToken();
    assert.equal(op.operatorStatus().enabled, false);
    assert.equal(op.verifyOperatorToken(token), null, 'revoked token dies immediately');
  } finally { f.cleanup(); }
});

test('meeting feed renders recorded run steps with honest labels', () => {
  const runs = [
    { id: 'r1', pipeline: 'news-video', state: 'completed', title: 'Tin nóng sáng', createdAt: '2026-10-20T01:00:00.000Z', completedAt: '2026-10-20T01:05:00.000Z', steps: [
      { name: 'project', state: 'done', at: '2026-10-20T01:00:05.000Z' },
      { name: 'ai.script', state: 'done', at: '2026-10-20T01:01:00.000Z', detail: { aiMode: 'simulated' } },
      { name: 'produce.story', state: 'done', at: '2026-10-20T01:03:00.000Z' },
      { name: 'gate', state: 'waiting', at: '2026-10-20T01:03:30.000Z' },
      { name: 'gate', state: 'approved', at: '2026-10-20T01:04:00.000Z' },
      { name: 'publish:youtube', state: 'done', at: '2026-10-20T01:04:30.000Z', detail: { simulated: true, url: 'https://example.invalid/v' } },
    ] },
    { id: 'r2', pipeline: 'dub-video', state: 'running', title: 'Phim lồng tiếng', createdAt: '2026-10-20T02:00:00.000Z', steps: [
      { name: 'analyze.transcribe', state: 'done', at: '2026-10-20T02:01:00.000Z' },
    ] },
    { id: 'r3', pipeline: 'idea-film', state: 'failed', title: 'Phim ý tưởng', createdAt: '2026-10-20T03:00:00.000Z', error: { code: 'ORCHESTRATOR_TASK', message: 'Task media.story không hoàn thành.' }, steps: [
      { name: 'run', state: 'failed', at: '2026-10-20T03:01:00.000Z', detail: { code: 'ORCHESTRATOR_TASK' } },
    ] },
  ];
  const feed = buildRunFeed(runs, { nowMs: Date.parse('2026-10-20T02:30:00.000Z') });
  const texts = feed.map(e => e.text).join('\n');
  assert.match(texts, /Nhận việc: “Tin nóng sáng”/);
  assert.match(texts, /AI mô phỏng/, 'simulated steps stay labeled');
  assert.match(texts, /chờ Sếp Lâm duyệt đăng/);
  assert.match(texts, /Đã duyệt — cho phép đăng/);
  assert.match(texts, /môi trường mô phỏng/, 'simulated publish stays labeled');
  assert.ok(feed.some(e => e.kind === 'run.live' && e.runId === 'r2'), 'running run shows a live event');
  assert.ok(feed.some(e => e.kind === 'run.failed' && /ORCHESTRATOR_TASK/.test(e.text)), 'failed run surfaces its error code');
  const ats = feed.map(e => e.at || '');
  assert.deepEqual(ats, [...ats].sort(), 'events are chronological');
});
