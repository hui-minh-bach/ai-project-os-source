'use strict';
// DEMO ONLY: espeak's Vietnamese voice is intelligible on some systems but robotic.
// Do not describe this as production-quality natural Vietnamese TTS.
const {run,insist}=require('../src/utils.cjs');
function demoGateway({exe='espeak'}={}){
 return {async invoke({capability,input}){
  if(capability==='speech.synthesize'){
   insist(String(input.language).startsWith('vi'),'Demo voice supports Vietnamese only');
   insist(!input.emotion||input.emotion==='neutral','eSpeak demo has no tested expressive Vietnamese styles','BLOCKED_TTS_STYLE');
   await run(exe,['-v',String(input.voice||'vi'),'-s',String(Math.round(140*(input.rate||1))),'-a',String(Math.round(100*(input.volume||1))),'-w',input.output,input.text],{timeoutMs:180000});
   return {audioPath:input.output,voiceQuality:'DEMO_ROBOTIC_NOT_ACCEPTED_AS_NATURAL'};
  }
  throw Object.assign(new Error(`Demo gateway does not implement ${capability}`),{code:'BLOCKED_PROVIDER'});
 }};
}
module.exports={demoGateway};
