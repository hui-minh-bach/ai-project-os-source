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

/**
 * Clip-name preference per office state for the TAM-19 body — mirrors the
 * table used by officeAttachTam in public/tabs/team.js (kept in sync; the
 * unit tests pin this copy). P16 (0.9.50) added standing-desk work clips:
 * WorkCycle is the preferred work clip, ahead of the seated-era
 * InspectTablet/Type_Keyboard/Review_Document fallbacks. There is still no
 * Reject clip — fail falls back to Idle, never to an invented animation.
 */
export const OFFICE_CLIP_PREFS = {
  idle: ['Idle', 'Idle_Breathe'],
  work: ['WorkCycle', 'Typing', 'Mouse', 'TabletTouch', 'InspectTablet', 'Type_Keyboard', 'Review_Document'],
  walk: ['Walk', 'Walk_Forward', 'Walk_Fast'],
  cheer: ['Approve', 'Wave_Hello', 'Greeting'],
  fail: ['Reject', 'Idle'],
};

/**
 * Work clips during which the P16 robot stands at its own built-in desk:
 * the renderer must NOT apply the legacy seated bend or the body drop.
 * InspectTablet keeps the legacy seated path.
 */
export const OFFICE_STANDING_WORK_CLIPS = ['WorkCycle', 'Typing', 'Mouse', 'TabletTouch'];

/** Resolve the clip name for `wanted`: preference list first, then officeFindClip. */
export function officeResolveClip(clipNames, wanted) {
  const names = Array.isArray(clipNames) ? clipNames : [];
  for (const n of OFFICE_CLIP_PREFS[wanted] || []) {
    const hit = names.find((x) => x === n);
    if (hit) return hit;
  }
  return officeFindClip(names, wanted);
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
