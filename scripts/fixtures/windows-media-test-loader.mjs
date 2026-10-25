/** TEST ONLY. Replaces the OS boundary, not the app workflow. Never loaded by launcher. */
import os from 'node:os';import path from 'node:path';
export async function load(url,context,nextLoad){
 if(url.endsWith('/src/lib/windows-speech.mjs')){
  if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('Test boundary requires isolated temp data');
  return {format:'module',shortCircuit:true,source:`
   import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
   export {selectSpeechVoice,inspectWave} from ${JSON.stringify(url+'?native-contract')};
   export function windowsSpeechStatus(){return {ready:true,voiceId:'winrt:fixture-vi',voice:'Fixture voice - eSpeak, NOT Windows',provider:'windows-system',voices:[{id:'winrt:fixture-vi',name:'Fixture voice - eSpeak, NOT Windows',culture:'vi-VN',enabled:true,engine:'winrt'}]};}
   export async function windowsSpeechSynthesize(q){const root=process.env.AI_PROJECT_OS_DATA_DIR;const out=path.resolve(q.output);if(!out.startsWith(path.resolve(root)+path.sep))throw Error('Test voice output outside isolation');fs.mkdirSync(path.dirname(out),{recursive:true});execFileSync('espeak',['-v','vi','-s','170','-w',out,'--stdin'],{input:q.text,timeout:30000});fs.appendFileSync(path.join(root,'qa-speech.jsonl'),JSON.stringify({voice:q.voice,chars:q.text.length})+'\\n');return {audioPath:out,provider:'TEST-BOUNDARY-eSpeak-NOT-WINDOWS',voice:'winrt:fixture-vi',wordTimestamps:[]};}
  `};
 }
 return nextLoad(url,context);
}
