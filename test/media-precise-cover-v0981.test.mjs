import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseTsv,mergeOcrObservations,preciseMaskRegions,validateCoverPlan,automaticCoverFilters} from '../src/lib/media-auto-cover.mjs';

const plan={version:1,method:'ocr-tight-spatial-word-repair',scope:'all',width:1280,height:720,seconds:6,regionPct:8,rectangles:[{
  x:240,y:370,w:220,h:40,start:0,end:3,text:'HELLO WORLD',confidence:91,samples:2,
  wordBoxes:[{x:240,y:370,w:100,h:35},{x:365,y:370,w:95,h:35}]
}]};

test('OCR TSV retains separate word boxes for narrow repair',()=>{
  const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'
    +'5\t1\t1\t1\t1\t1\t120\t185\t50\t15\t93\tHELLO\n'
    +'5\t1\t1\t1\t1\t2\t180\t185\t50\t15\t90\tWORLD\n';
  const [line]=parseTsv(tsv,{width:1280,height:720,scaledWidth:640,scaledHeight:360,time:1,seconds:6,period:.5});
  assert.ok(line);
  assert.equal(line.wordBoxes.length,2);
  assert.ok(line.wordBoxes[0].w<line.w);
  const next={...line,start:line.start+.4,end:line.end+.4};
  const merged=mergeOcrObservations([line,next]);
  assert.equal(merged.length,1);
  assert.equal(merged[0].samples,2);
  assert.equal(merged[0].wordBoxes.length,2);
});

test('OCR repair uses delogo for word-sized regions, not a full-height black strip',()=>{
  validateCoverPlan(plan,1280,720,6);
  const regions=preciseMaskRegions(plan);
  assert.equal(regions.length,2);
  const filters=automaticCoverFilters(plan);
  assert.equal(filters.length,2);
  assert.ok(filters.every(f=>f.startsWith('delogo=')&&!f.includes('drawbox=')));
  assert.ok(filters.every(f=>f.includes("between(t,")));
});

test('Bottom band is opt-in and 8% tall; excessive OCR regions are rejected',()=>{
  const bottom={...plan,method:'opaque-bottom-band',scope:'bottom',rectangles:[]};
  validateCoverPlan(bottom,1280,720,6);
  assert.match(automaticCoverFilters(bottom)[0],/drawbox=x=0:y=662:w=1280:h=58:color=black/);
  const oversized={...plan,rectangles:[{...plan.rectangles[0],wordBoxes:[{x:10,y:20,w:800,h:400}]}]};
  assert.throws(()=>validateCoverPlan(oversized,1280,720,6),/quá rộng|không hợp lệ/i);
});

test('Video Studio selects OCR and keeps 8% fallback in UI',()=>{
  const html=fs.readFileSync(new URL('../public/tabs/media-studio.html',import.meta.url),'utf8');
  const script=fs.readFileSync(new URL('../public/media-studio.js',import.meta.url),'utf8');
  const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(pkg.version,'0.9.81');
  assert.match(html,/<option value="all" selected>/);
  assert.match(html,/<option value="8" selected>/);
  assert.match(script,/autoCoverScope.*'all'/);
  assert.match(script,/autoCoverPct.*8/);
});
