import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {sceneChanges}=require('../integrations/media-engine/src/analyzer.cjs');

test('scene analysis uses only core FFmpeg options and never sends -vsync (old Windows build compatibility)',{skip:process.platform==='win32'},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-ffmpeg-options-'));
 try{
  const exe=path.join(dir,'ffmpeg');
  fs.writeFileSync(exe,`#!/usr/bin/env node
if (process.argv.includes('-vsync')) {console.error("Unrecognized option 'vsync'");process.exit(1)}
if (!process.argv.includes('-vf') || !process.argv.some(x=>x.includes('showinfo'))) process.exit(2)
console.error('[Parsed_showinfo_1] n: 0 pts: 101 pts_time:1.5');
console.error('[Parsed_showinfo_1] n: 1 pts: 202 pts_time:3.6');
`);
  fs.chmodSync(exe,0o755);
  const points=await sceneChanges({source:path.join(dir,'dummy-video.mp4'),ffmpegBin:exe,maxSeconds:10});
  assert.deepEqual(points,[1.5,3.6]);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('FFmpeg analyzer and Windows diagnostician must not contain deprecated -vsync',()=>{
 const analyzer=fs.readFileSync(new URL('../integrations/media-engine/src/analyzer.cjs',import.meta.url),'utf8');
 const doctor=fs.readFileSync(new URL('../src/lib/system-doctor.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(analyzer,/['"]-vsync['"]/);assert.doesNotMatch(doctor,/['"]-vsync['"]/);
 assert.match(doctor,/smokeScene/);
});
