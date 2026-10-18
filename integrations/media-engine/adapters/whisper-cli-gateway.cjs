'use strict';
// A sample ProviderGateway implementation owned by the HOST, not a direct Media Engine model call.
// Requires whisper.cpp whisper-cli and a model the user downloaded and approved.
const {fs,path,run,insist}=require('../src/utils.cjs');
const subtitles=require('../src/subtitles.cjs');
function whisperGateway({exe='whisper-cli',model,outputRoot,timeoutMs=180000}={}){
 insist(model&&fs.existsSync(model),'Configure and install a real Whisper model explicitly','BLOCKED_STT');
 insist(outputRoot,'Output root required');
 fs.mkdirSync(outputRoot,{recursive:true});
 return {async invoke({capability,input}){
  insist(capability==='speech.transcribe','This gateway supports transcription only','BLOCKED_PROVIDER');
  insist(fs.existsSync(input.audio),'Audio missing','INVALID');
  const stem=path.join(outputRoot,`whisper-${require('node:crypto').randomBytes(8).toString('hex')}`);
  await run(exe,['-m',model,'-f',input.audio,'-l',input.language||'vi','-osrt','-of',stem],{timeoutMs});
  const srt=stem+'.srt';insist(fs.existsSync(srt),'Whisper produced no SRT','BLOCKED_STT');
  const parsed=subtitles.parseSrt(fs.readFileSync(srt,'utf8'));return {segments:parsed,model,source:'whisper.cpp actual ASR'};
 }};
}
module.exports={whisperGateway};
