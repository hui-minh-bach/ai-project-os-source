const fail=(code,message)=>Object.assign(new Error(message),{code});
export const normalizedText=s=>String(s).replace(/\s+/g,' ').trim();
export function captionChunks(text,maxChars=84){
 let rest=normalizedText(text),out=[];while(rest.length>maxChars){let at=rest.lastIndexOf(' ',maxChars);if(at<1)at=rest.indexOf(' ',maxChars);if(at<1)break;const near=rest.slice(0,at).match(/^(.{20,}[,;.!?])\s/);if(near&&near[1].length>=maxChars*.55)at=near[1].length;out.push(rest.slice(0,at).trim());rest=rest.slice(at).trim();}if(rest)out.push(rest);
 if(normalizedText(out.join(' '))!==normalizedText(text))throw fail('MEDIA_CONTENT','Chia câu làm thay đổi nội dung.');return out;
}
export function normalizeSpeechSegments(segments){
 const result=[];for(const s of segments){if(/^\s*[[(](?:silence|blank_audio|music|im lặng)[)\]]\s*$/i.test(s.text))continue;const previous=result.at(-1);
  if(previous&&!/[.!?…]["')\]]?$/.test(previous.text.trim())&&s.start-previous.end<=.45&&s.end-previous.start<=30&&previous.text.length+s.text.length<1400){previous.text=normalizedText(previous.text+' '+s.text);previous.end=s.end;}else result.push({...s,text:normalizedText(s.text)});
 }return result;
}
export function validateGlossary(value=[]){
 if(!Array.isArray(value)||value.length>40)throw fail('MEDIA_GLOSSARY','Tối đa 40 thuật ngữ.');return value.map(v=>{if(!v||typeof v.source!=='string'||typeof v.target!=='string'||!v.source.trim()||!v.target.trim()||v.source.length>100||v.target.length>160)throw fail('MEDIA_GLOSSARY','Thuật ngữ cần có tên gốc và cách dịch.');return {source:v.source.trim(),target:v.target.trim()};});
}
export function translationIntegrity(segments,texts,glossary=[]){
 if(!Array.isArray(texts)||texts.length!==segments.length)throw fail('MEDIA_TRANSLATION_CONTENT','Số câu dịch không khớp nội dung gốc.');
 const numbers=text=>[...text.matchAll(/\d+(?:[.,:/-]\d+)*/g)].map(m=>m[0].replace(/\D/g,''));
 const fixed=['NASA','GPS','USD','EUR','VND','API','CPU','GPU','UNESCO'];
 for(let i=0;i<segments.length;i++){
  const source=segments[i].text,target=texts[i];if(typeof target!=='string'||!target.trim()||target.length>2000)throw fail('MEDIA_TRANSLATION_CONTENT',`Câu ${i+1} rỗng hoặc quá dài.`);
  const expected=numbers(source),actual=numbers(target);if(expected.some(n=>!actual.includes(n)))throw fail('MEDIA_TRANSLATION_CONTENT',`Câu ${i+1} thiếu/thay đổi con số nguồn. Không tự xuất video sai nội dung.`);
  for(const term of fixed)if(new RegExp('\\b'+term+'\\b').test(source)&&!new RegExp('\\b'+term+'\\b','i').test(target))throw fail('MEDIA_TRANSLATION_CONTENT',`Câu ${i+1} làm mất tên/thuật ngữ ${term}.`);
  for(const term of glossary)if(source.normalize('NFC').toLocaleLowerCase().includes(term.source.normalize('NFC').toLocaleLowerCase())&&!target.normalize('NFC').toLocaleLowerCase().includes(term.target.normalize('NFC').toLocaleLowerCase()))throw fail('MEDIA_TRANSLATION_CONTENT',`Câu ${i+1} chưa giữ thuật ngữ: ${term.source} → ${term.target}.`);
  if(source.length>100&&target.length<source.length*.3)throw fail('MEDIA_TRANSLATION_CONTENT',`Câu ${i+1} bị rút ngắn quá mức. Cần kiểm tra bản dịch đầy đủ.`);
 }return {checked:true,checks:['segment-count','source-numbers-present','known-acronyms','owner-glossary','gross-truncation'],semanticAccuracy:'not_proven_by_automatic_checks'};
}

export const subtitlePlainText=text=>String(text).replace(/<\/?(?:i|b|u|font)(?:\s[^>]*)?>/gi,'').replace(/\{\\[^}]*\}/g,'').replace(/\s+/g,' ').trim();
