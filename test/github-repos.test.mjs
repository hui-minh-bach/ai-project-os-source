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

const { listGithubRepos, importGithubRepo, listGithubIssues, useGithubIssueAsBrief, createGithubPullRequest } = await import('../src/lib/github-repos.mjs');
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

test('GitHub repos are honestly unavailable without a linked account', async () => {
  const listed = await listGithubRepos({ connection: null, gh: overrides.gh });
  assert.equal(listed.available, false);
  assert.match(listed.reason, /Chưa liên kết/);
});
