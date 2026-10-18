import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createIntegrationHost } from '../src/lib/integration-host.mjs';

function stubConcatServer(calls) {
  const server = net.createServer(sock => {
    let buf = '';
    sock.on('data', d => {
      buf += d.toString('utf8');
      let ix;
      while ((ix = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, ix); buf = buf.slice(ix + 1);
        if (!line.trim()) continue;
        const req = JSON.parse(line);
        calls.push(req.method);
        let result = {};
        if (req.method === 'version') result = { apiVersion: '0.2.7', concat: '0.2.7' };
        if (req.method === 'media.import') result = { createdId: 'm-abc' };
        if (req.method === 'edit.apply') result = { createdId: 'c-abc' };
        sock.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n');
      }
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

test('openInConcat creates a real Concat project from the selected video via the RPC API', async () => {
  const calls = [];
  const server = await stubConcatServer(calls);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-concat-open-'));
  const env = { ...process.env, CONCAT_API_TOKEN: 'test-token', CONCAT_API_PORT: String(server.address().port) };
  const host = createIntegrationHost({ root, env });
  const ws = host.mediaWorkspace;
  fs.mkdirSync(path.join(ws, 'uploads'), { recursive: true });
  fs.writeFileSync(path.join(ws, 'uploads', 'clip.mp4'), Buffer.alloc(2048, 7));
  try {
    const out = await host.openInConcat({ source: 'uploads/clip.mp4' });
    assert.equal(out.opened, true);
    assert.match(out.projectName, /^aios-open-/);
    assert.deepEqual(calls.filter(m => m !== 'auth'), ['version', 'version', 'project.create', 'media.import', 'edit.apply', 'project.save'],
      'probe, then create/import/place/save in order (checkConcat probes version first)');
    await assert.rejects(() => host.openInConcat({ source: 'uploads/nope.mp4' }));
    await assert.rejects(() => host.openInConcat({ source: '../escape.mp4' }), e => e.code === 'MEDIA_PATH');
  } finally { server.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('openInConcat blocks honestly when the Concat remote is unreachable', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-concat-open2-'));
  const env = { ...process.env, CONCAT_API_TOKEN: 'test-token', CONCAT_API_PORT: '9' };
  const host = createIntegrationHost({ root, env });
  fs.mkdirSync(host.mediaWorkspace, { recursive: true });
  fs.writeFileSync(path.join(host.mediaWorkspace, 'clip.mp4'), Buffer.alloc(1024, 3));
  try {
    await assert.rejects(() => host.openInConcat({ source: 'clip.mp4' }));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
