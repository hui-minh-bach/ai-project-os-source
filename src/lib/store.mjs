import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { personalDataDir } from './app-identity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATA_DIR = personalDataDir();
if (DATA_DIR === path.join(ROOT, '.data')) throw new Error('Không mở dữ liệu bản gốc tại .data; hãy nhập bản sao lưu vào thư mục Personal riêng.');
const backupOverride = process.env.AI_PROJECT_OS_PERSONAL_BACKUP_DIR || process.env.AI_PROJECT_OS_BACKUP_DIR;
export const BACKUP_DIR = backupOverride
  ? path.resolve(backupOverride)
  : path.join(path.dirname(DATA_DIR), 'backups');

if (BACKUP_DIR.split(/[\\/]/).some(p => p.toLowerCase() === 'aiprojectoslocal')) throw new Error('Không ghi backup vào thư mục bản gốc.');

fs.mkdirSync(DATA_DIR, { recursive: true });

function syncDir(dir) {
  try {
    const fd = fs.openSync(dir, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch {}
}

export function atomicWriteText(filePath, text, { mode = 0o600, backup = true } = {}) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const bak = `${filePath}.bak`;
  let fd;
  try {
    fd = fs.openSync(tmp, 'w', mode);
    fs.writeFileSync(fd, String(text), 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, filePath);
    try { fs.chmodSync(filePath, mode); } catch {}
    syncDir(dir);
    if (backup) {
      // Keep a second atomic copy of the latest valid generation. A crash before
      // rename leaves the old primary intact; a crash after rename still has a
      // valid primary, and the backup refresh is best-effort but atomic itself.
      try { atomicWriteText(bak, text, { mode, backup: false }); } catch {}
    }
  } finally {
    try { if (fd !== undefined) fs.closeSync(fd); } catch {}
    try { if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true }); } catch {}
  }
}

function parseJsonFile(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function readJson(name, fallback) {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) return structuredClone(fallback);
  try { return parseJsonFile(p); }
  catch (primaryError) {
    const bak = `${p}.bak`;
    if (fs.existsSync(bak)) {
      try {
        const recovered = parseJsonFile(bak);
        atomicWriteText(p, JSON.stringify(recovered, null, 2), { backup: false });
        return recovered;
      } catch {}
    }
    const err = new Error(`Dữ liệu ${name} bị hỏng và không thể phục hồi từ bản backup.`);
    err.cause = primaryError;
    throw err;
  }
}

export function writeJson(name, value) {
  const p = path.join(DATA_DIR, name);
  atomicWriteText(p, JSON.stringify(value, null, 2));
}

export function rootDir() { return ROOT; }
