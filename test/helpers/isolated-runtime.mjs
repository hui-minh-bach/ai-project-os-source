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
    fs.cpSync(path.join(repository, 'test/helpers'), path.join(root, 'test/helpers'), { recursive: true });
  } catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
  return {
    root,
    async import(relative) {
      const previous = process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR;
      process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR = path.join(root, '.personal-test-data');
      try { return await import(pathToFileURL(path.join(root, relative)).href); }
      finally { if (previous === undefined) delete process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR; else process.env.AI_PROJECT_OS_PERSONAL_DATA_DIR = previous; }
    },
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
  };
}
