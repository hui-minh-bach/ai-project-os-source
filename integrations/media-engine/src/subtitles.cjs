'use strict';
const {insist,finite}=require('./utils.cjs');
function ts(t,vtt=false){let ms=Math.max(0,Math.round(t*1000)),h=Math.floor(ms/3600000);ms%=3600000;let m=Math.floor(ms/60000);ms%=60000;let s=Math.floor(ms/1000);ms%=1000;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}${vtt?'.':','}${String(ms).padStart(3,'0')}`;}
function normalize(segments){insist(Array.isArray(segments)&&segments.length,'Subtitle segments required');return segments.map((x,i)=>{
 const start=finite(x.start,-1),end=finite(x.end,-1),text=String(x.text||'').replace(/\s+/g,' ').trim();
 insist(start>=0&&end>start&&text.length>0,`Invalid subtitle segment ${i}`);
 return {id:String(x.id??i+1),start,end,text};
}).sort((a,b)=>a.start-b.start).map((s,i,a)=>{if(i&&s.start<a[i-1].end-0.03)throw Error('Overlapping subtitles');return s;});}
function srt(segments){return normalize(segments).map((s,i)=>`${i+1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.text}\n`).join('\n');}
function vtt(segments){return 'WEBVTT\n\n'+normalize(segments).map((s)=>`${ts(s.start,true)} --> ${ts(s.end,true)}\n${s.text}\n`).join('\n');}
function parseSrt(text){const blocks=String(text).replace(/\r/g,'').trim().split(/\n\s*\n/);const parse=t=>{const m=t.match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);insist(m,`Invalid time ${t}`);return +m[1]*3600+ +m[2]*60+ +m[3]+ +m[4]/1000};return normalize(blocks.map((b,i)=>{const lines=b.split('\n').filter(Boolean);if(/^\d+$/.test(lines[0]))lines.shift();const times=lines.shift()?.split(/\s+-->\s+/)||[];insist(times.length===2,'Invalid subtitle block '+i);return {start:parse(times[0]),end:parse(times[1]),text:lines.join('\n')};}));}
function edit(segments,changes){const arr=normalize(segments),byId=new Map(changes.map(x=>[String(x.id),x]));return normalize(arr.map(s=>({...s,...(byId.get(s.id)||{})})));}
module.exports={ts,srt,vtt,normalize,parseSrt,edit};
