/**
 * Office GLB clip logic (0.9.31) — pure helpers shared by the Team tab and
 * the unit tests. The external character models carry baked clips named in
 * the owner's brief: idle / work / walk / cheer / fail. The office state
 * machine (real app state, never a canned timeline) decides which clip a
 * model plays:
 *   zapped in the electric cage -> fail
 *   walking between stations    -> walk
 *   just finished a run         -> cheer (one-shot, handled by the caller)
 *   busy at a station           -> work
 *   anything else (incl. charging in a pod) -> idle
 */
export const OFFICE_CLIPS = ['idle', 'work', 'walk', 'cheer', 'fail'];

export function officeClipFor({ walking = false, faceMode = 'idle', cheer = false } = {}) {
  if (faceMode === 'zap') return 'fail';
  if (walking) return 'walk';
  if (cheer) return 'cheer';
  if (faceMode === 'work') return 'work';
  return 'idle';
}

/** Normalize a baked clip name for matching: lowercase, strip rig prefixes. */
export function officeClipKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^.*[|_]/, '')
    .replace(/[^a-z]/g, '');
}

/** Find the best clip for `wanted` among available clip names. */
export function officeFindClip(clipNames, wanted) {
  const names = Array.isArray(clipNames) ? clipNames : [];
  const w = officeClipKey(wanted);
  for (const n of names) if (officeClipKey(n) === w) return n;
  // Common synonyms used by modelers.
  const syn = { work: ['working', 'type', 'typing', 'keyboard', 'document', 'review'], walk: ['walking', 'run', 'running', 'forward'], idle: ['stand', 'standing', 'breath', 'breathing', 'breathe'], cheer: ['celebrate', 'win', 'happy', 'wave', 'approve', 'hello'], fail: ['shock', 'shocked', 'electrocuted', 'hit', 'reject'] };
  for (const alt of syn[w] || []) for (const n of names) if (officeClipKey(n) === alt) return n;
  return null;
}
