// Tests must never use an installed edition's per-user data or credentials.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aios-personal-tests-')));
const env = { ...process.env, AI_PROJECT_OS_DATA_DIR: path.join(root, 'data'),
  AI_PROJECT_OS_BACKUP_DIR: path.join(root, 'backups'), AI_PROJECT_OS_NO_BROWSER: '1', TMPDIR: root, TMP: root, TEMP: root };
delete env.AI_PROJECT_OS_PERSONAL_DATA_DIR;
delete env.AI_PROJECT_OS_PERSONAL_BACKUP_DIR;
const child = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-timeout=120000', ...process.argv.slice(2)], { env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); fs.rmSync(root, { recursive: true, force: true }); process.exitCode = 1; });
child.on('exit', (code, signal) => { fs.rmSync(root, { recursive: true, force: true }); process.exitCode = code ?? (signal ? 1 : 0); });
