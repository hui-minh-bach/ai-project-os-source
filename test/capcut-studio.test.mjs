import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../public/tabs/media-studio.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/experience.css', import.meta.url), 'utf8');

test('Media Studio uses a CapCut-style shell without losing any existing panel or mode', () => {
  assert.match(html, /class="mediaCapcut"/);
  for (const id of ['mediaMainPlayer', 'mediaStageEmpty', 'mediaStageLabel', 'mediaTimeline', 'mediaTimelineNote', 'mediaPool', 'mediaJobs', 'mediaQueueTask'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.equal((html.match(/data-media-mode=/g) || []).length, 9, 'all 9 work modes stay');
  assert.equal((html.match(/data-media-panel=/g) || []).length, 9, 'all 9 input panels stay');
  for (const id of ['mediaRethemeTopic', 'mediaRethemeScriptSource', 'mediaTimeline', 'mediaPrompt', 'mediaStoryText', 'mediaDraftTitle'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(css, /\.mediaCapcut\{/);
  assert.match(css, /\.mediaTlBlock\{/);
  assert.match(css, /\.mediaTlPlayhead\{/);
});

test('timeline helpers parse real SRT cues and pick the right result video', () => {
  const nodes = new Map();
  const el = id => {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', checked: false, disabled: false, hidden: false, textContent: '',
      className: '', innerHTML: '', dataset: {}, listeners: {}, style: {},
      addEventListener(event, fn) { this.listeners[event] = fn; },
      classList: { toggle() {} }, removeAttribute() {}
    });
    return nodes.get(id);
  };
  const sandbox = {
    $, $$: () => [], document: { addEventListener() {}, hidden: false, querySelectorAll: () => [] },
    window: { confirm: () => true }, setInterval() {},
    state: { project: null },
    experience: { status: { core: { status: 'active' }, media: { status: 'available', ffmpeg: true, whisper: { ready: false }, concat: { configured: false }, localTts: { ready: false } } } },
    esc: s => String(s), fetch: async () => { throw new Error('no network in test'); },
    api: async () => { throw new Error('no api in test'); }, experienceRefresh: async () => {}, console
  };
  function $(sel) { return el(sel); }
  const context = vm.createContext(sandbox);
  vm.runInContext(js, context);
  const run = code => vm.runInContext(code, context);

  const srt = '1\n00:00:00,000 --> 00:00:02,500\nXin chào\n\n2\n00:00:02,500 --> 00:00:05,000\nĐoạn hai ở đây\n';
  run(`mediaUI.__cues = mediaParseSrtCues(${JSON.stringify(srt)})`);
  const cues = run('mediaUI.__cues');
  assert.equal(cues.length, 2);
  assert.equal(cues[0].start, 0); assert.equal(cues[0].end, 2.5); assert.match(cues[0].text, /Xin chào/);
  assert.equal(cues[1].start, 2.5); assert.equal(cues[1].end, 5);

  run(`mediaUI.artifacts=[{id:'a1',taskId:'t1',name:'final.mp4',size:10,sha256:'x'},{id:'a2',taskId:'t1',name:'video-with-new-voice.mp4',size:20,sha256:'y'}]`);
  const picked = run(`mediaPickVideoArtifact({id:'t1'})`);
  assert.equal(picked.name, 'video-with-new-voice.mp4', 'retheme/dub result wins over generic final.mp4');

  run(`mediaUI.timeline={duration:80,segments:[{start:0,end:7.4,text:'Chào mừng bạn'},{start:7.4,end:14.76,text:'Việt Nam'}],outputName:'video-with-new-voice.mp4',sourceLabel:'clip gốc'}; mediaRenderTimeline();`);
  const tl = el('#mediaTimeline').innerHTML;
  assert.match(tl, /data-tl-seek="7\.4"/);
  assert.match(tl, /Chào mừng bạn/);
  assert.match(tl, /mediaTlPlayhead/);
  assert.match(el('#mediaTimelineNote').textContent, /2 đoạn/);
});
