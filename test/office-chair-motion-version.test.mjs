import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('runtime script has explicit session stop and 2D fallback guards',()=>{
 const s=fs.readFileSync(path.join(root,'public/office-chair-demo.mjs'),'utf8');
 for(const fragment of ['room.classList.contains(\'office-iso\')','renderer.dispose()','room.classList.remove(\'office-chair-demo-active\')','GLTFLoader','requestAnimationFrame','room.closest(\'.page\')','onDone?.()']){
  assert.ok(s.includes(fragment),`missing ${fragment}`);
 }
});
test('source has independent demo UI without editing task API or AI state',()=>{
 const s=fs.readFileSync(path.join(root,'public/tabs/team.js'),'utf8');
 const ix=s.indexOf('/* Preview ghế tương tác');
 const e=s.indexOf('/* ================= Văn phòng 3D',ix);
 assert.ok(ix>0&&e>ix);
 const part=s.slice(ix,e);
 assert.ok(part.includes('officeChairPreviewButton.onclick'));
 assert.ok(!part.includes("fetch('/api"));
 assert.ok(!part.includes('localStorage.setItem'));
 assert.ok(!part.includes('officeState.runs='));
});
