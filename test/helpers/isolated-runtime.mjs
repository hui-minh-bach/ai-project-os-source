import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// store.mjs deliberately anchors runtime data to its source tree. Copy the
// source under a unique test-owned root instead of changing production storage
// semantics or moving/deleting an existing installation's .data and backups.
export function isolatedRuntime(label) {
  const repository = fileURLToPath(new URL('../../', import.meta.url));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `aipos-${label}-`));
  try {
    fs.cpSync(path.join(repository, 'src'), path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'test/helpers'), { recursive: true });
    fs.copyFileSync(path.join(repository, 'test/helpers/council-fixtures.mjs'), path.join(root, 'test/helpers/council-fixtures.mjs'));
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
  return {
    root,
    import(relative) { return import(pathToFileURL(path.join(root, relative)).href); },
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
  };
}
