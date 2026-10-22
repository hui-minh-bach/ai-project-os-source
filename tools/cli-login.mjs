import { spawn } from 'node:child_process';
import { resolveCli, cliRuntime, cliRuntimeForHome } from '../src/lib/managed-cli.mjs';
const kind=process.argv[2];
if(!['claude','gemini'].includes(kind)){console.error('Only Claude/Gemini interactive login supported here.');process.exit(2);}
try{
 // Per-connection profile (v0.9.56): when the app opens this window for a
 // specific connection it passes that connection's own profile folder in
 // AIOS_CLI_PROFILE_DIR (plus the account name for the banner). Without
 // it — e.g. the .cmd run by hand — the legacy per-kind profile is used.
 const profileDir=process.env.AIOS_CLI_PROFILE_DIR||'';
 const accountName=process.env.AIOS_CLI_ACCOUNT_NAME||'';
 const bin=resolveCli(kind),{cwd,env}=profileDir?cliRuntimeForHome(profileDir):cliRuntime(kind);
 console.log(`Official ${kind} account sign-in${accountName?` for account "${accountName}"`:''}. Complete the browser login on your computer.`);
 console.log('Credentials stay in the local CLI profile. Do not paste credentials into the AI Project OS browser.');
 const child=spawn(bin.command,[...bin.args,...(kind==='claude'?['auth','login']:[])],{cwd,env,stdio:'inherit',shell:false,windowsHide:false});
 child.on('error',()=>{console.error('Cannot start official CLI. Install it first.');process.exitCode=1;});
 child.on('exit',code=>{process.exitCode=code??1;});
}catch(e){console.error(e.message);process.exitCode=1;}
