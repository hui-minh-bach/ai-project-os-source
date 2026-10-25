import os from 'node:os';
import path from 'node:path';

// Runtime identity. Release metadata and package.json are checked against this
// module by the foundation tests; the Go launcher reads RELEASE.json directly.
export const APP_ID = 'ai-project-os-personal';
export const APP_NAME = 'AI Project OS — Personal Edition';
export const APP_VERSION = '0.9.63-personal.1';
export const DATA_NAMESPACE = 'AIProjectOSPersonal';
export const SESSION_COOKIE = 'aios_personal_session';

export function personalDataDir({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  // The legacy override remains an explicit override for scripts/test fixtures.
  const override = env.AI_PROJECT_OS_PERSONAL_DATA_DIR || env.AI_PROJECT_OS_DATA_DIR;
  if (override) {
    if (!paths.isAbsolute(override)) throw new Error('AI_PROJECT_OS_DATA_DIR must be an absolute path.');
    if (override.split(/[\\/]/).some(p => p.toLowerCase() === 'aiprojectoslocal'))
      throw new Error('Không dùng thư mục của bản gốc. Hãy nhập bản sao lưu vào dữ liệu Personal riêng.');
    return paths.resolve(override);
  }
  if (platform === 'win32') return paths.join(env.LOCALAPPDATA || paths.join(home, 'AppData', 'Local'), DATA_NAMESPACE, 'data');
  if (platform === 'darwin') return paths.join(home, 'Library', 'Application Support', DATA_NAMESPACE, 'data');
  const base = env.XDG_DATA_HOME && paths.isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : paths.join(home, '.local', 'share');
  return paths.join(base, DATA_NAMESPACE, 'data');
}
