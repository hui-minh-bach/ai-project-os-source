/** Installed Windows SAPI + OneCore/WinRT voices, exported to a real WAV.
 * No browser speech capture, no paid API, no registry copy, no Piper dependency. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const fail=message=>Object.assign(new Error(message),{code:'BLOCKED_WINDOWS_TTS'});
const scriptFile=fileURLToPath(new URL('../../scripts/windows-speech.ps1',import.meta.url));
let cache={at:0,value:null};
const exe=(env=process.env)=>path.win32.join(env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
const args=()=>['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(fs.readFileSync(scriptFile,'utf8'),'utf16le').toString('base64')];
export function selectSpeechVoice(voices,language='vi',selected=null){
 const lang=String(language||'vi').split('-')[0].toLowerCase();
 const eligible=(Array.isArray(voices)?voices:[voices]).filter(v=>v&&v.enabled!==false&&String(v.culture||'').toLowerCase().split('-')[0]===lang);
 if(selected&&![lang,language,'auto','default'].includes(selected))return eligible.find(v=>v.id===selected||v.name===selected)||null;
 return eligible.find(v=>v.engine==='winrt')||eligible[0]||null;
}
export function windowsSpeechStatus({platform=process.platform,run=spawnSync,now=Date.now(),refresh=false,env=process.env}={}){
 if(platform!=='win32')return {ready:false,voices:[],provider:'windows-system',reason:'not-windows'};
 if(!refresh&&run===spawnSync&&cache.value&&now-cache.at<60000)return cache.value;
 let value;
 try{
  const p=run(exe(env),args(),{input:JSON.stringify({mode:'probe'}),encoding:'utf8',timeout:12000,maxBuffer:128000,windowsHide:true});
  if(p.status!==0||p.error)throw fail('voice-probe-failed');
  const parsed=JSON.parse(String(p.stdout).replace(/^\uFEFF/,'').trim());
  const voices=(Array.isArray(parsed)?parsed:[parsed]).filter(v=>v?.name&&v?.culture).map(v=>({id:String(v.id||'sapi:'+v.name).slice(0,512),name:String(v.name).slice(0,120),culture:String(v.culture).slice(0,20),enabled:v.enabled!==false,engine:v.engine==='winrt'?'winrt':'sapi'}));
  const voice=selectSpeechVoice(voices);
  value={ready:!!voice,provider:'windows-system',voice:voice?.name||null,voiceId:voice?.id||null,voices,reason:voice?null:'no-installed-vietnamese-voice',settingsUri:'ms-settings:speech',message:voice?'Windows voice ready.':'Windows has no installed Vietnamese voice exposed to SAPI/WinRT. Add a Vietnamese speech voice in Windows Settings, then refresh. No alternate language is silently used.'};
 }catch{value={ready:false,provider:'windows-system',voices:[],reason:'windows-speech-unavailable',settingsUri:'ms-settings:speech'};}
 if(run===spawnSync)cache={at:now,value};return value;
}
export function inspectWave(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw fail('Windows speech produced invalid WAV.');
 let data=0,format=false;
 for(let p=12;p+8<=bytes.length;){const n=bytes.readUInt32LE(p+4),tag=bytes.toString('ascii',p,p+4);if(p+8+n>bytes.length)throw fail('Incomplete Windows WAV.');if(tag==='fmt '&&n>=16)format=true;if(tag==='data')data+=n;p+=8+n+(n%2);}
 if(!format||data<32)throw fail('Windows speech returned no audio samples.');
 return {dataBytes:data};
}
export async function windowsSpeechSynthesize({text,output,language='vi',voice:selected,rate=1,volume=1,statusProvider=windowsSpeechStatus,spawnImpl=spawn}={}){
 const status=statusProvider(),voice=selectSpeechVoice(status.voices,language,selected);
 if(!voice)throw fail('Khong tim thay giong Windows dung ngon ngu/ten da chon. Mo Windows Settings > Speech de them giong roi bam Kiem tra lai. Khong can Piper hay HeyGen.');
 if(typeof text!=='string'||!text.trim()||text.length>5000||!path.isAbsolute(output||'')||path.extname(output).toLowerCase()!=='.wav')throw fail('Invalid speech input/output.');
 if(!Number.isFinite(rate)||rate<.65||rate>1.5||!Number.isFinite(volume)||volume<.1||volume>1)throw fail('Invalid speech rate/volume.');
 fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
 const partial=output+'.'+crypto.randomUUID()+'.partial.wav';
 try{
  await new Promise((resolve,reject)=>{
   let done=false;let timer;const finish=e=>{if(done)return;done=true;clearTimeout(timer);e?reject(e):resolve();};
   const child=spawnImpl(exe(),args(),{stdio:['pipe','ignore','pipe'],windowsHide:true});
   timer=setTimeout(()=>{child.kill();finish(fail('Windows speech timed out; no audio substituted.'));},180000);
   child.stderr?.on('data',()=>{}); // Do not leak user text/path via engine diagnostics.
   child.once('error',()=>finish(fail('Cannot start Windows speech. Check PowerShell and installed Windows voices.')));
   child.once('close',code=>finish(code===0?null:fail('Windows speech failed. The chosen voice may be unavailable; refresh voices before retrying.')));
   child.stdin.on('error',()=>{});
   child.stdin.end(JSON.stringify({mode:'synthesize',text,output:partial,voiceId:voice.id||'sapi:'+voice.name,rate,volume}));
  });
  inspectWave(fs.readFileSync(partial));fs.renameSync(partial,output);
  return {audioPath:output,provider:voice.engine==='winrt'?'windows-winrt':'windows-sapi',voice:voice.name,voiceId:voice.id,wordTimestamps:[],providerRequestId:null,voiceQuality:'INSTALLED_SYSTEM_VOICE'};
 }catch(e){fs.rmSync(partial,{force:true});throw e;}
}
