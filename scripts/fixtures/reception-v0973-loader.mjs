/** TEST ONLY: reuses stored QA audio; never claims Windows or new speech inference. */
import os from 'node:os';import path from 'node:path';
export async function load(url,context,next){
 if(url.endsWith('/src/lib/windows-speech.mjs')){
  if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('QA requires isolated temp data');
  const audio=new URL('../../evidence/v0972/real-piper-local-worker.mp4',import.meta.url).pathname;
  return {format:'module',shortCircuit:true,source:`import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';export {selectSpeechVoice,inspectWave} from ${JSON.stringify(url+'?native')};export function windowsSpeechStatus(){return {ready:true,voices:[{id:'fixture-voice',name:'Stored QA speech fixture',culture:'vi-VN',engine:'sapi',enabled:true}],voiceId:'fixture-voice'};}export async function windowsSpeechSynthesize(q){if(!path.resolve(q.output).startsWith(path.resolve(process.env.AI_PROJECT_OS_DATA_DIR)+path.sep))throw Error('Fixture output escape');fs.mkdirSync(path.dirname(q.output),{recursive:true});execFileSync('ffmpeg',['-v','error','-y','-i',${JSON.stringify(audio)},'-vn','-c:a','pcm_s16le',q.output]);return {audioPath:q.output,provider:'STORED-QA-AUDIO-NOT-WINDOWS',voice:'fixture-voice',wordTimestamps:[]};}`};
 }
 return next(url,context);
}
