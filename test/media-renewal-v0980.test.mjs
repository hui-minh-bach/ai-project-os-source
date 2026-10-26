import test from 'node:test';
import assert from 'node:assert/strict';
import {LOCALIZE_STEPS,validateLocalization} from '../src/lib/media-localize.mjs';

test('Seven-step media renewal workflow retains all distinct stages',()=>{
  assert.deepEqual(LOCALIZE_STEPS.map(row=>row[0]),['input','transcribe','translate','cleanup','voice','captions','export']);
  assert.equal(new Set(LOCALIZE_STEPS.map(row=>row[0])).size,7);
});

test('New jobs prefer OCR instead of a 26% bottom strip',()=>{
  const p=validateLocalization({source:'uploads/source.mp4',rightsConfirmed:true,cleanupMode:'auto'});
  assert.equal(p.autoCoverScope,'all');
  assert.equal(p.autoCoverPct,8);
  assert.equal(p.coverSubtitles,true);
  assert.equal(p.targetLanguage,'vi');
  assert.equal(p.ttsProvider,'local');
});

test('Manual band is explicitly opt-in with bounds',()=>{
  const p=validateLocalization({source:'uploads/source.mp4',rightsConfirmed:true,cleanupMode:'auto',autoCoverScope:'bottom',autoCoverPct:8});
  assert.equal(p.autoCoverScope,'bottom');
  assert.equal(p.autoCoverPct,8);
  assert.throws(()=>validateLocalization({source:'uploads/source.mp4',rightsConfirmed:true,cleanupMode:'auto',autoCoverScope:'bottom',autoCoverPct:2}),e=>e.code==='MEDIA_COVER_INPUT');
});

test('Permissions, source uniqueness and paid voice consent remain enforced',()=>{
  const base={source:'uploads/source.mp4',cleanupMode:'auto',rightsConfirmed:true};
  assert.throws(()=>validateLocalization({...base,rightsConfirmed:false}),e=>e.code==='MEDIA_RIGHTS');
  assert.throws(()=>validateLocalization({...base,url:'https://example.org/video.mp4'}),e=>e.code==='MEDIA_INPUT');
  assert.throws(()=>validateLocalization({...base,ttsProvider:'heygen'}),e=>e.code==='MEDIA_PAID_CONSENT');
});
