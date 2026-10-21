// Hai khu Chatbox/Codex (0.9.53): local fixture contracts only — no live
// account success is asserted. The owner's rule under test: "chọn bên
// nào lấy model bên đó" — a role bound in one area can never resolve to
// a model of the other area, at save time or at run time.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, readJson, writeJson } from '../src/lib/store.mjs';
import { unlockVault, lockVault, saveConnection, getConnection } from '../src/lib/vault.mjs';
import { recordModels, verifiedBinding, roleRef, resolveBinding } from '../src/lib/model-bindings.mjs';
import { createProject, getProject, updateProjectModelRoles } from '../src/lib/projects.mjs';
import { CONNECTION_AREAS, CONNECTION_AREA_BY_KIND, connectionArea, areaLabel } from '../src/lib/connection-areas.mjs';
import { deriveFleet } from '../src/lib/office-fleet.mjs';

const SECRET='fixture-secret-do-not-display-123';
function reset(){lockVault();for(const n of ['vault.enc.json','vault.enc.json.bak','projects.json','projects.json.bak','model-registry.json','model-registry.json.bak'])fs.rmSync(path.join(DATA_DIR,n),{force:true});unlockVault('areas-fixture-vault');}
function verifiedConn(kind,name,models){const c=saveConnection({kind,name,secret:SECRET});recordModels(getConnection(c.id),models);return getConnection(c.id);}

test('area mapping: deterministic per connection kind, infra kinds belong to neither area',()=>{
 assert.deepEqual(CONNECTION_AREAS,['codex','chatbox']);
 assert.equal(connectionArea('chatgpt_account'),'codex');
 assert.equal(connectionArea('openai'),'codex');
 assert.equal(connectionArea('antigravity_account'),'chatbox');
 assert.equal(connectionArea('gemini_account'),'chatbox');
 assert.equal(connectionArea('gemini'),'chatbox');
 assert.equal(connectionArea('claude_account'),'chatbox');
 assert.equal(connectionArea('anthropic'),'chatbox');
 // Không thuộc khu nào: ô key tùy chỉnh của người dùng + nhóm Công cụ.
 assert.equal(connectionArea('openai_compatible'),null);
 assert.equal(connectionArea('github'),null);
 assert.equal(connectionArea('vercel'),null);
 assert.equal(connectionArea('supabase'),null);
 assert.equal(connectionArea('other'),null);
 assert.equal(connectionArea(''),null);
 assert.equal(connectionArea(undefined),null);
 assert.equal(areaLabel('codex'),'Khu Codex');
 assert.equal(areaLabel('chatbox'),'Khu Chatbox');
 assert.equal(areaLabel(null),null);
});

test('area mapping mirror in connections.js stays in sync with the lib',()=>{
 const lib=fs.readFileSync(new URL('../src/lib/connection-areas.mjs',import.meta.url),'utf8');
 const ui=fs.readFileSync(new URL('../public/tabs/connections.js',import.meta.url),'utf8');
 const extract=(src,marker)=>{const start=src.indexOf(marker);assert.ok(start>0,marker+' present');const block=src.slice(start,src.indexOf('}',start));const out={};for(const m of block.matchAll(/(\w+):\s*'(codex|chatbox)'/g))out[m[1]]=m[2];return out;};
 assert.deepEqual(extract(ui,'CC_AREA_BY_KIND'),{...CONNECTION_AREA_BY_KIND});
 assert.deepEqual(extract(lib,'CONNECTION_AREA_BY_KIND'),{...CONNECTION_AREA_BY_KIND});
});

test('bindings: area is stamped on save and cross-area bindings are rejected both ways',()=>{
 reset();
 try{
  const oa=verifiedConn('openai','Fixture OpenAI',['alpha','beta']);
  const an=verifiedConn('anthropic','Fixture Claude',['claude-a']);
  const compat=verifiedConn('openai_compatible','Fixture compatible',['local-x']);
  // Khu suy ra từ kind khi phân vai không nói rõ khu.
  assert.deepEqual(verifiedBinding({connectionId:oa.id,model:'alpha'}),{connectionId:oa.id,model:'alpha',area:'codex'});
  assert.deepEqual(verifiedBinding({connectionId:an.id,model:'claude-a'}),{connectionId:an.id,model:'claude-a',area:'chatbox'});
  // Đúng khu thì qua; khác khu thì chặn với thông điệp nêu cả hai khu.
  assert.equal(verifiedBinding({connectionId:oa.id,model:'alpha',area:'codex'}).area,'codex');
  assert.throws(()=>verifiedBinding({connectionId:oa.id,model:'alpha',area:'chatbox'}),/thuộc Khu Codex.*Khu Chatbox/);
  assert.throws(()=>verifiedBinding({connectionId:an.id,model:'claude-a',area:'codex'}),/thuộc Khu Chatbox.*Khu Codex/);
  assert.throws(()=>verifiedBinding({connectionId:oa.id,model:'alpha',area:'mars'}),/Khu phân vai không hợp lệ/);
  // Kết nối trung lập (key tùy chỉnh của người dùng): chọn ở khu nào
  // cũng được, khu lưu lại là null — hạn mức là endpoint của chính họ.
  assert.deepEqual(verifiedBinding({connectionId:compat.id,model:'local-x',area:'codex'}),{connectionId:compat.id,model:'local-x',area:null});
  assert.deepEqual(verifiedBinding({connectionId:compat.id,model:'local-x',area:'chatbox'}),{connectionId:compat.id,model:'local-x',area:null});
  // Cổng LƯU (updateProjectModelRoles) cũng chặn chéo khu, và phân vai
  // đã lưu mang theo khu tường minh.
  const p=createProject({name:'Fixture areas',idea:'Local test'});
  assert.throws(()=>updateProjectModelRoles(p.id,{founder:{connectionId:oa.id,model:'alpha',area:'chatbox'}}),/thuộc Khu Codex/);
  updateProjectModelRoles(p.id,{founder:{connectionId:oa.id,model:'alpha',area:'codex'},reviewer:{connectionId:an.id,model:'claude-a'}});
  assert.deepEqual(getProject(p.id).modelRoles.founder,{connectionId:oa.id,model:'alpha',area:'codex'});
  assert.deepEqual(getProject(p.id).modelRoles.reviewer,{connectionId:an.id,model:'claude-a',area:'chatbox'});
 }finally{lockVault()}
});

test('bindings: legacy bindings without area derive from the connection kind; a tampered stored area is refused at resolve time',()=>{
 reset();
 try{
  const oa=verifiedConn('openai','Fixture OpenAI',['alpha']);
  const p=createProject({name:'Fixture legacy areas',idea:'Local test'});
  updateProjectModelRoles(p.id,{worker:{connectionId:oa.id,model:'alpha'}});
  // Phân vai đời cũ: bỏ trường area trong dữ liệu đã lưu.
  const projects=readJson('projects.json',[]);const saved=projects.find(x=>x.id===p.id);
  saved.modelRoles.worker={connectionId:oa.id,model:'alpha'};writeJson('projects.json',projects);
  const resolved=resolveBinding(roleRef(p.id,'worker'));
  assert.equal(resolved.model,'alpha');assert.equal(resolved.area,'codex');
  // Phân vai bị sửa tay sang khu kia: lúc CHẠY phải từ chối, không tự
  // thay model của Khu Chatbox vào.
  saved.modelRoles.worker={connectionId:oa.id,model:'alpha',area:'chatbox'};writeJson('projects.json',projects);
  assert.throws(()=>resolveBinding(roleRef(p.id,'worker')),/thuộc Khu Codex.*Khu Chatbox/);
 }finally{lockVault()}
});

test('fleet: bots carry their area and label; infra connections carry neither',()=>{
 const { bots } = deriveFleet({ connections: [
  { id: 'c-gpt', kind: 'chatgpt_account', name: 'Tèo', connected: true },
  { id: 'c-agy', kind: 'antigravity_account', name: 'Ngọc', connected: true },
  { id: 'c-gh', kind: 'github', name: 'GitHub CLI', connected: true },
 ], runs: [], workerConnByProject: {}, nowMs: Date.parse('2026-10-21T10:00:00.000Z') });
 assert.equal(bots[0].area,'codex');assert.equal(bots[0].areaLabel,'Khu Codex');
 assert.equal(bots[1].area,'chatbox');assert.equal(bots[1].areaLabel,'Khu Chatbox');
 assert.equal(bots[2].area,null);assert.equal(bots[2].areaLabel,null);
});

test('UI contract: two area headers, two-step pickers, office labels, operator area field',()=>{
 const js=fs.readFileSync(new URL('../public/tabs/connections.js',import.meta.url),'utf8');
 const html=fs.readFileSync(new URL('../public/tabs/connections.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../public/tabs/connections.css',import.meta.url),'utf8');
 const team=fs.readFileSync(new URL('../public/tabs/team.js',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../src/server.mjs',import.meta.url),'utf8');
 assert.ok(js.includes('Khu Codex — tài khoản Codex (làm code/dự án)'),'codex area header');
 assert.ok(js.includes('Khu Chatbox — tài khoản chat (viết lách, phân tích, trò chuyện)'),'chatbox area header');
 assert.ok(js.includes('data-area-head'),'area headers rendered over the card grid');
 assert.ok(js.includes('ccAreaSummary'),'area summary line rendered');
 assert.ok(js.includes('data-role-area'),'role picker is two-step (area first)');
 assert.ok(js.includes('data-member-area'),'council picker is two-step (area first)');
 assert.ok(js.includes('ccProviderOptions(c?.id,area)'),'role provider list filtered by the picked area');
 assert.ok(html.includes('Khu Codex')&&html.includes('Khu Chatbox'),'providers intro names both areas');
 assert.ok(css.includes('.cc-area-head'),'area header styled full-width');
 assert.ok(team.includes('officePlateName'),'office nameplates carry the area label');
 assert.ok(team.includes('areaLabel?b.areaLabel'),'roster role text carries the area label');
 assert.ok(server.includes('area:connectionArea(c.kind)'),'operator ext/connections exposes the area');
});
