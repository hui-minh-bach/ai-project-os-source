import { installManagedCli } from '../src/lib/managed-cli.mjs';
const kind=process.argv[2];
if(!['codex','claude','gemini','all'].includes(kind)){console.error('Usage: install-ai-clis.mjs codex|claude|gemini|all');process.exit(2);}
for(const name of kind==='all'?['codex','claude']:[kind]){
 console.log(`Installing official ${name} CLI for this Windows user...`);
 try{const r=await installManagedCli(name);console.log(r.message);}catch(e){console.error(e.message);process.exitCode=1;break;}
}
