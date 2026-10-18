/** Convert *provider-supplied* word timestamps into readable, timecoded SRT.
 *  No approximate STT or invented timings. */
import fs from 'node:fs';

const time=s=>{
  const ms=Math.max(0,Math.round(s*1000));
  return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms%3600000/60000)).padStart(2,'0')}:${String(Math.floor(ms%60000/1000)).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;
};
export function wordCaptions(items,{maxCharacters=48,maxDuration=3.7,audioSeconds=3600}={}){
  if(!Array.isArray(items))return [];
  const words=items.filter(w=>w&&typeof w.word==='string'&&w.word.trim()&&!/^<[^>]+>$/.test(w.word.trim())&&Number.isFinite(Number(w.start))&&Number.isFinite(Number(w.end))&&Number(w.start)>=0&&Number(w.end)>Number(w.start))
    .map(w=>({word:w.word.trim().replace(/[\r\n\t]+/g,' '),start:Number(w.start),end:Math.min(Number(w.end),audioSeconds)}))
    .filter(w=>w.end>w.start&&w.start<audioSeconds);
  const cues=[];let group=[];
  const flush=()=>{if(!group.length)return;const first=group[0],last=group[group.length-1];cues.push({start:first.start,end:last.end,text:group.map(w=>w.word).join(' ').replace(/\s+([,.!?;:])/g,'$1')});group=[];};
  for(const word of words){
    const candidate=[...group,word];const chars=candidate.map(w=>w.word).join(' ').length;
    if(group.length&&(chars>maxCharacters||word.end-group[0].start>maxDuration||word.start-group[group.length-1].end>0.7))flush();
    group.push(word);
    if(/[.!?…]$/.test(word.word))flush();
  }
  flush();
  return cues.filter(x=>x.end>x.start).map((x,i)=>({...x,id:String(i+1)}));
}
export function writeWordCaptions(file,words,opts={}){
  const cues=wordCaptions(words,opts);
  if(!cues.length)return null;
  const srt=cues.map((c,i)=>`${i+1}\n${time(c.start)} --> ${time(c.end)}\n${c.text}\n`).join('\n');
  fs.writeFileSync(file,srt,'utf8');
  return {file,segments:cues,method:'heygen-provider-word-timestamps'};
}
