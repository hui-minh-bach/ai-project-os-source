import fs from 'node:fs';
import path from 'node:path';
import { run, must, commandExists } from './shell.mjs';
import { resolveInfraCli } from './infra-tools.mjs';
import { listConnections, getConnection } from './vault.mjs';
import { workspaceDir } from './workspace.mjs';
import { DATA_DIR } from './store.mjs';
import { createProject, listProjects, getProject, updateProjectBrief, saveProjectGithub } from './projects.mjs';
import { ensureSecureGitignore, ensureGitIdentity, assertNoSensitiveStaged } from './git-security.mjs';

/* Work with the user's EXISTING GitHub repositories: list them, import one as
 * a project (clone into the project workspace), take an issue as the project
 * brief, and return the work as a Pull Request. Auth follows the established
 * pattern: the linked GitHub CLI (`gh auth setup-git`) or a Vault token
 * connection (Authorization header, never written into the remote URL). */
const FULL_NAME_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function githubConnection() {
  let all = [];
  try { all = listConnections(); } catch { return null; }
  const cs = all.filter(c => c.kind === 'github');
  return cs.find(c => c.meta?.authMode === 'cli') || cs[0] || null;
}
function pickGh(overrides) { return overrides.gh || resolveInfraCli('github'); }
function pickConn(overrides) { return overrides.connection !== undefined ? overrides.connection : githubConnection(); }
async function ghRun(args, { cwd, timeoutMs = 60000, overrides = {} } = {}) {
  const gh = pickGh(overrides);
  const r = await run(gh.command, [...gh.args, ...args], { cwd, timeoutMs, inheritEnv: false });
  if (r.code !== 0) throw new Error('GitHub CLI lỗi: ' + String(r.stderr || r.stdout || '').slice(-600));
  return r.stdout;
}
async function ghSetupGit(overrides) {
  const gh = pickGh(overrides);
  await run(gh.command, [...gh.args, 'auth', 'setup-git'], { timeoutMs: 30000, inheritEnv: false });
}
function tokenEnv(connection) {
  if (!connection || connection.meta?.authMode === 'cli') return {};
  let secret = connection.secret;
  if (!secret && connection.id) { try { secret = getConnection(connection.id).secret; } catch {} }
  if (!secret) return {};
  return { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.extraHeader', GIT_CONFIG_VALUE_0: `AUTHORIZATION: bearer ${secret}` };
}

export async function listGithubRepos(overrides = {}) {
  const c = pickConn(overrides);
  if (!c) return { available: false, reason: 'Chưa liên kết tài khoản GitHub (hoặc Vault đang khóa). Vào tab Kết nối để liên kết trước.' };
  let out;
  try { out = await ghRun(['repo', 'list', '--limit', '100', '--json', 'nameWithOwner,description,url,isPrivate,updatedAt,defaultBranchRef'], { overrides }); }
  catch (e) { return { available: false, reason: e.message }; }
  let arr; try { arr = JSON.parse(out); } catch { return { available: false, reason: 'GitHub CLI trả dữ liệu không đọc được.' }; }
  const imported = new Map(listProjects().map(p => [p.settings?.github?.fullName, p.id]));
  return { available: true, repos: arr.map(r => ({ fullName: r.nameWithOwner, description: r.description || '', url: r.url, private: !!r.isPrivate, updatedAt: r.updatedAt, defaultBranch: r.defaultBranchRef?.name || 'main', importedProjectId: imported.get(r.nameWithOwner) || null })) };
}

export async function importGithubRepo({ fullName } = {}, overrides = {}) {
  if (!FULL_NAME_RE.test(fullName || '')) throw new Error('Tên repo không hợp lệ (cần dạng owner/repo).');
  const c = pickConn(overrides);
  if (!c) throw new Error('Chưa liên kết tài khoản GitHub.');
  if (listProjects().some(p => p.settings?.github?.fullName === fullName)) throw new Error('Repo này đã được nhập thành dự án rồi.');
  if (!(await commandExists('git'))) throw new Error('Máy chưa cài Git.');
  const repo = fullName.split('/')[1];
  const base = process.env.AIOS_GITHUB_CLONE_BASE || 'https://github.com';
  const tmp = path.join(DATA_DIR, 'github-imports', repo + '-' + Date.now());
  fs.mkdirSync(tmp, { recursive: true });
  try {
    if (c.meta?.authMode === 'cli') await ghSetupGit(overrides);
    const r = await run('git', ['clone', `${base}/${fullName}.git`, tmp], { timeoutMs: 300000, inheritEnv: false, env: tokenEnv(c) });
    if (r.code !== 0) throw new Error('Clone thất bại: ' + String(r.stderr || '').slice(-600));
  } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
  const project = createProject({ name: repo, idea: `Dự án nhập từ GitHub: ${fullName}`, goals: `Tiếp tục phát triển repo ${fullName} bằng đội AI trong AI Project OS.` });
  const ws = workspaceDir(project.id);
  for (const entry of fs.readdirSync(tmp)) fs.renameSync(path.join(tmp, entry), path.join(ws, entry));
  fs.rmSync(tmp, { recursive: true, force: true });
  const binding = { fullName, url: `https://github.com/${fullName}`, defaultBranch: (await run('git', ['branch', '--show-current'], { cwd: ws })).stdout.trim() || 'main', importedAt: new Date().toISOString(), issueNumber: null, issueUrl: '', lastPrUrl: '', lastBranch: '' };
  saveProjectGithub(project.id, binding);
  return { projectId: project.id, binding };
}

export function githubBinding(projectId) {
  const p = getProject(projectId);
  return p.settings?.github || null;
}

export async function listGithubIssues(projectId, overrides = {}) {
  const b = githubBinding(projectId);
  if (!b?.fullName) throw new Error('Dự án này chưa gắn với repo GitHub.');
  const out = await ghRun(['issue', 'list', '--repo', b.fullName, '--state', 'open', '--limit', '50', '--json', 'number,title,url,createdAt'], { overrides });
  return { issues: JSON.parse(out) };
}

export async function useGithubIssueAsBrief(projectId, { number } = {}, overrides = {}) {
  const b = githubBinding(projectId);
  if (!b?.fullName) throw new Error('Dự án này chưa gắn với repo GitHub.');
  const n = Number(number);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Số issue không hợp lệ.');
  const out = await ghRun(['issue', 'view', String(n), '--repo', b.fullName, '--json', 'title,body,url'], { overrides });
  const j = JSON.parse(out);
  updateProjectBrief(projectId, { idea: (`GitHub issue #${n}: ${j.title}\n\n${j.body || ''}`).slice(0, 12000), goals: `Hoàn thành issue #${n} của repo ${b.fullName} và mở Pull Request ghi "Closes #${n}".` });
  saveProjectGithub(projectId, { issueNumber: n, issueUrl: j.url || '' });
  return { ok: true, issue: { number: n, title: j.title, url: j.url || '' } };
}

export async function createGithubPullRequest(projectId, { title } = {}, overrides = {}) {
  const p = getProject(projectId);
  const b = p.settings?.github;
  if (!b?.fullName) throw new Error('Dự án này chưa gắn với repo GitHub.');
  const cwd = workspaceDir(projectId);
  if (!fs.existsSync(path.join(cwd, '.git'))) throw new Error('Workspace của dự án chưa phải git repo.');
  const c = pickConn(overrides);
  if (c?.meta?.authMode === 'cli') await ghSetupGit(overrides);
  ensureSecureGitignore(cwd);
  await ensureGitIdentity(cwd);
  await must('git', ['add', '-A'], { cwd });
  const dirty = (await run('git', ['diff', '--cached', '--quiet'], { cwd })).code !== 0;
  if (dirty) { await assertNoSensitiveStaged(cwd); await must('git', ['commit', '-m', `AI Project OS: cập nhật từ dự án ${p.name}`], { cwd }); }
  let branch = (await run('git', ['branch', '--show-current'], { cwd })).stdout.trim();
  const base = b.defaultBranch || 'main';
  if (!branch || branch === base) {
    branch = 'aios/' + new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).slice(2, 7);
    await must('git', ['checkout', '-b', branch], { cwd });
  }
  const push = await run('git', ['push', '-u', 'origin', branch], { cwd, timeoutMs: 180000, inheritEnv: false, env: tokenEnv(c) });
  if (push.code !== 0) throw new Error('Push thất bại: ' + String(push.stderr || '').slice(-600));
  const prTitle = String(title || ('AI Project OS: ' + (b.issueNumber ? `giải quyết issue #${b.issueNumber}` : `cập nhật từ dự án ${p.name}`))).slice(0, 120);
  const body = `Được tạo bởi AI Project OS từ dự án "${p.name}".` + (b.issueNumber ? `\n\nCloses #${b.issueNumber}` : '');
  const out = await ghRun(['pr', 'create', '--repo', b.fullName, '--head', branch, '--base', base, '--title', prTitle, '--body', body], { cwd, overrides });
  const url = out.trim().split(/\s+/).at(-1) || '';
  saveProjectGithub(projectId, { lastPrUrl: url, lastBranch: branch });
  return { ok: true, branch, url };
}
