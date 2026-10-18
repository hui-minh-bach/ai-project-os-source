/** Machine-readable, fail-closed gate. Never equate Linux fixtures with Windows/provider signoff. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const APP=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function assessCommercialRelease({release,attestations={}}={}){
  if(!release||typeof release!=='object')throw Error('Missing validated release manifest');
  const gates=[
    ['W01-W02','Windows 10/11 clean install + standard-user restart',release.windows?.windows_hardware_verified===true&&attestations.windowsClean===true],
    ['W03-W04','Upgrade, rollback, Vault and encrypted restore verified on Windows',attestations.upgradeRollback===true],
    ['A02-A03','Real provider accounts, billing, 401/429 and accurate quota',release.integration?.authorized_provider_e2e===true&&attestations.liveProviders===true],
    ['A04-A05','Concurrent workers, safe sandbox and no unauthorized paid actions',release.features?.ai_core_strict_cost_gate==='enforced_with_one_use_ui_consent'&&attestations.coreApprovalE2E===true],
    ['M01-M03','30 real Windows video renders, verified audio/captions, diverse media',attestations.realWindowsMedia===true],
    ['M04-M06','Concat/Whisper/TTS claims verified live or disabled in shipped UI',attestations.optionalMediaTruth===true],
    ['P01-P03','Website Preview and content outputs verified with authorized services',attestations.productionWorkflows===true],
    ['U01','10 tabs x 5 themes, both viewports on Windows with accessibility',attestations.windowsUiAudit===true],
    ['S01','Signed installer & signed auto-update rollback',release.windows?.signed===true&&String(release.features?.auto_update||'').startsWith('implemented')&&attestations.signatureAndUpdate===true],
    ['S02','>=5 pilot users, >=7 days, zero open P0/P1 incidents',attestations.pilot===true],
  ];
  const checked=gates.map(([id,name,verified])=>({id,name,status:verified?'passed_with_attestation':'blocked_missing_evidence'}));
  return {version:release.version,commercialReady:checked.every(g=>g.status==='passed_with_attestation')&&release.features?.commercial_ready===true,checked,blocked:checked.filter(g=>g.status!=='passed_with_attestation').map(g=>g.id),purpose:'internal QA only; not independent proof of test execution'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const release=JSON.parse(fs.readFileSync(path.join(APP,'RELEASE.json'),'utf8'));
  const result=assessCommercialRelease({release});
  console.log(JSON.stringify(result,null,2));
  if(process.argv.includes('--enforce')&&!result.commercialReady)process.exitCode=2;
}
