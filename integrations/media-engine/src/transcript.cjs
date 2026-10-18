'use strict';
const {insist}=require('./utils.cjs');
const subs=require('./subtitles.cjs');
async function transcribe({gateway,audio,language='vi',model='whisper'}){
 insist(gateway&&typeof gateway.invoke==='function','ProviderGateway.invoke required','BLOCKED_PROVIDER');
 const response=await gateway.invoke({capability:'speech.transcribe',model,input:{audio,language},consentRequired:false});
 insist(response&&Array.isArray(response.segments)&&response.segments.length,'STT returned no word/segment timestamps','BLOCKED_STT');
 return subs.normalize(response.segments);
}
async function translate({gateway,segments,targetLanguage='en'}){
 insist(gateway&&typeof gateway.invoke==='function','ProviderGateway unavailable','BLOCKED_PROVIDER');
 const values=[];for(const s of subs.normalize(segments)){
  const r=await gateway.invoke({capability:'text.translate',input:{text:s.text,targetLanguage}});
  insist(typeof r?.text==='string'&&r.text.trim(),'Provider returned empty translation');values.push({...s,text:r.text});
 }return values;
}
module.exports={transcribe,translate};
