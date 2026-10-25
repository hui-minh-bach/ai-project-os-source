import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { run, must, commandExists } from './shell.mjs';
import { resolveInfraCli } from './infra-tools.mjs';
import { listConnections, getConnection } from './vault.mjs';
import { workspaceDir, safeResolve } from './workspace.mjs';
import { DATA_DIR } from './store.mjs';
import { createProject, listProjects, getProject, updateProjectBrief, saveProjectGithub, updateProjectModelRoles } from './projects.mjs';
import { ensureSecureGitignore, ensureGitIdentity, assertNoSensitiveStaged } from './git-security.mjs';

/* Work with the user's EXISTING GitHub repositories: list them, import one as
 * a project (clone into the project workspace), take an issue as the project
 * brief, and return the work as a Pull Request. Auth follows the established
 * pattern: the linked GitHub CLI (`gh auth setup-git`) or a Vault token
 * connection (Authorization header, never written into the remote URL). */
const FULL_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/;
export function normalizeGithubRepo(value){
 let name=String(value||'').trim();
 if(name.startsWith('https://')){const u=new URL(name);if(u.hostname!=='github.com'||u.username||u.password||u.search||u.hash)throw new Error('Chỉ nhận link repo https://github.com/owner/repo.');name=u.pathname.replace(/^\/|\/$/g,'');}
 name=name.replace(/\.git$/,'');if(!FULL_NAME_RE.test(name)||name.length>240)throw new Error('Repo cần dạng owner/repo hoặc link GitHub của repo.');return name;
}
function importFailure(r){
 if(r.timedOut)return 'Clone quá thời gian. Kiểm tra mạng/GitHub rồi thử lại; chưa tạo dự án trống.';
 const text=String(r.stderr||'');
 if(/authentication|could not read Username|terminal prompts disabled|repository not found|403|401/i.test(text))return 'Không truy cập được repo bằng tài khoản GitHub đã liên kết. Kiểm tra quyền repo riêng tư và đăng nhập lại GitHub trong Kết nối.';
 if(/resolve host|connect|SSL|TLS|certificate/i.test(text))return 'Git không kết nối được GitHub. Kiểm tra mạng, proxy hoặc chứng chỉ Windows; không tắt bảo vệ LSA.';
 return 'Git clone không hoàn tất (mã '+String(r.code)+'). Chưa tạo dự án; có thể thử lại.';
}
async function cloneAuth(c,overrides){
 let secret=c.secret;if(!secret&&c.id&&c.meta?.authMode!=='cli')try{secret=getConnection(c.id).secret;}catch{}
 if(c.meta?.authMode==='cli'){
  const gh=pickGh(overrides),args=['auth','token','--hostname','github.com'];if(c.meta?.login)args.push('--user',c.meta.login);
  const out=await run(gh.command,[...gh.args,...args],{timeoutMs:15000,inheritEnv:false,env:{GH_PROMPT_DISABLED:'1'}});
  if(out.code!==0||!out.stdout.trim())throw new Error('Phiên GitHub CLI chưa sẵn sàng. Liên kết lại tài khoản trong Kết nối.');secret=out.stdout.trim();
 }
 if(!secret)throw new Error('Thiếu xác thực GitHub.');
 return {GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never',GIT_LFS_SKIP_SMUDGE:'1',GIT_CONFIG_COUNT:'2',GIT_CONFIG_KEY_0:'credential.helper',GIT_CONFIG_VALUE_0:'',GIT_CONFIG_KEY_1:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_1:'AUTHORIZATION: basic '+Buffer.from('x-access-token:'+secret).toString('base64')};
}

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
  const r = await run(gh.command, [...gh.args, ...args], { cwd, timeoutMs, inheritEnv: false,env:{GH_PROMPT_DISABLED:'1',...(pickConn(overrides)?.meta?.authMode!=='cli'?{GH_TOKEN:(pickConn(overrides)?.secret||getConnection(pickConn(overrides).id).secret)}:{})} });
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

const GUIDE_NAME_RES = [/^readme\.md$/i, /^huong[-_ ]?dan.*\.md$/i, /^guide.*\.md$/i, /^spec.*\.md$/i, /^contributing\.md$/i];
function scanGuideFiles(ws) {
  const found = [];
  try {
    for (const e of fs.readdirSync(ws, { withFileTypes: true })) if (e.isFile() && GUIDE_NAME_RES.some(rx => rx.test(e.name))) found.push(e.name);
    const docsDir = path.join(ws, 'docs');
    if (fs.existsSync(docsDir) && fs.lstatSync(docsDir).isDirectory()) for (const e of fs.readdirSync(docsDir, { withFileTypes: true })) if (e.isFile() && /\.md$/i.test(e.name)) found.push('docs/' + e.name);
  } catch {}
  const rank = n => (/readme/i.test(n) ? 0 : /huong/i.test(n) ? 1 : 2);
  return [...new Set(found)].sort((a, b) => rank(a) - rank(b)).slice(0, 10);
}
function extractChecklist(text) {
  const items = [];
  for (const line of String(text || '').split(/\r?\n/)) { const m = line.match(/^\s*[-*]\s*\[ \]\s*(.+)$/); if (m) items.push(m[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()); }
  return items.filter(Boolean).slice(0, 40);
}
function scanTodos(ws) {
  const skip = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
  const exts = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.html', '.css', '.md']);
  let count = 0; const samples = []; let visited = 0;
  const walk = dir => {
    if (visited > 600) return;
    let entries = []; try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (visited > 600) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!skip.has(e.name)) walk(full); }
      else if (e.isFile() && exts.has(path.extname(e.name).toLowerCase())) {
        visited++;
        let text = ''; try { text = fs.readFileSync(full, 'utf8'); } catch { continue; }
        const hits = text.match(/\b(TODO|FIXME)\b[^\n]*/g) || [];
        if (hits.length) { count += hits.length; if (samples.length < 10) samples.push(path.relative(ws, full) + ': ' + hits[0].slice(0, 90)); }
      }
    }
  };
  walk(ws);
  return { count, samples };
}
/* Read the imported repo the way a new team member would: its own guide
 * files (README / HUONG-DAN / docs), its Vercel link, its stack, its open
 * issues and its TODO notes — then turn all of that into the project's
 * continuation checklist and write the guide into the project brief, so
 * the Council/PM/Workers plan from the repo's own instructions. */
export async function buildContinuationPlan(projectId, overrides = {}) {
  const project = getProject(projectId);
  const b = project.settings?.github;
  if (!b?.fullName) throw new Error('Dự án này chưa gắn với repo GitHub.');
  const ws = workspaceDir(projectId);
  const guideFiles = scanGuideFiles(ws);
  let guideText = ''; const guideMeta = [];
  for (const rel of guideFiles) {
    let text = ''; try { text = fs.readFileSync(path.join(ws, rel), 'utf8'); } catch { continue; }
    guideMeta.push({ path: rel, bytes: Buffer.byteLength(text) });
    if (guideText.length < 20000) guideText += `\n\n===== ${rel} =====\n` + text.slice(0, 8000);
  }
  let vercel = b.vercel || null;
  try {
    const vj = JSON.parse(fs.readFileSync(safeResolve(ws,'.vercel/project.json'), 'utf8'));
    if (vj.projectId) vercel = { detected: true, projectId: vj.projectId, orgId: vj.orgId || '', ...(vercel?.manual ? { manual: vercel.manual } : {}) };
  } catch {}
  let stack = '';
  try {
    const pkg = JSON.parse(fs.readFileSync(safeResolve(ws,'package.json'), 'utf8'));
    const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
    const hints = [['next', 'Next.js'], ['react', 'React'], ['vue', 'Vue'], ['svelte', 'Svelte'], ['express', 'Express'], ['fastify', 'Fastify'], ['electron', 'Electron'], ['tailwindcss', 'Tailwind']].filter(([k]) => deps.includes(k)).map(([, v]) => v);
    stack = `Node project "${pkg.name || ''}"${hints.length ? ' · ' + hints.join(' + ') : ''}${deps.length ? ` · ${deps.length} thư viện` : ''}${pkg.scripts ? ' · lệnh có sẵn: ' + Object.keys(pkg.scripts).slice(0, 8).join(', ') : ''}`;
  } catch {}
  const items = []; const seen = new Set();
  const pushItem = (source, title, ref = '') => { const t = String(title || '').trim().slice(0, 200); if (!t) return; const k = source + '|' + t.toLowerCase(); if (seen.has(k)) return; seen.add(k); items.push({ source, title: t, ref }); };
  for (const t of extractChecklist(guideText)) pushItem('guide', t);
  let issuesError = '';
  try { const { issues } = await listGithubIssues(projectId, overrides); for (const i of issues) pushItem('issue', `#${i.number} ${i.title}`, i.url || ''); }
  catch (e) { issuesError = e.message; }
  const todos = scanTodos(ws);
  if (todos.count) pushItem('todo', `Xử lý ${todos.count} ghi chú TODO/FIXME trong code`, todos.samples.join(' · '));
  const counts = { guide: items.filter(i => i.source === 'guide').length, issue: items.filter(i => i.source === 'issue').length, todo: todos.count };
  const continuation = { builtAt: new Date().toISOString(), guideFiles: guideMeta, vercel, stack, items, counts, ...(issuesError ? { issuesError } : {}) };
  saveProjectGithub(projectId, { continuation, ...(vercel ? { vercel } : {}) });
  const excerpt = guideText.trim().slice(0, 7000) || '(Repo chưa có file hướng dẫn/README đọc được — đội AI sẽ đọc trực tiếp code trong workspace.)';
  updateProjectBrief(projectId, {
    idea: `Tiếp tục dự án ${b.fullName} — dự án có sẵn được nhập từ GitHub${vercel ? ' (đã nối Vercel)' : ''}.\n\nHƯỚNG DẪN TRONG REPO — đội AI phải đọc kỹ và làm theo:\n${excerpt}`.slice(0, 12000),
    goals: `Tiếp tục dự án theo đúng hướng dẫn trong repo. Danh sách việc tiếp tục hiện có ${items.length} mục (${counts.guide} từ hướng dẫn, ${counts.issue} issue đang mở, ${counts.todo} ghi chú TODO/FIXME). Làm xong từng phần thì đẩy Pull Request lên ${b.fullName} theo quy trình thường lệ để chủ dự án duyệt.${stack ? ' Stack: ' + stack + '.' : ''}`
  });
  return { ok: true, continuation };
}

export async function importGithubRepo({ fullName, vercelProject, copyTeamFrom } = {}, overrides = {}) {
  fullName=normalizeGithubRepo(fullName);
  const progress=(stage,percent=null)=>overrides.onProgress?.({stage,percent});
  const previous=copyTeamFrom?getProject(String(copyTeamFrom)):null;
  if(/^https:\/\/github\.com/i.test(String(vercelProject||'')))throw new Error('Link GitHub cần nhập ở ô Repo GitHub, không phải ô Vercel.');
  const c = pickConn(overrides);
  if (!c) throw new Error('Chưa liên kết tài khoản GitHub.');
  if (listProjects().some(p => p.settings?.github?.fullName?.toLowerCase() === fullName.toLowerCase())) throw new Error('Repo này đã được nhập thành dự án rồi.');
  if (!(await commandExists('git'))) throw new Error('Máy chưa cài Git.');
  const repo = fullName.split('/')[1];
  const base = process.env.AIOS_GITHUB_CLONE_BASE || 'https://github.com';
  const tmp = path.join(DATA_DIR, 'github-imports', repo + '-' + crypto.randomUUID());
  fs.mkdirSync(tmp, { recursive: true });
  try {
    progress('authenticating');const env=await cloneAuth(c,overrides);
    progress('cloning');
    const r = await run('git', ['-c','core.longpaths=true','clone','--progress','--depth','1','--single-branch', `${base}/${fullName}.git`, tmp], { timeoutMs: overrides.cloneTimeoutMs||180000, inheritEnv: false, env, onStderr:line=>{const m=String(line).match(/(?:Receiving objects|Resolving deltas|Updating files):\s*(\d+)%/);if(m)progress('cloning',Number(m[1]));} });
    if (r.code !== 0) throw new Error(importFailure(r));
    progress('reading-guides');
  } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
  const project = createProject({ name: repo, idea: `Dự án nhập từ GitHub: ${fullName}`, goals: `Tiếp tục phát triển repo ${fullName} bằng đội AI trong AI Project OS.` });
  const ws = workspaceDir(project.id);
  for (const entry of fs.readdirSync(tmp)) fs.renameSync(path.join(tmp, entry), path.join(ws, entry));
  fs.rmSync(tmp, { recursive: true, force: true });
  const binding = { fullName, url: `https://github.com/${fullName}`, defaultBranch: (await run('git', ['branch', '--show-current'], { cwd: ws,timeoutMs:10000 })).stdout.trim() || 'main', importedAt: new Date().toISOString(), issueNumber: null, issueUrl: '', lastPrUrl: '', lastBranch: '' };
  saveProjectGithub(project.id, binding);
  let teamWarning='';if(previous?.modelRoles)try{updateProjectModelRoles(project.id,{...previous.modelRoles,teams:previous.modelRoleTeams,backups:previous.modelRoleBackups||{}});}catch{teamWarning='Đã nhập code; phân công AI của dự án cũ cần xác minh lại trong Kết nối.';}
  if (vercelProject) saveProjectGithub(project.id, { vercel: { manual: String(vercelProject).slice(0, 200) } });
  let continuation = null, continuationError = '';
  try { continuation = (await buildContinuationPlan(project.id, overrides)).continuation; }
  catch (e) { continuationError = e.message; }
  progress('completed');return { projectId: project.id, binding: githubBinding(project.id), continuation, continuationError, teamWarning };
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
