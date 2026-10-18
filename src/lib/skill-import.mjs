// Import skills and skill repos that users already have or collected online.
//
// Intake paths (Skills tab):
//  - one skill file (.md, SKILL.md format with optional YAML frontmatter)
//  - a .zip skill pack (every SKILL.md / .md inside becomes a custom skill)
//  - a whole repo: uploaded .zip or a public Git URL cloned with the local
//    git CLI. The repo is stored under <dataDir>/imported-repos/<id> and
//    every SKILL.md inside it is imported as a custom skill.
//
// Safety: zip entries are path-checked (no traversal, no absolute paths),
// size-capped and read in memory first; git URLs must be plain https with
// no embedded credentials; importing never executes anything from a repo.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { DATA_DIR, readJson, writeJson } from './store.mjs';
import { listZipEntries } from './updater.mjs';
import { saveCustomSkill, SKILL_CATEGORIES, SKILL_ROLES } from './skills.mjs';

const REPOS_FILE = 'imported-repos.json';
const REPOS_DIR = path.join(DATA_DIR, 'imported-repos');
const MAX_UPLOAD = 2_400_000; // readBody caps JSON at 3MB; base64 of ~2.4MB fits.
const MAX_ZIP_FILES = 3000;
const MAX_ZIP_TOTAL = 60 * 1024 * 1024;
const MAX_ENTRY = 10 * 1024 * 1024;

function fail(code, message) { const e = new Error(message); e.code = code; return e; }

export function parseSkillMarkdown(text, fallbackName = 'Skill nhập') {
  let t = String(text || '').replace(/^﻿/, '');
  const out = { name: '', description: '', category: '', icon: '', roles: [], prompt: '' };
  const fm = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    t = t.slice(fm[0].length);
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase(), val = m[2].trim().replace(/^["']|["']$/g, '');
      if (key === 'name') out.name = val;
      else if (key === 'description') out.description = val;
      else if (key === 'category') out.category = val;
      else if (key === 'icon') out.icon = val;
      else if (key === 'roles') out.roles = val.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    }
  }
  out.prompt = t.trim();
  if (!out.name) {
    const h = out.prompt.match(/^#\s+(.+)$/m);
    out.name = (h ? h[1].trim() : '') || fallbackName;
  }
  return out;
}

function toSkillInput(parsed, sourceName) {
  const roles = parsed.roles.filter((r) => SKILL_ROLES.includes(r));
  return {
    name: String(parsed.name || sourceName).slice(0, 80),
    description: String(parsed.description || 'Skill được nhập từ file/repo của người dùng.').slice(0, 240),
    prompt: String(parsed.prompt || '').slice(0, 5000),
    category: SKILL_CATEGORIES.includes(parsed.category) ? parsed.category : 'other',
    roles: roles.length ? roles : [...SKILL_ROLES],
    icon: parsed.icon ? String(parsed.icon).slice(0, 8) : '⬆',
  };
}

function importOne(text, sourceName) {
  const parsed = parseSkillMarkdown(text, sourceName.replace(/\.md$/i, ''));
  if (!parsed.prompt) throw new Error('File không có nội dung hướng dẫn.');
  const saved = saveCustomSkill(toSkillInput(parsed, sourceName));
  return { id: saved.id, name: saved.name, source: sourceName, truncated: parsed.prompt.length > 5000 };
}

function decodeUpload(b) {
  const name = String(b?.filename || '');
  if (!name || typeof b?.contentBase64 !== 'string' || !b.contentBase64)
    throw fail('IMPORT_INPUT', 'Thiếu file tải lên.');
  const buf = Buffer.from(b.contentBase64, 'base64');
  if (!buf.length) throw fail('IMPORT_INPUT', 'File rỗng.');
  if (buf.length > MAX_UPLOAD) throw fail('IMPORT_TOO_LARGE', 'File vượt giới hạn 2,4 MB của kênh tải lên. Repo lớn hãy nhập bằng link Git.');
  return { name, buf };
}

function readZipEntries(buf) {
  const entries = listZipEntries(buf);
  if (entries.length > MAX_ZIP_FILES) throw fail('IMPORT_ZIP', `Zip có quá nhiều file (${entries.length} > ${MAX_ZIP_FILES}).`);
  let total = 0;
  const files = [];
  for (const e of entries) {
    const rel = e.name.replace(/\\/g, '/');
    if (!rel || rel.endsWith('/')) continue;
    if (rel.startsWith('/') || /^[a-zA-Z]:/.test(rel) || rel.split('/').includes('..'))
      throw fail('IMPORT_ZIP_PATH', 'Đường dẫn nguy hiểm trong zip: ' + e.name);
    if (rel.split('/').includes('.git') || rel.startsWith('__MACOSX/')) continue;
    if (e.usize > MAX_ENTRY) throw fail('IMPORT_ZIP_SIZE', 'File trong zip quá lớn: ' + e.name);
    total += e.usize;
    if (total > MAX_ZIP_TOTAL) throw fail('IMPORT_ZIP_SIZE', 'Tổng dung lượng giải nén vượt 60 MB.');
    const lh = e.lhofs;
    if (buf.readUInt32LE(lh) !== 0x04034b50) throw fail('IMPORT_ZIP', 'Local header bị hỏng: ' + e.name);
    const ln = buf.readUInt16LE(lh + 26), lx = buf.readUInt16LE(lh + 28);
    const data = buf.subarray(lh + 30 + ln + lx, lh + 30 + ln + lx + e.csize);
    let out;
    if (e.method === 0) out = Buffer.from(data);
    else if (e.method === 8) out = zlib.inflateRawSync(data);
    else throw fail('IMPORT_ZIP_METHOD', 'Phương thức nén zip chưa hỗ trợ: ' + e.method);
    files.push({ path: rel, data: out });
  }
  return files;
}

export function importSkillUpload(b) {
  const { name, buf } = decodeUpload(b);
  const lower = name.toLowerCase();
  const imported = [], errors = [];
  if (lower.endsWith('.md')) {
    try { imported.push(importOne(buf.toString('utf8'), name)); }
    catch (e) { errors.push({ source: name, error: e.message }); }
  } else if (lower.endsWith('.zip')) {
    const files = readZipEntries(buf).filter((f) => f.path.toLowerCase().endsWith('.md'));
    const skills = files.filter((f) => path.posix.basename(f.path).toLowerCase() === 'skill.md');
    const targets = skills.length ? skills : files;
    if (!targets.length) throw fail('IMPORT_NO_SKILL', 'Không tìm thấy file SKILL.md hay .md nào trong zip. Nếu đây là repo mã nguồn, hãy dùng mục Nhập repo.');
    for (const f of targets) {
      try { imported.push(importOne(f.data.toString('utf8'), f.path)); }
      catch (e) { errors.push({ source: f.path, error: e.message }); }
    }
  } else {
    throw fail('IMPORT_TYPE', 'Chỉ nhận file .md (một skill) hoặc .zip (gói skill chứa SKILL.md).');
  }
  return { imported, errors };
}

function repos() { const r = readJson(REPOS_FILE, []); return Array.isArray(r) ? r : []; }
export function listImportedRepos() { return repos(); }

function scanAndImportSkills(rootDir, label) {
  const imported = [], errors = [];
  const walk = (dir, depth) => {
    if (depth > 8) return;
    let items = [];
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) { if (it.name !== '.git' && it.name !== 'node_modules') walk(p, depth + 1); }
      else if (it.name.toLowerCase() === 'skill.md') {
        const rel = path.relative(rootDir, p).split(path.sep).join('/');
        try { imported.push(importOne(fs.readFileSync(p, 'utf8'), `${label}/${rel}`)); }
        catch (e) { errors.push({ source: rel, error: e.message }); }
      }
    }
  };
  walk(rootDir, 0);
  return { imported, errors };
}

function countFiles(rootDir) {
  let n = 0;
  const walk = (dir, depth) => {
    if (depth > 10 || n > 20000) return;
    let items = [];
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of items) {
      if (it.isDirectory()) { if (it.name !== '.git') walk(path.join(dir, it.name), depth + 1); }
      else n++;
    }
  };
  walk(rootDir, 0);
  return n;
}

function registerRepo({ id, name, source, url, dir, skills }) {
  const record = {
    id, name, source, url: url || null, path: dir,
    files: countFiles(dir), skillsImported: skills.imported.length,
    skillErrors: skills.errors.length, importedAt: new Date().toISOString(),
  };
  writeJson(REPOS_FILE, [...repos(), record]);
  return { repo: record, imported: skills.imported, errors: skills.errors };
}

export function importRepoZip(b) {
  const { name, buf } = decodeUpload(b);
  if (!name.toLowerCase().endsWith('.zip')) throw fail('IMPORT_TYPE', 'Repo tải lên phải là file .zip.');
  const files = readZipEntries(buf);
  if (!files.length) throw fail('IMPORT_EMPTY', 'Zip repo rỗng.');
  const id = 'repo-' + crypto.randomUUID().slice(0, 8);
  const dir = path.join(REPOS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  try {
    for (const f of files) {
      const target = path.join(dir, f.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.data);
    }
  } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
  // Many repo zips wrap everything in one top folder — treat that as root.
  const top = fs.readdirSync(dir, { withFileTypes: true });
  const root = top.length === 1 && top[0].isDirectory() ? path.join(dir, top[0].name) : dir;
  const skills = scanAndImportSkills(root, name);
  return registerRepo({ id, name: name.replace(/\.zip$/i, ''), source: 'zip', dir, skills });
}

const gitRun = (args) => new Promise((resolve, reject) => {
  execFile('git', args, { timeout: 180000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      if (err.code === 'ENOENT') return reject(fail('GIT_MISSING', 'Máy chưa có Git. Cài Git bằng file INSTALL-CODE-TOOLS-WINDOWS.cmd trong thư mục ứng dụng, hoặc tải repo dạng .zip rồi nhập bằng file.'));
      return reject(fail('GIT_CLONE', 'Không clone được repo: ' + String(stderr || err.message).slice(0, 300)));
    }
    resolve(stdout);
  });
});

export async function importRepoGit(b) {
  const raw = String(b?.url || '').trim();
  let u;
  try { u = new URL(raw); } catch { throw fail('IMPORT_URL', 'Link repo không hợp lệ.'); }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname.includes('.'))
    throw fail('IMPORT_URL', 'Chỉ nhận link repo dạng https://… không chứa tài khoản/mật khẩu trong link.');
  const name = (u.pathname.split('/').filter(Boolean).pop() || 'repo').replace(/\.git$/i, '');
  const id = 'repo-' + crypto.randomUUID().slice(0, 8);
  const dir = path.join(REPOS_DIR, id);
  fs.mkdirSync(REPOS_DIR, { recursive: true });
  await gitRun(['clone', '--depth', '1', '--', u.toString(), dir]);
  const skills = scanAndImportSkills(dir, name);
  return registerRepo({ id, name, source: 'git', url: u.toString(), dir, skills });
}

export function deleteImportedRepo(id) {
  const all = repos();
  const rec = all.find((r) => r.id === id);
  if (!rec) throw fail('REPO_NOT_FOUND', 'Không tìm thấy repo đã nhập.');
  const dir = path.resolve(rec.path || '');
  if (dir.startsWith(path.resolve(REPOS_DIR) + path.sep)) fs.rmSync(dir, { recursive: true, force: true });
  writeJson(REPOS_FILE, all.filter((r) => r.id !== id));
  return { ok: true };
}
