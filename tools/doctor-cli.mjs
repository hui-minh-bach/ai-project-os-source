import {systemDoctor} from '../src/lib/system-doctor.mjs';
const result=systemDoctor({smoke:true});
console.log('\nAI Project OS v0.8.0 - Local computer diagnostics');
for(const c of result.checks)console.log(`  [${c.status.toUpperCase()}] ${c.title}: ${c.description}`);
console.log('No paid provider API was called.');
if(result.count.fail){console.error(`Cannot pass local diagnostics: ${result.count.fail} failed.`);process.exitCode=1;}
