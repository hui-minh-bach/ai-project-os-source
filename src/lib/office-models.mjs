/**
 * Office 3D models (0.9.31): user-supplied GLB character models for the AI
 * office, built by an external designer to the owner's technical brief.
 * One file per cast member: <castId>.glb under DATA_DIR/office-models.
 * The app never generates these files; it only stores, lists and serves
 * them, and the Team tab swaps a model in for the procedural robot.
 */
import fs from 'node:fs';
import path from 'node:path';

export const OFFICE_MODEL_IDS = ['boss', 'pm', 'news', 'script', 'image', 'media', 'review', 'publish'];
export const OFFICE_MODEL_MAX_BYTES = 60 * 1024 * 1024;

function fail(code, message) { const e = new Error(message); e.code = code; return e; }

export function officeModelsDir(dataDir) { return path.join(String(dataDir || ''), 'office-models'); }

function modelFile(dataDir, id) {
  if (!OFFICE_MODEL_IDS.includes(id)) throw fail('OFFICE_MODEL_ID', 'Nhân vật không hợp lệ cho model 3D.');
  return path.join(officeModelsDir(dataDir), id + '.glb');
}

export function isGlbBuffer(buf) {
  return Buffer.isBuffer(buf) && buf.length >= 12 && buf.toString('latin1', 0, 4) === 'glTF';
}

export function listOfficeModels(dataDir) {
  const dir = officeModelsDir(dataDir);
  const out = [];
  for (const id of OFFICE_MODEL_IDS) {
    const file = path.join(dir, id + '.glb');
    try {
      const st = fs.statSync(file);
      if (st.isFile()) out.push({ id, bytes: st.size, updatedAt: st.mtime.toISOString() });
    } catch { /* not present */ }
  }
  return out;
}

export function saveOfficeModel(dataDir, id, buf) {
  const file = modelFile(dataDir, id);
  if (!isGlbBuffer(buf)) throw fail('OFFICE_MODEL_FORMAT', 'File không phải GLB hợp lệ (thiếu chữ ký glTF).');
  if (buf.length > OFFICE_MODEL_MAX_BYTES) throw fail('OFFICE_MODEL_SIZE', 'Model vượt quá 60MB.');
  fs.mkdirSync(officeModelsDir(dataDir), { recursive: true, mode: 0o700 });
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, buf, { mode: 0o600 });
  fs.renameSync(tmp, file);
  const st = fs.statSync(file);
  return { id, bytes: st.size, updatedAt: st.mtime.toISOString() };
}

export function deleteOfficeModel(dataDir, id) {
  const file = modelFile(dataDir, id);
  try { fs.unlinkSync(file); return { id, removed: true }; }
  catch { return { id, removed: false }; }
}

export function officeModelPath(dataDir, id) {
  const file = modelFile(dataDir, id);
  return fs.existsSync(file) ? file : null;
}
