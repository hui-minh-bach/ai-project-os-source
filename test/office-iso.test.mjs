import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const team = fs.readFileSync(path.join(root, 'public/tabs/team.js'), 'utf8');
const teamCss = fs.readFileSync(path.join(root, 'public/tabs/team.css'), 'utf8');

/* v0.9.58 — Văn phòng isometric (concept B2) làm mặc định + beauty pass 3D.
 * v0.9.59 — neo đo trên đồ vẽ sẵn trong phông, kẹp điểm sàn vào đa giác
 * boong, nhãn ô sạc so le, góc tên lửa thành lồng chích điện. */

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
    '\nreturn {officeResolvePosts, officeIsoPointForPost, officeIsoWorldToPct, officeIsoPctToWorld, officeIsoClampToDeck, officeIsoInDeck, officeIsoLabelShift, officeIsoScaleFor, OFFICE_ISO_STATIONS, OFFICE_ISO_PODS, OFFICE_ISO_MONITORS, OFFICE_ISO_SCALES, OFFICE_DESK_POOL, OFFICE_ISO_FG, OFFICE_ISO_POD_INTERIORS, OFFICE_ISO_CAGE_INTERIOR, OFFICE_ISO_CHAIRS, OFFICE_ISO_VIS_FRAC};');
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

test('0.9.59: isometric backdrop ships and the ISO anchors sit on the drawn deck', () => {
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
  // 0.9.59: EVERY anchor (stations + pods) must sit inside the drawn deck
  // polygon — a point outside it renders over the starfield (the 0.9.58
  // "floaters" the owner flagged from the zoomed screenshot).
  const L = loadOfficeLogic();
  for (const [id, st] of Object.entries(OFFICE_ISO_STATIONS)) assert.ok(L.officeIsoInDeck(st.x, st.y), 'station ' + id + ' inside the deck polygon');
  for (const [i, pd] of OFFICE_ISO_PODS.entries()) assert.ok(L.officeIsoInDeck(pd.x, pd.y), 'pod ' + i + ' inside the deck polygon');
  // Pod anchors are spread far enough apart for name labels to stagger.
  for (let i = 0; i < OFFICE_ISO_PODS.length; i++) for (let j = i + 1; j < OFFICE_ISO_PODS.length; j++) {
    const d = Math.hypot(OFFICE_ISO_PODS[i].x - OFFICE_ISO_PODS[j].x, OFFICE_ISO_PODS[i].y - OFFICE_ISO_PODS[j].y);
    assert.ok(d >= 3, `pod anchors ${i}/${j} too close (${d})`);
  }
});

test('0.9.59: fleet fixture maps to the expected ISO stations (position-mapping)', () => {
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

test('0.9.59: floor pins are clamped into the drawn deck polygon', () => {
  const L = loadOfficeLogic();
  // World corners project onto the deck diamond corners — on the rim.
  for (const post of [{ kind: 'floor', x: -16, z: -10.5 }, { kind: 'floor', x: 16, z: 10.5 }, { kind: 'floor', x: 16, z: 0.9 }, { kind: 'floor', x: -16, z: 10.5 }]) {
    const p = L.officeIsoPointForPost(post);
    assert.ok(L.officeIsoInDeck(p.x, p.y), `floor post ${post.x},${post.z} -> ${p.x},${p.y} must render on the deck`);
  }
  // A point projected outside the deck is pulled to the rim, not left in space.
  const c = L.officeIsoClampToDeck({ x: 1, y: 20 });
  assert.ok(L.officeIsoInDeck(c.x, c.y), 'clamped point lands inside the deck');
  assert.ok(c.x > 4 && c.x < 30, 'clamped point stays near the left rim it fell off');
  // Points already inside pass through untouched.
  assert.deepEqual(L.officeIsoClampToDeck({ x: 50, y: 50 }), { x: 50, y: 50 });
  // Desk/pod/cage posts are NOT clamped away from their measured anchors.
  assert.deepEqual(L.officeIsoPointForPost({ kind: 'cage' }), L.OFFICE_ISO_STATIONS.cage);
  assert.deepEqual(L.officeIsoPointForPost({ kind: 'pod', slot: 3 }), L.OFFICE_ISO_PODS[3]);
});

test('0.9.59: the cage post stands inside the drawn electric cage; pod labels stagger', () => {
  const { OFFICE_ISO_STATIONS, OFFICE_ISO_PODS } = loadOfficeLogic();
  const cage = OFFICE_ISO_STATIONS.cage;
  // The cage drawn in the 0.9.59 backdrop occupies the right corner
  // (x 79–94%, y 30–56%); the post must land inside it, label below it.
  assert.ok(cage.x >= 79 && cage.x <= 94 && cage.y >= 45 && cage.y <= 58, 'cage post inside the drawn cage');
  assert.ok(cage.ly > cage.y, 'cage station label sits below the cage base');
  // Label de-pile-up: every pod slot carries its own label-lattice offset
  // (lx/ly for the name, bx/by for the badge), applied as a transform; and
  // plain charging/offline pod bots show the name only (badge muted).
  const L2 = loadOfficeLogic();
  for (const [i, pd] of OFFICE_ISO_PODS.entries()) {
    for (const k of ['lx', 'ly', 'bx', 'by']) assert.ok(Number.isFinite(pd[k]), `pod ${i} carries label offset ${k}`);
    assert.deepEqual(L2.officeIsoLabelShift({ kind: 'pod', slot: i }), pd);
  }
  assert.deepEqual(L2.officeIsoLabelShift({ kind: 'desk', id: 'news' }), { lx: 0, ly: -93, bx: 0, by: -14 });
  assert.deepEqual(L2.officeIsoLabelShift({ kind: 'desk', id: 'image' }), { lx: 0, ly: -93, bx: 0, by: -14 });
  assert.deepEqual(L2.officeIsoLabelShift({ kind: 'station', id: 'boss' }), { lx: 0, ly: 22, bx: 0, by: 0 });
  assert.match(team, /const nlx=pd\?Math\.round\(pd\.lx\*lsc\):0/);
  assert.match(team, /pose==='pod'&&a\.fleet&&!a\.fleet\.resting/);
  assert.match(teamCss, /\[data-isopose="desk"\] \.office-agent-badge\{top:auto;bottom:100%/);
  assert.match(teamCss, /\.office-agent-badge\{position:absolute;top:100%/);
  assert.match(team, /function officeIsoLabelPass\(room\)/);
  // Guide wording: the corner is the electric cage, not a rocket.
  const guide = fs.readFileSync(path.join(root, 'public/tabs/guide.html'), 'utf8');
  assert.ok(guide.includes('lồng chích điện'), 'guide names the electric cage corner');
  assert.ok(!guide.includes('tên lửa'), 'guide no longer mentions a rocket');
});

test('0.9.59: every working desk has a drawn-monitor glow anchor on the deck, near its seat', () => {
  const L = loadOfficeLogic();
  for (const id of ['news', 'script', 'image', 'media', 'review', 'pm', 'publish', 'intake']) {
    const m = L.OFFICE_ISO_MONITORS[id];
    assert.ok(m, 'monitor anchor for ' + id);
    assert.ok(L.officeIsoInDeck(m.x, m.y), 'monitor anchor ' + id + ' sits on the drawn deck');
    // 0.9.60: the station anchor is the sprite FRAME anchor (seat +
    // measured sprite offset); the invariant is monitor <-> CHAIR.
    const ch = L.OFFICE_ISO_CHAIRS[id];
    const st = ch ? { x: (ch.x0 + ch.x1) / 2, y: (ch.y0 + ch.y1) / 2 } : L.OFFICE_ISO_STATIONS[id];
    const d = Math.hypot(m.x - st.x, m.y - st.y);
    assert.ok(d <= 13, `monitor anchor ${id} near its seat (${d.toFixed(1)}%)`);
  }
  // Glow is driven by the REAL working state only, in both views.
  assert.match(team, /function officeIsoUpdateGlow\(room,litStations\)/);
  assert.match(team, /a\.fleet\.state==='working'/);
  assert.match(team, /window\.__officeIsoGlow=/);
  assert.match(team, /deskScreens\[stId\]/);
  assert.match(team, /window\.__office3DGlow=/);
});

test('0.9.59: sprite scale is matched per zone to the drawn furniture', () => {
  const L = loadOfficeLogic();
  // Far desk grid smaller than the near desks; intake (foreground) full size.
  assert.equal(L.officeIsoScaleFor({ kind: 'desk', id: 'news' }), L.OFFICE_ISO_SCALES.deskFar);
  assert.equal(L.officeIsoScaleFor({ kind: 'desk', id: 'publish' }), L.OFFICE_ISO_SCALES.deskNear);
  assert.ok(L.OFFICE_ISO_SCALES.deskFar < L.OFFICE_ISO_SCALES.deskNear, 'far desks render smaller');
  assert.equal(L.officeIsoScaleFor({ kind: 'station', id: 'intake' }), 1);
  assert.equal(L.officeIsoScaleFor({ kind: 'pod', slot: 0 }), L.OFFICE_ISO_SCALES.pod);
  assert.equal(L.officeIsoScaleFor({ kind: 'cage' }), L.OFFICE_ISO_SCALES.cage);
  // Floor pins scale with depth (nearer the viewer = lower on screen = bigger).
  const far = L.officeIsoScaleFor({ kind: 'floor' }, { x: 50, y: 20 });
  const near = L.officeIsoScaleFor({ kind: 'floor' }, { x: 50, y: 85 });
  assert.ok(near > far, 'floor scale grows toward the viewer');
  // The scale is applied without moving the feet anchor.
  assert.match(teamCss, /scale\(var\(--isos,1\)\);transform-origin:50% 88%/);
  assert.match(team, /el\.style\.setProperty\('--isos'/);
});

test('0.9.59: flow pulses fire only on observed handoffs; guide explains glow, pulses, label clamping', () => {
  assert.match(team, /function officeIsoDetectFlow\(room,curWorking\)/);
  assert.match(team, /function officeIsoFirePulse\(room,from,to,runId\)/);
  assert.match(team, /s\.runId&&t\.runId&&s\.runId===t\.runId/);
  assert.match(team, /window\.__officeIsoPulses/);
  // Label pass: de-overlap + clamp into the room, for names/badges/stations.
  assert.match(team, /officeIsoLabelPass\(room\)/);
  assert.match(teamCss, /\.office-monitor-glow\{/);
  assert.match(teamCss, /\.office-flow-pulse\{/);
  const guide = fs.readFileSync(path.join(root, 'public/tabs/guide.html'), 'utf8');
  assert.ok(guide.includes('màn hình ở bàn của nó sáng lên'), 'guide explains the monitor glow');
  assert.ok(guide.includes('tia sáng'), 'guide explains the handoff pulse');
  assert.ok(guide.includes('tự kéo vào trong khung phòng'), 'guide explains label clamping');
});

test('0.9.60: compositing — foreground cut-outs ship and the geometry puts sprites INSIDE the furniture', () => {
  const L = loadOfficeLogic();
  // Every foreground cut-out ships as a real PNG cut from the backdrop.
  assert.equal(L.OFFICE_ISO_FG.length, 13, '8 desk fronts + 4 pod glass fronts + cage front');
  for (const f of L.OFFICE_ISO_FG) {
    const p = path.join(root, 'public/assets/office-iso-fg', f.img);
    assert.ok(fs.existsSync(p), 'fg asset ' + f.img + ' ships');
    assert.ok(fs.statSync(p).size > 3000, 'fg asset ' + f.img + ' is a real cut-out');
  }
  assert.match(team, /office-fg-layer/, 'fg layer renders in the ISO room');
  assert.match(team, /office-iso-fg\//, 'fg layer loads the cut-outs');
  // The boss gets NO station label in ISO (his name plate is the one label).
  assert.match(team, /isoMode&&id==='boss'/, 'boss station label skipped in ISO');
  // Pod bots scaled to fit the drawn chambers; cage bot to the cage height.
  assert.ok(L.OFFICE_ISO_SCALES.pod <= 0.72, 'pod sprite small enough for the chamber interior');
  assert.ok(L.OFFICE_ISO_SCALES.cage <= 0.88, 'cage sprite small enough for the cage interior');
  // Seat geometry: the chair zone of every desk is declared, and the desk
  // anchor's visible-sprite bottom (anchor + measured sit offset) must
  // land in it horizontally centred on the chair.
  for (const id of ['news', 'script', 'image', 'media', 'review', 'pm', 'publish', 'boss']) {
    assert.ok(L.OFFICE_ISO_CHAIRS[id], 'chair zone for ' + id);
  }
  // Pod interiors + cage interior are declared inside the drawn furniture.
  assert.equal(L.OFFICE_ISO_POD_INTERIORS.length, 4);
  for (const [i, inr] of L.OFFICE_ISO_POD_INTERIORS.entries()) {
    const pd = L.OFFICE_ISO_PODS[i];
    assert.ok(pd.x > inr.x0 - 2 && pd.x < inr.x1 + 2, 'pod ' + i + ' anchor over its chamber');
  }
  const ci = L.OFFICE_ISO_CAGE_INTERIOR;
  assert.ok(L.OFFICE_ISO_STATIONS.cage.x > ci.x0 && L.OFFICE_ISO_STATIONS.cage.x < ci.x1 + 2, 'cage anchor over the cage interior');
  // The label pass now treats sprite bodies + foreground layers as obstacles.
  assert.match(team, /OFFICE_ISO_VIS_FRAC/, 'label pass uses visible-sprite boxes');
  assert.match(team, /el\.dataset\.postkind=post\?post\.kind:''/, 'render tags each bot with its post kind');
  assert.match(teamCss, /\[data-postkind="cage"\] \.office-agent-badge\{top:auto;bottom:100%/, 'cage badge hangs above the cage');
  assert.match(teamCss, /office-fg\{/, 'fg layer styled');
});
