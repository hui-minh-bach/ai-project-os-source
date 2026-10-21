import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listOfficeModels, saveOfficeModel, deleteOfficeModel, officeModelPath, isGlbBuffer, OFFICE_MODEL_IDS } from '../src/lib/office-models.mjs';
import { officeClipFor, officeFindClip, officeClipKey, officeResolveClip, OFFICE_CLIP_PREFS, OFFICE_STANDING_WORK_CLIPS } from '../public/office-clip.mjs';

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

test('office clips: P16 work preference resolves WorkCycle first (0.9.50)', () => {
  const P16 = ['Idle', 'Walk', 'Greeting', 'Approve', 'InspectTablet', 'Typing', 'Mouse', 'TabletTouch', 'WorkCycle'];
  // The full P16 set: the standing-desk cycle wins over every fallback.
  assert.equal(officeResolveClip(P16, 'work'), 'WorkCycle');
  // Without WorkCycle the other standing clips win in order, before InspectTablet.
  assert.equal(officeResolveClip(P16.filter(n => n !== 'WorkCycle'), 'work'), 'Typing');
  assert.equal(officeResolveClip(P16.filter(n => !['WorkCycle', 'Typing'].includes(n)), 'work'), 'Mouse');
  assert.equal(officeResolveClip(P16.filter(n => !['WorkCycle', 'Typing', 'Mouse'].includes(n)), 'work'), 'TabletTouch');
  // Legacy P13 set (no standing clips): the seated InspectTablet path is kept.
  const P13 = ['Idle', 'Walk', 'Greeting', 'Approve', 'InspectTablet'];
  assert.equal(officeResolveClip(P13, 'work'), 'InspectTablet');
  // Other states are unchanged on the P16 set.
  assert.equal(officeResolveClip(P16, 'idle'), 'Idle');
  assert.equal(officeResolveClip(P16, 'walk'), 'Walk');
  assert.equal(officeResolveClip(P16, 'cheer'), 'Approve');
  // P16 has no Reject clip: fail falls back to Idle, never an invented clip.
  assert.equal(officeResolveClip(P16, 'fail'), 'Idle');
  assert.equal(OFFICE_CLIP_PREFS.fail.at(-1), 'Idle');
  // The state machine still maps office states to clip intents.
  assert.equal(officeClipFor({ faceMode: 'work' }), 'work');
  assert.equal(officeClipFor({ faceMode: 'zap' }), 'fail');
  assert.equal(officeClipFor({ walking: true, faceMode: 'work' }), 'walk');
  // Standing-desk set: exactly the four P16 work clips; InspectTablet stays seated.
  assert.deepEqual(OFFICE_STANDING_WORK_CLIPS, ['WorkCycle', 'Typing', 'Mouse', 'TabletTouch']);
  assert.ok(OFFICE_STANDING_WORK_CLIPS.includes(officeResolveClip(P16, 'work')));
  assert.ok(!OFFICE_STANDING_WORK_CLIPS.includes(officeResolveClip(P13, 'work')));
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
