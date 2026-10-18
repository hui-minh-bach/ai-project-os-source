/** Publish records: one entry per confirmed platform post, kept in the app
 * data dir so the Publish tab and the metrics sweep can find every post
 * across projects. A record is only created AFTER a platform API confirms
 * the upload — never on intent. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function createPublishRecords({ file }) {
  function load() {
    try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; }
  }
  function save(rows) {
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    const tmp = file + '.tmp-' + crypto.randomUUID();
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  return {
    append(record) {
      const rows = load();
      const row = { id: crypto.randomUUID(), ...record };
      rows.push(row);
      save(rows);
      return row;
    },
    list({ projectId } = {}) {
      const rows = load();
      return projectId ? rows.filter(r => r.projectId === projectId) : rows;
    },
    get(id) { return load().find(r => r.id === id) || null; },
    update(id, patch) {
      const rows = load();
      const i = rows.findIndex(r => r.id === id);
      if (i < 0) return null;
      rows[i] = { ...rows[i], ...patch };
      save(rows);
      return rows[i];
    },
  };
}
