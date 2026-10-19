import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listOfficeModels, saveOfficeModel, deleteOfficeModel, officeModelPath, isGlbBuffer, OFFICE_MODEL_IDS } from '../src/lib/office-models.mjs';
import { officeClipFor, officeFindClip, officeClipKey } from '../public/office-clip.mjs';

function glb(extra = 16) {
  const b = Buffer.alloc(12 + extra);
  b.write('glTF', 0, 'latin1');
  b.writeUInt32LE(2, 4);
  b.writeUInt32LE(b.length, 8);
  return b;
}
function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'aios-office-models-')); }

test('office models: save/list/path/delete roundtrip', () => {
  const dir = tmp();
  assert.deepEqual(listOfficeModels(dir), []);
  const saved = saveOfficeModel(dir, 'pm', glb());
  assert.equal(saved.id, 'pm');
  assert.ok(saved.bytes > 0);
  assert.deepEqual(listOfficeModels(dir).map(m => m.id), ['pm']);
  assert.ok(officeModelPath(dir, 'pm').endsWith('pm.glb'));
  assert.equal(officeModelPath(dir, 'boss'), null);
  assert.deepEqual(deleteOfficeModel(dir, 'pm'), { id: 'pm', removed: true });
  assert.deepEqual(listOfficeModels(dir), []);
  assert.deepEqual(deleteOfficeModel(dir, 'pm'), { id: 'pm', removed: false });
});

test('office models: rejects bad id, bad magic, and non-buffer', () => {
  const dir = tmp();
  assert.throws(() => saveOfficeModel(dir, 'hacker', glb()), e => e.code === 'OFFICE_MODEL_ID');
  assert.throws(() => saveOfficeModel(dir, '../boss', glb()), e => e.code === 'OFFICE_MODEL_ID');
  assert.throws(() => saveOfficeModel(dir, 'boss', Buffer.from('not a glb at all')), e => e.code === 'OFFICE_MODEL_FORMAT');
  assert.equal(isGlbBuffer(glb()), true);
  assert.equal(isGlbBuffer(Buffer.alloc(4)), false);
  assert.equal(isGlbBuffer('glTF........'), false);
  for (const id of OFFICE_MODEL_IDS) saveOfficeModel(dir, id, glb(4));
  assert.equal(listOfficeModels(dir).length, OFFICE_MODEL_IDS.length);
});

test('office clips: state machine priority zap > walk > cheer > work > idle', () => {
  assert.equal(officeClipFor({ faceMode: 'zap', walking: true, cheer: true }), 'fail');
  assert.equal(officeClipFor({ walking: true, faceMode: 'work' }), 'walk');
  assert.equal(officeClipFor({ cheer: true, faceMode: 'work' }), 'cheer');
  assert.equal(officeClipFor({ faceMode: 'work' }), 'work');
  assert.equal(officeClipFor({ faceMode: 'sleep' }), 'idle');
  assert.equal(officeClipFor({}), 'idle');
});

test('office clips: name matching strips prefixes and uses synonyms', () => {
  assert.equal(officeClipKey('Armature|Idle'), 'idle');
  assert.equal(officeClipKey('mixamo.com_Walk'), 'walk');
  assert.equal(officeFindClip(['Armature|Idle', 'Armature|Walk'], 'walk'), 'Armature|Walk');
  assert.equal(officeFindClip(['Working'], 'work'), 'Working');
  assert.equal(officeFindClip(['RunCycle'], 'walk'), null);
  assert.equal(officeFindClip(['Running'], 'walk'), 'Running');
  assert.equal(officeFindClip([], 'idle'), null);
  assert.equal(officeFindClip(['Idle'], 'fail'), null);
});
