import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const team = fs.readFileSync(path.join(root, 'public/tabs/team.js'), 'utf8');
const teamCss = fs.readFileSync(path.join(root, 'public/tabs/team.css'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'public/tabs/guide.html'), 'utf8');

/* v0.9.57 — Văn phòng 3D: tháo rèm, trải robot, táp-để-điều. */

test('0.9.57: the GLB curtain panels are hidden right after the room loads', () => {
  assert.match(team, /OFFICE_GLB_CURTAIN=\['WallPanel_L','WallPanel_R'\]/);
  assert.match(team, /OFFICE_GLB_CURTAIN\.includes\(o\.name\)\)o\.visible=false/);
  // The dome fix (0.9.52) stays untouched alongside.
  assert.match(team, /getObjectByName\('ShellFar'\)/);
});

test('0.9.57: pod slots are a 2x5 grid driven by explicit slot numbers', () => {
  assert.match(team, /function officePodSlotPos\(slot\)/);
  assert.match(team, /podSlotMeshes/);
  assert.match(team, /OfficePodSlot/);
  // Pod markers survive the GLB procedural-hide pass.
  assert.match(team, /keep\.add\(podSlotGroup\)/);
});

test('0.9.57: placement resolver gives every bot a unique post', () => {
  assert.match(team, /function officeResolvePosts\(roster\)/);
  assert.match(team, /takenDesks/);
  assert.match(team, /takenPods/);
  assert.match(team, /podFree/);
  // Sync consumes the resolver instead of the old single lounge point.
  assert.match(team, /const posts=officeResolvePosts\(roster\)/);
});

test('0.9.57: state posts win over manual pins (precedence order in source)', () => {
  const resolveAt = team.indexOf('function officeResolvePosts(roster)');
  assert.ok(resolveAt > 0);
  const body = team.slice(resolveAt, resolveAt + 4200);
  const stateAt = body.indexOf("b.state==='working'");
  const pinsAt = body.indexOf('const pin=pins[a.id]');
  const defaultsAt = body.indexOf("a.fleet.connected&&a.fleet.state==='charging'&&!a.fleet.resting");
  assert.ok(stateAt > 0 && pinsAt > stateAt, 'state-driven posts are resolved before pins');
  assert.ok(defaultsAt > pinsAt, 'defaults are resolved after pins');
  // Resting bots claim their own baySlot as a state post.
  assert.match(body, /b\.state==='charging'&&b\.resting\)\{setPod\(a,typeof b\.baySlot==='number'\?b\.baySlot:-1,false,true\)/);
});

test('0.9.57: manual pins persist under the aios-office-pins key', () => {
  assert.match(team, /aios-office-pins/);
  assert.match(team, /function officeLoadPins\(\)/);
  assert.match(team, /function officeSavePins\(p\)/);
  assert.match(team, /pins\[sel\.a\.id\]=\{kind:'desk',id:g\.userData\.stationId\}/);
  assert.match(team, /pins\[sel\.a\.id\]=\{kind:'pod',slot:ph\[0\]\.object\.userData\.slot\}/);
  assert.match(team, /pins\[sel\.a\.id\]=\{kind:'floor'/);
});

test('0.9.57: selection — tap a robot selects it, card carries rename + back-to-auto', () => {
  assert.match(team, /function officeSelectBot\(id\)/);
  assert.match(team, /office-bot-card/);
  assert.match(team, /data-obc-act="rename"/);
  assert.match(team, /data-obc-act="auto"/);
  assert.match(team, /selRing/);
  assert.match(teamCss, /\.office-bot-card\{/);
  // The boss is selectable but never dispatched.
  assert.match(team, /sel\.a\.id!=='boss'/);
});

test('0.9.57: seated pose is driven by the resolved post kind, not the run station', () => {
  assert.match(team, /const ownDesk=A\.postKind==='desk'/);
});

test('0.9.57: guide documents the curtain removal, post assignment and the override rule', () => {
  assert.match(guide, /Hai vách tím đã được tháo \(0\.9\.57\)/);
  assert.match(guide, /trạng thái thật luôn thắng/);
  assert.match(guide, /Về tự động/);
  // 0.9.58: pins now shared by BOTH views — the guide must say so.
  assert.match(guide, /điểm ghim dùng chung cho cả văn phòng isometric \(mặc định\) và phòng 3D/);
});
