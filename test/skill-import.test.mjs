import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let imp, skills, zip;
before(async () => {
  process.env.AI_PROJECT_OS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-imp-'));
  imp = await import('../src/lib/skill-import.mjs');
  skills = await import('../src/lib/skills.mjs');
  zip = await import('../src/lib/updater.mjs');
});
const b64 = (buf) => Buffer.from(buf).toString('base64');

test('parse SKILL.md frontmatter + body', () => {
  const p = imp.parseSkillMarkdown('---\nname: My Skill\ndescription: Does things\ncategory: build\nroles: frontend, backend\n---\n# My Skill\nDo the thing well.', 'x');
  assert.equal(p.name, 'My Skill');
  assert.equal(p.description, 'Does things');
  assert.equal(p.category, 'build');
  assert.deepEqual(p.roles, ['frontend', 'backend']);
  assert.ok(p.prompt.includes('Do the thing well.'));
});

test('import a single .md skill end-to-end', () => {
  const md = '---\nname: Imported One\ndescription: From a file\n---\nAlways check twice.';
  const r = imp.importSkillUpload({ filename: 'SKILL.md', contentBase64: b64(md) });
  assert.equal(r.errors.length, 0);
  assert.equal(r.imported.length, 1);
  const s = skills.getSkill(r.imported[0].id);
  assert.equal(s.name, 'Imported One');
  assert.equal(s.builtin, false);
  assert.ok(s.prompt.includes('check twice'));
});

test('import a zip skill pack (SKILL.md files win over plain .md)', () => {
  const buf = zip.createZipBuffer({
    'pack/a/SKILL.md': '---\nname: Pack A\n---\nPrompt A body.',
    'pack/b/SKILL.md': '---\nname: Pack B\n---\nPrompt B body.',
    'pack/readme.md': '# ignore me',
  });
  const r = imp.importSkillUpload({ filename: 'pack.zip', contentBase64: b64(buf) });
  assert.equal(r.imported.length, 2);
  assert.deepEqual(r.imported.map((x) => x.name).sort(), ['Pack A', 'Pack B']);
});

test('repo zip: stored, registered, skills scanned; delete removes it', () => {
  const buf = zip.createZipBuffer({
    'myrepo-main/SKILL.md': '---\nname: Repo Skill\n---\nFrom the repo root.',
    'myrepo-main/src/index.js': 'console.log(1)',
    'myrepo-main/deep/nested/SKILL.md': '---\nname: Nested Skill\n---\nNested body.',
  });
  const r = imp.importRepoZip({ filename: 'myrepo.zip', contentBase64: b64(buf) });
  assert.equal(r.imported.length, 2);
  assert.equal(r.repo.files, 3);
  assert.ok(fs.existsSync(path.join(r.repo.path, 'myrepo-main', 'src', 'index.js')));
  const listed = imp.listImportedRepos();
  assert.ok(listed.some((x) => x.id === r.repo.id));
  imp.deleteImportedRepo(r.repo.id);
  assert.ok(!imp.listImportedRepos().some((x) => x.id === r.repo.id));
  assert.ok(!fs.existsSync(r.repo.path));
});

test('zip traversal is rejected', () => {
  const buf = zip.createZipBuffer({ '../evil.md': 'x' });
  assert.throws(() => imp.importSkillUpload({ filename: 'evil.zip', contentBase64: b64(buf) }), (e) => e.code === 'IMPORT_ZIP_PATH');
});

test('git URL validation rejects non-https and credentialed URLs', async () => {
  await assert.rejects(() => imp.importRepoGit({ url: 'http://github.com/a/b' }), (e) => e.code === 'IMPORT_URL');
  await assert.rejects(() => imp.importRepoGit({ url: 'https://user:pass@github.com/a/b' }), (e) => e.code === 'IMPORT_URL');
  await assert.rejects(() => imp.importRepoGit({ url: 'not a url' }), (e) => e.code === 'IMPORT_URL');
});
