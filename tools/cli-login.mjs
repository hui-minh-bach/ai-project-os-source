import { spawn } from 'node:child_process';
import { resolveCli, cliRuntime } from '../src/lib/managed-cli.mjs';
const kind=process.argv[2];
if(!['claude','gemini'].includes(kind)){console.error('Only Claude/Gemini interactive login supported here.');process.exit(2);}
try{
 const bin=resolveCli(kind),{cwd,env}=cliRuntime(kind);
 console.log(`Official ${kind} account sign-in. Complete the browser login on your computer.`);
 console.log('Credentials stay in the local CLI profile. Do not paste credentials into the AI Project OS browser.');
 const child=spawn(bin.command,[...bin.args,...(kind==='claude'?['auth','login']:[])],{cwd,env,stdio:'inherit',shell:false,windowsHide:false});
 child.on('error',()=>{console.error('Cannot start official CLI. Install it first.');process.exitCode=1;});
 child.on('exit',code=>{process.exitCode=code??1;});
}catch(e){console.error(e.message);process.exitCode=1;}
