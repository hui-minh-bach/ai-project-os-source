import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const team = fs.readFileSync(path.join(root, 'public/tabs/team.js'), 'utf8');
const teamCss = fs.readFileSync(path.join(root, 'public/tabs/team.css'), 'utf8');

/* v0.9.58 — Văn phòng isometric (concept B2) làm mặc định + beauty pass 3D. */

// Evaluate the REAL resolver + ISO mapping code out of team.js (the same
// approach as office-flow: the app file is the contract). officeLoadPins and
// localStorage are stubbed; everything else runs verbatim.
function loadOfficeLogic(pins) {
  const a0 = team.indexOf('const OFFICE_DESK_POOL');
  const a1 = team.indexOf('return posts;', a0);
  const sliceA = team.slice(a0, team.indexOf('\n}', a1) + 2);
  const b0 = team.indexOf('const OFFICE_ISO_STATIONS=');
  const b1 = team.indexOf('function officeIsoSpriteKey', b0);
  const sliceB = team.slice(b0, b1);
  const factory = new Function(
    'officeLoadPins', 'localStorage',
    sliceA + '\n' + sliceB +
    '\nreturn {officeResolvePosts, officeIsoPointForPost, officeIsoWorldToPct, officeIsoPctToWorld, OFFICE_ISO_STATIONS, OFFICE_ISO_PODS, OFFICE_DESK_POOL};');
  return factory(() => pins || {}, { getItem: () => null });
}

const bot = (cid, extra) => ({
  id: 'bot-' + cid,
  fleet: { connectionId: cid, kind: 'chatgpt_account', provider: 'ChatGPT', label: cid, color: '#10a37f', connected: true, resting: false, coolingUntil: null, state: 'charging', station: 'bay', deskIndex: -1, baySlot: -1, cage: false, standby: false, ...extra },
});
function fixtureRoster() {
  return [
    { id: 'boss', fleet: null },
    bot('w-gpt', { state: 'working', station: 'news', deskIndex: 0 }),
    bot('w-claude', { state: 'working', station: 'script', deskIndex: 1, kind: 'claude_account' }),
    bot('cage-agy', { state: 'failed', station: 'cage', cage: true, kind: 'antigravity_account' }),
    bot('rest-gemini', { resting: true, baySlot: 3, coolingUntil: new Date(Date.now() + 30 * 60000).toISOString(), kind: 'gemini_account' }),
    bot('idle-1', {}), bot('idle-2', {}), bot('idle-3', {}),
    bot('fail-1', { state: 'failed' }),
    bot('off-1', { connected: false, state: 'offline' }),
    bot('off-2', { connected: false, state: 'offline' }),
  ];
}

test('0.9.58: isometric backdrop ships and the ISO anchors sit inside the room', () => {
  const p = path.join(root, 'public/assets/office-iso-backdrop.jpg');
  assert.ok(fs.existsSync(p), 'backdrop asset ships');
  assert.ok(fs.statSync(p).size > 100000, 'backdrop is a real high-res image');
  assert.match(teamCss, /office-iso-backdrop\.jpg/);
  const { OFFICE_ISO_STATIONS, OFFICE_ISO_PODS } = loadOfficeLogic();
  for (const id of ['boss', 'news', 'script', 'image', 'media', 'review', 'publish', 'pm', 'intake', 'lounge', 'cage']) {
    const st = OFFICE_ISO_STATIONS[id];
    assert.ok(st, 'ISO anchor for ' + id);
    assert.ok(st.x >= 0 && st.x <= 100 && st.y >= 0 && st.y <= 100, id + ' anchor inside the room');
  }
  assert.equal(OFFICE_ISO_PODS.length, 10, '10 pod anchors (4 glass pods + waiting row)');
  const seen = new Set(OFFICE_ISO_PODS.map(p => p.x + ',' + p.y));
  assert.equal(seen.size, 10, 'pod anchors are unique');
});

test('0.9.58: fleet fixture maps to the expected ISO stations (position-mapping)', () => {
  const L = loadOfficeLogic();
  const posts = L.officeResolvePosts(fixtureRoster());
  const at = id => L.officeIsoPointForPost(posts.get(id));
  // Working bots sit at their run's desk; the point is the ISO desk anchor.
  assert.deepEqual(posts.get('bot-w-gpt'), { kind: 'desk', id: 'news', pinned: false, stateDriven: true });
  assert.deepEqual(at('bot-w-gpt'), L.OFFICE_ISO_STATIONS.news);
  assert.deepEqual(at('bot-w-claude'), L.OFFICE_ISO_STATIONS.script);
  // Cage bot -> the cage corner of the scene.
  assert.equal(posts.get('bot-cage-agy').kind, 'cage');
  assert.deepEqual(at('bot-cage-agy'), L.OFFICE_ISO_STATIONS.cage);
  // Resting bot -> its OWN pod slot (baySlot 3) in the glass pod corner.
  assert.deepEqual(posts.get('bot-rest-gemini'), { kind: 'pod', slot: 3, pinned: false, stateDriven: true });
  assert.deepEqual(at('bot-rest-gemini'), L.OFFICE_ISO_PODS[3]);
  // Idle connected bots -> free desks, each one distinct.
  const idlePts = ['bot-idle-1', 'bot-idle-2', 'bot-idle-3'].map(id => at(id));
  assert.equal(new Set(idlePts.map(p => p.x + ',' + p.y)).size, 3, 'idle bots get distinct desks');
  // Failed + offline bots -> pod slots, unique, dimmed via state in the UI.
  const podPts = ['bot-fail-1', 'bot-off-1', 'bot-off-2'].map(id => at(id));
  assert.equal(new Set(podPts.map(p => p.x + ',' + p.y)).size, 3, 'pod posts are unique');
  // Whole fleet: no two bots share an ISO point.
  const all = fixtureRoster().map(a => at(a.id));
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
    assert.ok(d > 1, `bots ${i}/${j} too close on the ISO floor (${d})`);
  }
});

test('0.9.58: manual pins apply in ISO too, state posts still win (0.9.57 semantics)', () => {
  const L = loadOfficeLogic({ 'bot-idle-1': { kind: 'desk', id: 'publish' }, 'bot-w-gpt': { kind: 'pod', slot: 5 } });
  const posts = L.officeResolvePosts(fixtureRoster());
  assert.deepEqual(posts.get('bot-idle-1'), { kind: 'desk', id: 'publish', pinned: true, stateDriven: false });
  assert.deepEqual(L.officeIsoPointForPost(posts.get('bot-idle-1')), L.OFFICE_ISO_STATIONS.publish);
  // The working bot's pin is overridden by its real run desk.
  assert.equal(posts.get('bot-w-gpt').kind, 'desk');
  assert.equal(posts.get('bot-w-gpt').stateDriven, true);
  // ISO dispatchers write the SAME pin shapes the 3D view consumes.
  assert.match(team, /function officeIsoDispatchDesk\(stationId\)/);
  assert.match(team, /pins\[a\.id\]=\{kind:'desk',id:stationId\}/);
  assert.match(team, /pins\[a\.id\]=\{kind:'floor',x:/);
});

test('0.9.58: facing rule — the desk pose is the from-behind seated sprite sheet', () => {
  // The rule the owner set on concept B2: a seated robot's face/front reads
  // TOWARD its screen. In the ISO view that is encoded as the sprite choice:
  // officeFigureIso's desk layer is the `-sit.png` sheet, which is rendered
  // from the real TAM19 GLB at a back three-quarter camera (render rig in
  // the 0.9.58 build folder), and the CSS shows it for data-isopose="desk".
  assert.match(team, /mặt robot hướng VÀO màn hình/);
  assert.match(team, /function officeFigureIso\(a\)/);
  assert.match(team, /bot-iso-sheet4" src="\$\{base\}-sit\.png"/);
  assert.match(team, /bot-iso-sheet3" src="\$\{base\}-walk\.png"/);
  assert.match(teamCss, /\.office-agent\[data-isopose="desk"\] \.pose-desk\{display:block\}/);
  assert.match(teamCss, /\.office-agent\[data-isopose="pod"\] \.pose-pod\{display:block\}/);
  assert.match(team, /post\.kind==='pod'\?'pod':\(\(post\.kind==='desk'\|\|post\.kind==='station'\)&&post\.id!=='boss'\?'desk':'stand'\)/);
  // All sprite files for all provider tints ship.
  for (const key of ['chatgpt', 'claude', 'gemini', 'antigravity', 'default']) {
    for (const pose of ['idle', 'pod', 'sit', 'walk']) {
      assert.ok(fs.existsSync(path.join(root, `public/assets/bots/iso/tam19-${key}-${pose}.png`)), `sprite ${key}-${pose} ships`);
    }
  }
});

test('0.9.58: isometric is the default view; 3D stays one tap away', () => {
  assert.match(team, /localStorage\.getItem\('aios-office-view'\)==='3d'/, '3D auto-opens only when previously chosen');
  assert.match(team, /r0\.classList\.add\('office-iso'\)/);
  assert.match(team, /localStorage\.setItem\('aios-office-view','iso'\)/);
  assert.match(team, /localStorage\.setItem\('aios-office-view','3d'\)/);
  // Selection card parity: same card class + actions as the 3D view.
  assert.match(team, /function officeIsoCardRefresh\(\)/);
  assert.match(team, /office-bot-card/);
  assert.match(teamCss, /\.office-pod-hot\{/);
});

test('0.9.58: world<->ISO floor transform round-trips (shared floor pins)', () => {
  const L = loadOfficeLogic();
  for (const [x, z] of [[0, 0], [13.26, 1.98], [-11.9, -6.6], [16, 10.5], [-16, -10.5]]) {
    const p = L.officeIsoWorldToPct(x, z);
    const w = L.officeIsoPctToWorld(p.x, p.y);
    assert.ok(Math.abs(w.x - x) < 0.75 && Math.abs(w.z - z) < 0.75, `round-trip ${x},${z} -> ${w.x},${w.z}`);
  }
});

test('0.9.58: beauty pass assets ship, vendored addons follow the local import convention', () => {
  for (const f of ['RoomEnvironment.js', 'RGBELoader.js']) {
    const p = path.join(root, 'public/vendor/addons', f);
    assert.ok(fs.existsSync(p), f + ' vendored');
    const src = fs.readFileSync(p, 'utf8');
    assert.match(src, /from '\/vendor\/three\.module\.min\.js'/, f + ' imports the vendored three');
    assert.match(src, /MIT License/, f + ' carries its license note');
  }
  assert.ok(fs.statSync(path.join(root, 'public/assets/env/blue_photo_studio_1k.hdr')).size > 1000000, 'HDRI ships');
  assert.ok(fs.existsSync(path.join(root, 'public/assets/env/blue_floor_tiles_01_diff_512.jpg')), 'floor texture ships');
  for (const f of ['plantSmall1', 'pottedPlant', 'loungeSofa', 'lampRoundFloor', 'bookcaseOpen', 'rugRound']) {
    assert.ok(fs.existsSync(path.join(root, 'public/assets/props/kenney', f + '.glb')), 'prop ' + f + ' ships');
  }
  assert.match(team, /RoomEnvironment\.js/);
  assert.match(team, /blue_photo_studio_1k\.hdr/);
  assert.match(team, /officeApplyFloor\(env\)/);
  assert.match(team, /keep\.add\(propGroup\)/);
  assert.match(team, /toneMappingExposure=1\.25/);
});

test('0.9.58: third-party notices file ships with every license recorded', () => {
  const p = path.join(root, 'THIRD_PARTY_ASSETS.md');
  assert.ok(fs.existsSync(p), 'notices file ships at the source root');
  const n = fs.readFileSync(p, 'utf8');
  for (const s of ['CC0', 'MIT', 'Poly Haven', 'Kenney', 'RoomEnvironment', 'blue_photo_studio', 'blue_floor_tiles_01', 'Furniture Kit']) {
    assert.ok(n.includes(s), 'notices mention ' + s);
  }
});
