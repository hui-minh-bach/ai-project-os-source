/** Shared, dependency-free display contract. Account status is not animation progress. */
export const FLEET_SCHEMA = 1;
export const STATE_LABELS = Object.freeze({
  ready:'S\u1eb5n s\u00e0ng', working:'\u0110ang l\u00e0m vi\u1ec7c', planning:'\u0110ang ph\u00e2n t\u00edch',
  reviewing:'\u0110ang ki\u1ec3m tra', rendering:'Đang làm việc · chờ engine', waiting:'Đang làm việc · chờ bước tiếp',
  completed:'V\u1eeba ho\u00e0n t\u1ea5t', error:'C\u1ea7n ki\u1ec3m tra l\u1ed7i', quota:'Ngh\u1ec9 h\u1ea1n m\u1ee9c',
  offline:'Ch\u01b0a k\u1ebft n\u1ed1i', unknown:'M\u1ea5t \u0111\u1ed3ng b\u1ed9'
});
export const ROLE_LABELS = Object.freeze({
  founder:'\u0110i\u1ec1u ph\u1ed1i', council:'H\u1ed9i \u0111\u1ed3ng', worker:'Th\u1ef1c thi',
  reviewer:'Ki\u1ec3m tra', unassigned:'Ch\u01b0a ph\u00e2n vai'
});
export const BUSY_STATES = new Set(['working','planning','reviewing','rendering']);
export const TYPING_STATES = new Set(['working','planning','reviewing']);
export const safeText = (value, max=160) => String(value ?? '').replace(/[\x00-\x1f\x7f]/g,'').slice(0,max);
export function normalizeFleetSnapshot(snapshot) {
  if (!snapshot || snapshot.schema !== FLEET_SCHEMA || snapshot.source !== 'live' || !Array.isArray(snapshot.bots)) throw new TypeError('Invalid live fleet snapshot');
  const seen=new Set(), bots=[];
  for(const raw of snapshot.bots){
    const id=safeText(raw?.connectionId);if(!id||seen.has(id))continue;seen.add(id);
    const state=Object.hasOwn(STATE_LABELS,raw.state)?raw.state:'unknown';
    const roles=Array.isArray(raw.roles)?raw.roles.filter(x=>Object.hasOwn(ROLE_LABELS,x)):[];
    const role=Object.hasOwn(ROLE_LABELS,raw.role)?raw.role:(roles[0]||'unassigned');
    const jobs=Array.isArray(raw.jobs)?raw.jobs.slice(0,12).map(j=>({
      id:safeText(j.id),projectId:safeText(j.projectId),title:safeText(j.title,200),projectName:safeText(j.projectName),
      role:safeText(j.role,40),phase:safeText(j.phase,50),source:safeText(j.source,50),model:safeText(j.model,120),state:safeText(j.state,40)
    })):[];
    bots.push({connectionId:id,name:safeText(raw.name||raw.label||raw.provider||'AI',100),provider:safeText(raw.provider,40),kind:safeText(raw.kind,40),
      color:/^#[\da-f]{6}$/i.test(raw.color)?raw.color:'#57e6ff',connected:raw.connected===true,state,role,roles,
      statusLabel:STATE_LABELS[state],activityLabel:safeText(raw.activityLabel||STATE_LABELS[state],180),jobs,
      coolingUntil:raw.coolingUntil&&Number.isFinite(Date.parse(raw.coolingUntil))?raw.coolingUntil:null,
      activeCalls:Math.max(0,Number(raw.activeCalls)||0),source:safeText(raw.source,40)});
  }
  return {schema:FLEET_SCHEMA,source:'live',generatedAt:String(snapshot.generatedAt||''),bots,
    unassignedRuns:Math.max(0,Number(snapshot.unassignedRuns)||0),simulatedRuns:Math.max(0,Number(snapshot.simulatedRuns)||0)};
}
