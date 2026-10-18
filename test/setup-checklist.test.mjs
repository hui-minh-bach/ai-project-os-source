import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const home = fs.readFileSync(new URL('../public/tabs/home.html', import.meta.url), 'utf8');
const homeJs = fs.readFileSync(new URL('../public/tabs/home.js', import.meta.url), 'utf8');
const concat = fs.readFileSync(new URL('../src/lib/concat-managed.mjs', import.meta.url), 'utf8');

test('home shows a getting-started checklist driven by real state', () => {
  assert.match(home, /id="homeSetupCard"/);
  assert.match(homeJs, /function renderSetupCard\(\)/);
  // steps read live signals: AI connections (account kinds), GitHub link, prereq tools, projects
  assert.match(homeJs, /endsWith\('_account'\)/);
  assert.match(homeJs, /c\.kind==='github'/);
  assert.match(homeJs, /state\.prereq\.git&&state\.prereq\.gh/);
  assert.match(homeJs, /\(state\.projects\|\|\[\]\)\.length>0/);
  // the card can be dismissed for good and never breaks the page
  assert.match(homeJs, /aios-setup-dismissed/);
  assert.match(homeJs, /catch\{card\.hidden=true\}/);
  // actions reuse the app's own navigation and project creation
  assert.match(homeJs, /page\(b\.dataset\.setupGo\)/);
  assert.match(homeJs, /homeCreateProject/);
});

test('concat provisioning stays honest without the bundled installer (slim package path)', () => {
  const iBundled = concat.indexOf('const local=bundledSetup(root)');
  const iCache = concat.indexOf('const cached=cacheSetup(env)');
  const iDownload = concat.indexOf('await downloadImpl(cached)');
  assert.ok(iBundled > -1 && iCache > iBundled && iDownload > iCache,
    'missing bundled installer must fall through cache -> verified download');
  assert.match(concat, /verifyPinnedSetup\(cached\)/, 'downloads are SHA-verified against the pin');
  const studio = fs.readFileSync(new URL('../public/media-studio.js', import.meta.url), 'utf8');
  assert.match(studio, /tự tải và kiểm tra bản chính thức/, 'UI wording covers the download case');
});
