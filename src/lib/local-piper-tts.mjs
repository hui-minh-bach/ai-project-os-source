/** Piper is a separately installed offline speech engine. No external API calls.
 * The user supplies the executable and a licensed .onnx voice model; no model
 * or binary is redistributed by AI Project OS. */
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

function blocked(message){const e=new Error(message);e.code='BLOCKED_LOCAL_TTS';return e;}
const advice='Chưa cài Piper TTS local hoặc model .onnx. Cấu hình PIPER_CLI_PATH và PIPER_MODEL_PATH trên Windows, hoặc tạo giọng trong Concat rồi nạp WAV/MP3 tại Thay giọng thật. Không cần HeyGen API.';
let statusCache={key:null,at:0,value:null};
export function piperStatus(env=process.env){
 const cli=String(env.PIPER_CLI_PATH||'piper');
 const model=String(env.PIPER_MODEL_PATH||'');
 const key=cli+'\x00'+model+'\x00'+String(env.PIPER_CONFIG_PATH||'');
 if(statusCache.key===key&&Date.now()-statusCache.at<30000)return statusCache.value;
 let modelConfigured=false,cliConfigured=false;
 try{modelConfigured=!!model&&path.extname(model).toLowerCase()==='.onnx'&&fs.statSync(model).isFile();}catch{}
 try{const r=spawnSync(cli,['--help'],{encoding:'utf8',timeout:3500,windowsHide:true,maxBuffer:10000});cliConfigured=!r.error&&r.status!==null;}catch{}
 const value={ready:modelConfigured&&cliConfigured,cliConfigured,modelConfigured,voice:modelConfigured?path.basename(model,'.onnx'):null,source:'Piper TTS offline; separate licensed voice model',installHint:advice};
 statusCache={key,at:Date.now(),value};return value;
}
export function piperVoiceFor(requested,env=process.env){
 const status=piperStatus(env);
 if(!status.ready)return null;
 // A bare language tag ('vi', 'en', 'vi-VN') or an empty value means "use the
 // installed voice" — media storyboards label narration by language, not by
 // voice-model name. Anything else (an explicit voice name, a foreign
 // provider's voice ID) is returned unchanged so piperSynthesize's strict
 // guard still rejects IDs that are not the installed voice.
 if(requested===undefined||requested===null||String(requested).trim()===''||/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(String(requested).trim()))return status.voice;
 return String(requested);
}
export async function piperSynthesize({text,voice,rate=1,output,env=process.env,timeoutMs=180000}={}){
 const status=piperStatus(env);if(!status.ready)throw blocked(advice);
 if(typeof text!=='string'||!text.trim()||text.length>5000)throw blocked('Lời thoại phải có 1-5.000 ký tự.');
 if(typeof output!=='string'||!path.isAbsolute(output)||path.extname(output).toLowerCase()!=='.wav')throw blocked('Đường dẫn xuất WAV không hợp lệ.');
 const speed=Number(rate);if(!Number.isFinite(speed)||speed<.7||speed>1.5)throw blocked('Tốc độ giọng phải từ 0.7 đến 1.5.');
 if(voice&&voice!==status.voice)throw blocked('Piper chỉ dùng giọng đã cài trên máy: '+status.voice+'. Không nhập ID HeyGen vào giọng local.');
 const model=String(env.PIPER_MODEL_PATH),cli=String(env.PIPER_CLI_PATH||'piper');
 const args=['--model',model,'--output_file',output];
 const config=String(env.PIPER_CONFIG_PATH||'');
 if(config){if(!fs.existsSync(config)||!fs.statSync(config).isFile())throw blocked('Không tìm thấy cấu hình Piper');args.push('--config',config);}
 if(speed!==1)args.push('--length_scale',String(1/speed));
 fs.mkdirSync(path.dirname(output),{recursive:true,mode:0o700});
 try{
  await new Promise((resolve,reject)=>{
   const child=spawn(cli,args,{stdio:['pipe','ignore','pipe'],windowsHide:true});let settled=false,stderr='';
   const rejectOnce=e=>{if(!settled){settled=true;clearTimeout(timer);reject(e);}};
   const timer=setTimeout(()=>{child.kill();rejectOnce(blocked('Piper quá thời gian xử lý; kiểm tra model local.'));},Math.max(1000,Math.min(600000,timeoutMs)));
   child.once('error',e=>rejectOnce(blocked('Không mở được Piper local: '+e.message)));
   child.stderr.on('data',chunk=>{if(stderr.length<1500)stderr+=String(chunk).slice(0,1500);});
   child.once('close',code=>{if(code!==0)rejectOnce(blocked('Piper không tạo được WAV (mã '+code+'): '+stderr.slice(0,220)));else if(!settled){settled=true;clearTimeout(timer);resolve();}});
   child.stdin.on('error',()=>{});child.stdin.end(text.trim()+'\n');
  });
  const stat=fs.statSync(output);if(!stat.isFile()||stat.size<44)throw blocked('Piper không xuất âm thanh WAV hợp lệ.');
  const head=Buffer.alloc(12);const fd=fs.openSync(output,'r');try{fs.readSync(fd,head,0,12,0);}finally{fs.closeSync(fd);}
  if(head.toString('ascii',0,4)!=='RIFF'||head.toString('ascii',8,12)!=='WAVE')throw blocked('Đầu ra Piper không phải WAV.');
  return {audioPath:output,provider:'piper-local',voice:status.voice,wordTimestamps:[],providerRequestId:null,voiceQuality:'LOCAL_MODEL_DEPENDENT'};
 }catch(error){fs.rmSync(output,{force:true});throw error;}
}
