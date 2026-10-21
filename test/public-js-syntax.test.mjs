// Regression guard (found in 0.9.53): public/tabs/engines.js shipped
// with a fatal SyntaxError (a bare ${...} nested inside a template
// substitution), so the browser never defined loadEngines — init.js's
// bootstrap step table then threw and the Engine Hub stayed empty.
// Every classic script the page loads must at least PARSE.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const PUBLIC_DIR = new URL('../public/', import.meta.url);
function scripts(dir, prefix = '') {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== 'vendor' && e.name !== 'assets') out.push(...scripts(new URL(e.name + '/', dir), prefix + e.name + '/')); }
    else if (e.name.endsWith('.js')) out.push(prefix + e.name);
  }
  return out;
}

test('every public classic script parses (no dead tab scripts)', () => {
  const files = scripts(PUBLIC_DIR);
  assert.ok(files.length >= 15, `expected the full tab script set, got ${files.length}`);
  for (const rel of files) {
    const code = fs.readFileSync(new URL(rel, PUBLIC_DIR), 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename: rel }), `${rel} must parse as a classic script`);
  }
});

test('init.js bootstrap loaders are all defined by the tab scripts', () => {
  const init = fs.readFileSync(new URL('init.js', PUBLIC_DIR), 'utf8');
  const all = scripts(PUBLIC_DIR).map(rel => fs.readFileSync(new URL(rel, PUBLIC_DIR), 'utf8')).join('\n');
  for (const fn of ['vaultRefresh', 'loadConnections', 'loadSkills', 'loadEngines', 'loadPrereq', 'loadProjects']) {
    assert.ok(init.includes(fn), `init.js references ${fn}`);
    assert.ok(new RegExp(`function ${fn}\\b`).test(all), `${fn} is defined by a public script`);
  }
  assert.ok(path.basename(PUBLIC_DIR.pathname) === 'public');
});
