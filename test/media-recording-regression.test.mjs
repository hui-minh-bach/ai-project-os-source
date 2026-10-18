import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { createIntegrationHost } from '../src/lib/integration-host.mjs';

const require = createRequire(import.meta.url);
const quality = require('../integrations/media-engine/src/quality.cjs');
const source = new URL('../integrations/media-engine/artifacts/samples/source.mp4', import.meta.url);

// Reproduce the user-recorded UI path, without a browser/network/AI account.
function uiHarness() {
  const nodes = new Map(), calls = [];
  const el = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value:'', checked:false, disabled:false, hidden:false, textContent:'',
      className:'', innerHTML:'', dataset:{}, listeners:{},
      addEventListener(event,fn){ this.listeners[event]=fn; },
      classList:{ toggle(){} }
    });
    return nodes.get(id);
  };
  const experience={status:{core:{status:'active'},media:{status:'available',ffmpeg:true,whisper:{ready:false},concat:{configured:false},localTts:{ready:false}}}};
  const state={project:null};
  const sandbox={
    $, $$: () => [], document:{addEventListener(){},hidden:false},
    window:{confirm:()=>true},setInterval(){},
    state,experience,esc:s=>String(s),
    fetch:async()=>{ throw new Error('Network use not expected'); },
    api:async (url)=>{calls.push(url);throw new Error('Remote chưa kết nối');},
    experienceRefresh:async()=>{},console
  };
  function $(sel){ return el(sel); }
  const context=vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../public/media-studio.js',import.meta.url),'utf8'),context);
  return {el,context,experience,state,calls,run:code=>vm.runInContext(code,context)};
}

test('unavailable Whisper and Concat cannot remain silently selected on UI',()=>{
  const h=uiHarness();
  h.el('#mediaAutoCaptions').checked=true;
  h.el('#mediaConcatProject').checked=true;
  h.run('mediaRenderStatus(experience.status)');
  assert.equal(h.el('#mediaAutoCaptions').disabled,true);
  assert.equal(h.el('#mediaConcatProject').disabled,true);
  assert.equal(h.el('#mediaAutoCaptions').checked,false);
  assert.equal(h.el('#mediaConcatProject').checked,false);
  assert.match(h.el('#mediaCapabilityPreflight').textContent,/Whisper chưa có model/);
  assert.match(h.el('#mediaCapabilityPreflight').textContent,/Concat chưa kết nối/);
});

test('legacy plan+render workflow refuses to silently drop requested extras',()=>{
  const h=uiHarness();
  h.run("mediaUI.mode='render'; mediaUI.source='uploads/source.mp4';");
  h.el('#mediaAutoCaptions').checked=true;
  h.el('#mediaConcatProject').checked=true;
  assert.throws(()=>h.run('mediaPayload()'),/KHÔNG chạy Whisper\/Concat/);
  h.run("mediaUI.mode='edit-plan'");
  h.state.project={id:'fixture'};
  return h.el('#mediaQueueTask').listeners.click().then(()=>{
    assert.match(h.el('#mediaFeedback').textContent,/“Chỉ lập kế hoạch” không tạo phụ đề/);
    assert.ok(!h.calls.some(u=>u==='/api/integrations/media/tasks'),'must not queue task after warning');
  });
});

test('quick-edit checks Concat connection before queueing or running expensive render',async()=>{
  const h=uiHarness();
  h.state.project={id:'fixture'};
  h.run("mediaUI.source='uploads/x.mp4'; mediaUI.sourceProjectId='fixture';");
  h.el('#mediaPrompt').value='Dựng dọc 9:16, tạo timeline Concat';
  h.el('#mediaConcatProject').checked=true;
  h.experience.status.media.concat.configured=true;
  await h.el('#mediaQuickRender').listeners.click();
  assert.match(h.el('#mediaFeedback').textContent,/Concat Remote chưa hoạt động/);
  assert.ok(h.calls.includes('/api/integrations/media/concat/test'));
  assert.ok(!h.calls.includes('/api/integrations/media/tasks')); 
});

test('technical MP4 cannot be shown as a content-approved commercial deliverable',()=>{
  const h=uiHarness();
  h.run(`mediaUI.tasks=[{id:'12345678-aaaa',updatedAt:'now',state:'completed',input:{operation:'media.render',params:{source:'uploads/sample-abc.mp4'}}}]; mediaUI.artifacts=[]; mediaRenderJobs()`);
  assert.match(h.el('#mediaJobs').innerHTML,/MP4 kỹ thuật xong/);
  assert.match(h.el('#mediaJobs').innerHTML,/clip MẪU kỹ thuật/);
  assert.match(h.el('#mediaJobs').innerHTML,/KHÔNG chứng nhận nội dung/);
});

test('API blocks enhanced flags on basic JSON render rather than quietly discarding them',()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),'aipos-v085-ui-'));
  let host;
  try{
    host=createIntegrationHost({root:dir,clock:false});
    assert.throws(()=>host.submit({projectId:'fixture',operation:'media.render',params:{autoCaptions:true,concatProject:true}}),{code:'MEDIA_WORKFLOW'});
    assert.equal(host.listTasks('fixture').length,0);
  }finally{host?.stop();rmSync(dir,{recursive:true,force:true});}
});

test('short sample QA is marked technical-only, never content commercially approved',async()=>{
  const qa=await quality.check({file:decodeURIComponent(source.pathname),expectedDuration:3.2});
  assert.equal(qa.passed,true);
  assert.equal(qa.reviewScope,'technical-media-integrity-only');
  assert.equal(qa.editorialReviewed,false);
  assert.equal(qa.commercialReady,false);
  assert.ok(qa.warnings.some(w=>w.startsWith('SHORT_CLIP_REVIEW_DURATION')));
});

test('switching source hides results from previous demo, with an explicit history toggle',()=>{
  const h=uiHarness();
  h.run(`mediaUI.source='uploads/user.mp4'; mediaUI.tasks=[
    {id:'old-demo',updatedAt:'earlier',state:'completed',input:{operation:'media.render',params:{source:'uploads/sample-abc.mp4'}}},
    {id:'new-real',updatedAt:'now',state:'completed',input:{operation:'media.render',params:{source:'uploads/user.mp4',sourceLabel:'clip-that.mp4'}}}
  ]; mediaUI.artifacts=[]; mediaRenderJobs()`);
  assert.match(h.el('#mediaJobs').innerHTML,/new-real/);
  assert.match(h.el('#mediaJobs').innerHTML,/clip-that.mp4/);
  assert.doesNotMatch(h.el('#mediaJobs').innerHTML,/old-demo/);
  h.el('#mediaShowAllHistory').checked=true;
  h.run('mediaRenderJobs()');
  assert.match(h.el('#mediaJobs').innerHTML,/old-demo/);
});
