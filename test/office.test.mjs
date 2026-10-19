import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const teamHtml = fs.readFileSync(new URL('../public/tabs/team.html', import.meta.url), 'utf8');
const teamJs = fs.readFileSync(new URL('../public/tabs/team.js', import.meta.url), 'utf8');
const teamCss = fs.readFileSync(new URL('../public/tabs/team.css', import.meta.url), 'utf8');

test('AI office: cast carries Vietnamese names with the owner as boss', () => {
  assert.match(teamHtml, /id="officeRoom"/);
  assert.match(teamJs, /name:'Sếp Lâm'/);
  for (const name of ['Tuấn', 'Na', 'Hằng', 'Tí', 'Minh', 'Tâm', 'Phát']) {
    assert.match(teamJs, new RegExp(`name:'${name}'`), 'cast member ' + name);
  }
  // the lead receives and splits work; stations cover the whole loop
  for (const station of ['boss', 'pm', 'news', 'script', 'image', 'media', 'review', 'publish']) {
    assert.match(teamJs, new RegExp(`${station}:\\{x:`), 'station ' + station);
  }
  assert.match(teamCss, /\.office-room/);
  assert.match(teamCss, /transition:left 1\.15s ease,top 1\.15s ease/, 'agents glide between stations');
});

test('AI office: staff are walking figures, animated only while moving', () => {
  assert.match(teamJs, /function officeFigure\(a\)/);
  assert.match(teamJs, /fig-leg-l/);
  assert.match(teamJs, /office-walking/);
  assert.match(teamJs, /office-face-left/);
  assert.match(teamCss, /@keyframes officeStep/);
  assert.match(teamCss, /@keyframes officeBob/);
});

test('AI office 3D: vendored Three.js scene with desks, city backdrop and orbit camera', () => {
  const vendor = fs.readFileSync(new URL('../public/vendor/three.module.min.js', import.meta.url), 'utf8');
  assert.match(vendor, /Three\.js Authors/);
  assert.match(teamJs, /import\('\/vendor\/three\.module\.min\.js'\)/);
  assert.match(teamJs, /office3DBuild/);
  assert.match(teamJs, /GridHelper/);
  assert.match(teamJs, /office-backdrop\.jpg/, 'painted space-station backdrop asset');
  assert.ok(fs.existsSync(new URL('../public/assets/office-backdrop.jpg', import.meta.url)), 'backdrop image ships in public/assets');
  assert.match(teamJs, /CylinderGeometry/, 'curved panoramic backdrop');
  assert.match(teamJs, /holoGlobe/, 'coordinator hologram globe');
  assert.match(teamJs, /faceTexture\('zap'\)/, 'robot faces have expressions incl. zapped');
  assert.match(teamJs, /LineDashedMaterial/, 'dotted walking paths');
  assert.match(teamCss, /\.office-3d-canvas/);
});

test('AI office: idle staff recharge in the energy pods, with the sleeping face on', () => {
  assert.match(teamJs, /lounge:\{x:10,y:85,label:'🔋 Phòng nạp năng lượng'\}/);
  assert.match(teamJs, /PHÒNG NẠP NĂNG LƯỢNG/);
  assert.match(teamJs, /stId==='lounge'/, 'pod slot offsets in the 3D sync');
  assert.match(teamJs, /'sleep'/, 'sleeping face state');
  assert.match(teamJs, /đang nạp năng lượng/, 'charging badge in the 2D room');
});

test('AI office: the electric room only takes staff who really failed work', () => {
  assert.match(teamJs, /function officeCulprit\(runs\)/);
  assert.match(teamJs, /cage:\{x:90/);
  // culprit mapping by failed step
  assert.match(teamJs, /stepName\.startsWith\('produce\.'\)\?'media'/);
  assert.match(teamJs, /stepName\.startsWith\('publish:'\)\?'publish'/);
  // a newer completed run releases the culprit
  assert.match(teamJs, /completed\.createdAt/);
  // 3D zap effect exists
  assert.match(teamJs, /jaggedBolt/);
});

test('AI office: movement is driven by real app state, never a canned loop', () => {
  // data sources are the app's real endpoints
  assert.match(teamJs, /api\('\/api\/orchestrator'\)/);
  assert.match(teamJs, /api\('\/api\/ingest\/cards'\)/);
  // stage derivation reads the run's own recorded steps
  assert.match(teamJs, /function officeStageOf\(run\)/);
  assert.match(teamJs, /n\.startsWith\('produce\.'\)/);
  assert.match(teamJs, /run\.state==='awaiting-approval'/);
  // the boss can approve a waiting run from the office, through the real route
  assert.match(teamJs, /\/api\/orchestrator\/runs\/\$\{encodeURIComponent\(awaiting\.id\)\}\/approve/);
  // names are renamable and persist locally
  assert.match(teamJs, /aios-office-names/);
  // honest idle state instead of fake motion
  assert.match(teamJs, /đang chờ việc/i);
});
