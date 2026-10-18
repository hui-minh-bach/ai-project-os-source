/** Offline Whisper.cpp speech-to-text. Requires a user-installed binary AND a
 * model; never downloads models or pretends transcript is AI-generated. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {run}=require('../../integrations/media-engine/src/utils.cjs');
const subs=require('../../integrations/media-engine/src/subtitles.cjs');
function blocked(){const e=new Error('Chưa cài whisper-cli hoặc model Whisper local. Cấu hình WHISPER_CLI_PATH và WHISPER_MODEL_PATH, hoặc bỏ tùy chọn phụ đề tự động.');e.code='BLOCKED_STT';return e;}
export function whisperStatus(env=process.env){
 const cli=String(env.WHISPER_CLI_PATH||'whisper-cli'),model=String(env.WHISPER_MODEL_PATH||'');
 const modelReady=Boolean(model&&fs.existsSync(model)&&fs.statSync(model).isFile());
 const probe=spawnSync(cli,['--help'],{timeout:3500,encoding:'utf8',windowsHide:true,maxBuffer:262144});
 const cliReady=!probe.error;
 return {ready:modelReady&&cliReady,modelConfigured:modelReady,cliConfigured:cliReady,source:'whisper.cpp installed separately'};
}
export async function transcribeLocal({audio,outputRoot,language='vi',env=process.env}={}){
 const model=String(env.WHISPER_MODEL_PATH||'');const cli=String(env.WHISPER_CLI_PATH||'whisper-cli');
 if(!model||!fs.existsSync(model)||!fs.statSync(model).isFile())throw blocked();
 if(!audio||!fs.existsSync(audio))throw blocked();
 fs.mkdirSync(outputRoot,{recursive:true,mode:0o700});
 const stem=path.join(outputRoot,'whisper-'+crypto.randomUUID());
 try{
  await run(cli,['-m',model,'-f',audio,'-l',language,'-osrt','-of',stem],{timeoutMs:900000});
 }catch(e){const problem=new Error('Whisper CLI không tạo được phụ đề: '+String(e.message||'').slice(0,240));problem.code='BLOCKED_STT';throw problem;}
 const file=stem+'.srt';if(!fs.existsSync(file))throw blocked();
 const segments=subs.parseSrt(fs.readFileSync(file,'utf8'));
 if(segments.length===0)throw blocked();
 return {segments,source:'whisper.cpp offline confirmed from real audio'};
}
