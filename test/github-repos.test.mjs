import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-gh-'));
process.env.AI_PROJECT_OS_DATA_DIR = path.join(tmp, 'data');
process.env.AIOS_GITHUB_CLONE_BASE = path.join(tmp, 'remote');

// Seed a local "GitHub" remote: <base>/octo/demo.git with one commit.
const remoteBase = process.env.AIOS_GITHUB_CLONE_BASE;
fs.mkdirSync(path.join(remoteBase, 'octo'), { recursive: true });
const bare = path.join(remoteBase, 'octo', 'demo.git');
execFileSync('git', ['init', '--bare', '-b', 'main', bare]);
const seed = path.join(tmp, 'seed');
execFileSync('git', ['clone', bare, seed]);
fs.writeFileSync(path.join(seed, 'app.txt'), 'hello v1\n');
execFileSync('git', ['-C', seed, 'add', '-A']);
execFileSync('git', ['-C', seed, '-c', 'user.email=t@t.t', '-c', 'user.name=T', 'commit', '-m', 'init']);
execFileSync('git', ['-C', seed, 'push', 'origin', 'main']);

// Seed a second repo that looks like a real in-progress project: a guide
// with a checklist, docs, a Vercel link file, a stack and a TODO note.
const bare2 = path.join(remoteBase, 'octo', 'shop.git');
execFileSync('git', ['init', '--bare', '-b', 'main', bare2]);
const seed2 = path.join(tmp, 'seed2');
execFileSync('git', ['clone', bare2, seed2]);
fs.writeFileSync(path.join(seed2, 'README.md'), '# Shop X\n\nHuong dan nhanh.\n\n## Viec con lai\n- [ ] Them trang gio hang\n- [x] Da xong trang chu\n- [ ] Viet test cho thanh toan\n');
fs.mkdirSync(path.join(seed2, 'docs'), { recursive: true });
fs.writeFileSync(path.join(seed2, 'docs', 'KE-HOACH.md'), '# Ke hoach\n- [ ] Noi Vercel preview cho PR\n');
fs.mkdirSync(path.join(seed2, '.vercel'), { recursive: true });
fs.writeFileSync(path.join(seed2, '.vercel', 'project.json'), JSON.stringify({ projectId: 'prj_test123', orgId: 'org_9' }));
fs.writeFileSync(path.join(seed2, 'package.json'), JSON.stringify({ name: 'shop-x', dependencies: { next: '15.0.0', react: '19.0.0' }, scripts: { dev: 'next dev', build: 'next build' } }));
fs.mkdirSync(path.join(seed2, 'src'), { recursive: true });
fs.writeFileSync(path.join(seed2, 'src', 'cart.js'), '// TODO: validate stock before checkout\nexport const x = 1;\n');
execFileSync('git', ['-C', seed2, 'add', '-A']);
execFileSync('git', ['-C', seed2, '-c', 'user.email=t@t.t', '-c', 'user.name=T', 'commit', '-m', 'wip shop']);
execFileSync('git', ['-C', seed2, 'push', 'origin', 'main']);

const { listGithubRepos, importGithubRepo, buildContinuationPlan, listGithubIssues, useGithubIssueAsBrief, createGithubPullRequest } = await import('../src/lib/github-repos.mjs');
const { getProject } = await import('../src/lib/projects.mjs');
const { workspaceDir } = await import('../src/lib/workspace.mjs');

const overrides = {
  connection: { id: 'gh-test', kind: 'github', meta: { authMode: 'cli', login: 'octo' } },
  gh: { command: process.execPath, args: [new URL('./fixtures/gh-stub.mjs', import.meta.url).pathname] }
};

test('GitHub loop: list repos -> import as project -> issue brief -> work -> PR push', async () => {
  const listed = await listGithubRepos(overrides);
  assert.equal(listed.available, true);
  assert.equal(listed.repos.length, 1);
  assert.equal(listed.repos[0].fullName, 'octo/demo');
  assert.equal(listed.repos[0].importedProjectId, null);

  const imported = await importGithubRepo({ fullName: 'octo/demo' }, overrides);
  const project = getProject(imported.projectId);
  assert.equal(project.settings.github.fullName, 'octo/demo');
  assert.equal(fs.readFileSync(path.join(workspaceDir(imported.projectId), 'app.txt'), 'utf8'), 'hello v1\n');

  const after = await listGithubRepos(overrides);
  assert.equal(after.repos[0].importedProjectId, imported.projectId);

  const issues = await listGithubIssues(imported.projectId, overrides);
  assert.equal(issues.issues[0].number, 7);

  const brief = await useGithubIssueAsBrief(imported.projectId, { number: 7 }, overrides);
  assert.equal(brief.issue.title, 'Fix login');
  const updated = getProject(imported.projectId);
  assert.match(updated.idea, /Fix login/);
  assert.equal(updated.settings.github.issueNumber, 7);

  // Simulate the AI team doing the work in the workspace.
  fs.writeFileSync(path.join(workspaceDir(imported.projectId), 'app.txt'), 'hello v2 - login fixed\n');
  const pr = await createGithubPullRequest(imported.projectId, {}, overrides);
  assert.match(pr.branch, /^aios\//);
  assert.equal(pr.url, 'https://github.com/octo/demo/pull/42');
  const remoteBranches = execFileSync('git', ['--git-dir', bare, 'branch', '--format=%(refname:short)'], { encoding: 'utf8' });
  assert.match(remoteBranches, /aios\//, 'branch was really pushed to the remote');
  const shown = execFileSync('git', ['--git-dir', bare, 'show', `${pr.branch}:app.txt`], { encoding: 'utf8' });
  assert.match(shown, /login fixed/);

  const finalProject = getProject(imported.projectId);
  assert.equal(finalProject.settings.github.lastPrUrl, 'https://github.com/octo/demo/pull/42');
});

test('Continue an in-progress repo: the app reads its guide, detects Vercel and builds the continuation list', async () => {
  const imported = await importGithubRepo({ fullName: 'octo/shop', vercelProject: 'shop-x' }, overrides);
  const c = imported.continuation;
  assert.ok(c, 'continuation plan is built during import');
  assert.deepEqual(c.guideFiles.map(f => f.path).sort(), ['README.md', 'docs/KE-HOACH.md']);
  assert.equal(c.counts.guide, 3, 'two README checklist items + one docs item (the done one excluded)');
  assert.equal(c.counts.issue, 1);
  assert.ok(c.counts.todo >= 1, 'TODO note in src/cart.js is counted');
  assert.equal(c.vercel.detected, true);
  assert.equal(c.vercel.projectId, 'prj_test123');
  assert.equal(c.vercel.manual, 'shop-x', 'the manual Vercel input is kept next to the detected link');
  assert.match(c.stack, /Next\.js/);
  assert.ok(c.items.some(i => i.source === 'guide' && /gio hang/.test(i.title)));
  assert.ok(c.items.some(i => i.source === 'issue' && /#7 Fix login/.test(i.title)));
  const project = getProject(imported.projectId);
  assert.match(project.idea, /HƯỚNG DẪN TRONG REPO/);
  assert.match(project.idea, /Them trang gio hang/);
  assert.match(project.goals, /Danh sách việc tiếp tục/);
  const again = await buildContinuationPlan(imported.projectId, overrides);
  assert.equal(again.ok, true);
  assert.equal(again.continuation.items.length, c.items.length, 'rebuilding the plan is stable and deduped');
});

test('GitHub repos are honestly unavailable without a linked account', async () => {
  const listed = await listGithubRepos({ connection: null, gh: overrides.gh });
  assert.equal(listed.available, false);
  assert.match(listed.reason, /Chưa liên kết/);
});
