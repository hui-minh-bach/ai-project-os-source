/** Optional, process-local observation of actual routed provider calls.
 * No credentials, prompts, responses or raw errors enter this store.
 * Observation must never change a provider's return value, error or routing.
 */
import crypto from 'node:crypto';
const calls = new Map();
const clean = (value, max = 160) => String(value ?? '').replace(/[\x00-\x1f\x7f]/g, '').slice(0, max);
const RETAIN_MS = 5 * 60 * 1000;
function prune(now) {
  for (const [id, call] of calls) if (call.endedAtMs && now - call.endedAtMs > RETAIN_MS) calls.delete(id);
  const ended = [...calls.values()].filter(x => x.endedAtMs).sort((a,b) => b.endedAtMs-a.endedAtMs);
  for (const call of ended.slice(100)) calls.delete(call.id);
}
export async function observeSpaceCall(connection, invoke) {
  let id;
  try {
    const now = Date.now(); prune(now); id = crypto.randomUUID();
    const context = connection?.usageContext || {};
    calls.set(id, { id, connectionId: clean(connection?.id), model: clean(connection?.model),
      projectId: clean(context.projectId), taskId: clean(context.taskId), role: clean(context.role, 40),
      state: 'running', startedAtMs: now, endedAtMs: null });
  } catch { /* Observability is never a gate for existing execution. */ }
  try {
    const result = await invoke();
    try { const call=calls.get(id); if(call)Object.assign(call,{state:'completed',endedAtMs:Date.now()}); } catch {}
    return result;
  } catch (error) {
    try { const call=calls.get(id); if(call)Object.assign(call,{state:'failed',endedAtMs:Date.now()}); } catch {}
    throw error;
  }
}
export function spaceActivitySnapshot(nowMs = Date.now()) {
  prune(nowMs);
  return [...calls.values()].map(c => ({ ...c }));
}
