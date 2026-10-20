// Regression guard for the 2026-10-20 field bug: one stray </div> in
// radar.html closed the app shell early, so the browser pushed the Skills,
// Engines, Project Map, Publish and Guide sections below the 100vh shell —
// the home page looked completely empty. Every tab fragment must keep its
// structural tags balanced so the composed index nests all pages in <main>.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TABS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tabs');

test('all tab fragments have balanced div/section tags', () => {
  for (const file of fs.readdirSync(TABS).filter(f => f.endsWith('.html'))) {
    const s = fs.readFileSync(path.join(TABS, file), 'utf8');
    for (const tag of ['div', 'section']) {
      const open = (s.match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
      const close = (s.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      assert.equal(open, close, `${file}: <${tag}> ${open} open vs ${close} close`);
    }
  }
});
