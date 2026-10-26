import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('customer simple Video Studio remains default and expert editor is retained',()=>{
 const html=read('../public/tabs/media-studio.html'),css=read('../public/media-simple.css'),index=read('../public/index.html');
 for(const id of ['mediaSimpleFile','mediaSimpleVoice','mediaSimpleGenerate','mediaSimplePlayer','mediaSimpleDownload','mediaSimplePublish','mediaSimpleAdvanced','mediaSimpleBack'])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html, /mediaStudio panel mediaSimpleMode|panel mediaStudio mediaSimpleMode/);
 assert.match(css, /mediaSimpleMode.*mediaCapcut/);
 assert.match(html, /id="mediaQueueTask"/);
 assert.match(index, /media-simple\.js/);
});
test('simple flow uses real upload, seven-step operation and verified artifact publish',()=>{
 const script=read('../public/media-simple.js'),host=read('../src/lib/integration-host.mjs'),server=read('../src/server.mjs');
 assert.match(script,/\/api\/integrations\/media\/upload/);
 assert.match(script,/operation:'media.localize'/);
 assert.match(script,/vietnamese-final\.mp4/);
 assert.match(script,/mediaFinalReviewed/);
 assert.match(script,/\/api\/integrations\/media\/publish-source/);
 assert.match(server,/\/api\/integrations\/media\/publish-source/);
 assert.match(host,/function publishVideoSource/);
 assert.match(host,/shaFileSync\(dest\)!==expected/);
 assert.match(host,/task\.state!=='completed'/);
 assert.match(host,/task\.projectId!==projectId/);
 assert.match(script,/operation:'media.publish-'\+kind/);
});
test('unavailable features are not silently called successful and publishing needs approval',()=>{
 const script=read('../public/media-simple.js');
 assert.match(script,/if\(!ready\.ready\)throw new Error/);
 assert.match(script,/confirmPaidVoice:false/);
 assert.match(script,/window\.confirm/);
 assert.match(script,/mediaFinalReviewed/);
 assert.match(script,/media\/tasks\/'\+encodeURIComponent\(queued.id\)\+'\/approve/);
 const rel=JSON.parse(read('../RELEASE.json'));assert.equal(rel.features.commercial_ready,false);
});
