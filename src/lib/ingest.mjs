/** Nguồn tin (RSS/Atom) cho vòng khép kín: quét feed theo nguồn đã khai báo,
 * khử trùng lặp bằng mã băm và lưu thẻ tin vào một tệp JSON local. Không tự
 * bịa nội dung: thẻ chỉ chứa đúng những gì feed công bố, kèm link gốc để đối
 * chiếu. Parser là bản tối giản viết tay (RSS 2.0 + Atom) — feed có cấu trúc
 * lồng nhau bất thường hoặc CDATA chứa thẻ đóng của chính item có thể phân
 * tích thiếu; trường hợp đó scan báo INGEST_PARSE thay vì nuốt lỗi. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { classifyNewsField, scoreNewsItem, newsFieldById } from './news-fields.mjs';

function err(code,message){const e=new Error(message);e.code=code;return e;}
const FEED_KINDS=new Set(['rss','atom','auto']);
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');

function decodeEntities(text){
 return String(text)
  .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>{try{return String.fromCodePoint(parseInt(h,16));}catch{return '';}})
  .replace(/&#(\d+);/g,(_,n)=>{try{return String.fromCodePoint(Number(n));}catch{return '';}})
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function cleanText(raw){
 return decodeEntities(String(raw||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').replace(/\s+([,.;:!?…])/g,'$1').trim();
}
function tagText(block,tag){
 const m=block.match(new RegExp('<'+tag+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+tag+'>','i'));
 if(!m)return '';
 const inner=m[1].trim();
 const cdata=inner.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
 return (cdata?cdata[1]:inner).trim();
}
function atomLink(block){
 const tags=block.match(/<link\b[^>]*>/gi)||[];
 let fallback='';
 for(const t of tags){
  const href=(t.match(/href\s*=\s*"([^"]*)"/i)||t.match(/href\s*=\s*'([^']*)'/i)||[])[1]||'';
  if(!href)continue;
  const rel=(t.match(/rel\s*=\s*"([^"]*)"/i)||[])[1]||'';
  if(rel==='alternate'||rel==='')return decodeEntities(href);
  if(!fallback)fallback=decodeEntities(href);
 }
 return fallback;
}
function toIso(value){
 if(!value)return null;
 const d=new Date(String(value).trim());
 return Number.isNaN(d.getTime())?null:d.toISOString();
}

/** Phân tích một tài liệu RSS 2.0 hoặc Atom thành danh sách mục thô:
 * {title, link, summary, publishedAt (ISO|null), guid}. Hàm thuần, không IO. */
export function parseFeed(xml){
 if(typeof xml!=='string'||!xml.trim())throw err('INGEST_PARSE','Nội dung feed trống hoặc không phải văn bản.');
 const isAtom=/<feed[\s>]/i.test(xml);
 const isRss=/<channel[\s>]/i.test(xml)||/<rss[\s>]/i.test(xml);
 if(!isAtom&&!isRss)throw err('INGEST_PARSE','Không nhận diện được định dạng RSS/Atom trong nội dung tải về.');
 if(isAtom&&!isRss){
  const blocks=xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi)||[];
  return blocks.map(block=>({
   title:cleanText(tagText(block,'title')),
   link:atomLink(block),
   summary:cleanText(tagText(block,'summary')||tagText(block,'content')),
   publishedAt:toIso(tagText(block,'published')||tagText(block,'updated')),
   guid:cleanText(tagText(block,'id')),
  }));
 }
 const blocks=xml.match(/<item[\s>][\s\S]*?<\/item>/gi)||[];
 return blocks.map(block=>({
  title:cleanText(tagText(block,'title')),
  link:cleanText(tagText(block,'link')),
  summary:cleanText(tagText(block,'description')),
  publishedAt:toIso(tagText(block,'pubDate')),
  guid:cleanText(tagText(block,'guid')),
 }));
}

/** Kho nguồn tin + thẻ tin bền vững trong một tệp JSON (ghi qua tệp tạm rồi
 * đổi tên để tránh hỏng dữ liệu khi mất điện giữa chừng). */
export function createIngestStore({file,fetchImpl}={}){
 if(typeof file!=='string'||!file.trim())throw err('INGEST_FILE','Thiếu đường dẫn tệp dữ liệu nguồn tin.');
 let state={version:1,sources:[],cards:[]};
 if(fs.existsSync(file)){
  try{
   const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
   if(parsed&&Array.isArray(parsed.sources)&&Array.isArray(parsed.cards))state={version:1,sources:parsed.sources,cards:parsed.cards};
  }catch{throw err('INGEST_PARSE','Tệp dữ liệu nguồn tin bị hỏng, không đọc được: '+file);}
 }
 function save(){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const tmp=file+'.tmp-'+crypto.randomUUID();
  fs.writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600});
  fs.renameSync(tmp,file);
 }
 const findSource=id=>state.sources.find(s=>s.id===id);
 const copySource=s=>({...s,keywords:[...s.keywords]});

 function addSource({name,url,kind='auto',enabled=true,keywords=[],fieldId=null}={}){
  const fid=fieldId?String(fieldId).trim():null;
  if(fid&&!newsFieldById(fid))throw err('INGEST_FIELD','Lĩnh vực tin không hợp lệ: '+fid);
  let parsed=null;try{parsed=new URL(String(url||''));}catch{}
  if(!parsed||!['http:','https:'].includes(parsed.protocol))throw err('INGEST_URL','Địa chỉ nguồn tin phải là URL http(s) hợp lệ.');
  if(!FEED_KINDS.has(kind))throw err('INGEST_URL','Loại nguồn tin phải là rss, atom hoặc auto.');
  const kw=Array.isArray(keywords)?[...new Set(keywords.map(k=>String(k||'').trim()).filter(Boolean))].slice(0,20):[];
  const source={id:crypto.randomUUID(),name:String(name||'').trim().slice(0,120)||parsed.hostname,url:parsed.toString(),kind,enabled:enabled!==false,keywords:kw,fieldId:fid,createdAt:new Date().toISOString(),lastScanAt:null,lastError:null};
  state.sources.push(source);save();
  return copySource(source);
 }
 function listSources(){return state.sources.map(copySource);}
 function setSourceEnabled(id,enabled){
  const source=findSource(id);
  if(!source)throw err('INGEST_NOT_FOUND','Không tìm thấy nguồn tin để đổi trạng thái.');
  source.enabled=Boolean(enabled);save();
  return copySource(source);
 }
 function removeSource(id){
  if(!findSource(id))throw err('INGEST_NOT_FOUND','Không tìm thấy nguồn tin để xóa.');
  state.sources=state.sources.filter(s=>s.id!==id);
  state.cards=state.cards.filter(c=>c.sourceId!==id);
  save();
  return true;
 }

 /** Quét một nguồn: tải feed, phân tích, lọc từ khóa, khử trùng lặp theo
  * hash của (link || guid || title) trên TOÀN BỘ kho (quét lại cùng feed
  * luôn cho added = 0). Nguồn đang tắt → ném INGEST_DISABLED. */
 async function scanSource(sourceId,{fetchImpl:scanFetch}={}){
  const source=findSource(sourceId);
  if(!source)throw err('INGEST_NOT_FOUND','Không tìm thấy nguồn tin cần quét.');
  if(!source.enabled)throw err('INGEST_DISABLED','Nguồn tin đang tắt; hãy bật lại trước khi quét.');
  const fetcher=scanFetch||fetchImpl||globalThis.fetch;
  if(typeof fetcher!=='function')throw err('INGEST_FETCH','Môi trường chưa có hàm tải feed.');
  let xml='';
  try{
   const res=await fetcher(source.url,{headers:{accept:'application/rss+xml, application/atom+xml, application/xml, text/xml','user-agent':'AI-Project-OS-Local'}});
   if(res&&typeof res.status==='number'&&res.status>=400)throw new Error('HTTP '+res.status);
   if(res&&res.ok===false)throw new Error('HTTP '+(res.status||'?'));
   xml=typeof res?.text==='function'?await res.text():String(res?.text??res??'');
  }catch(e){
   source.lastError='Không tải được feed: '+String(e?.message||e).slice(0,200);
   source.lastScanAt=new Date().toISOString();save();
   throw err('INGEST_FETCH','Không tải được nguồn tin "'+source.name+'": '+String(e?.message||e).slice(0,200));
  }
  let items;
  try{items=parseFeed(xml);}
  catch(e){source.lastError=e.message;source.lastScanAt=new Date().toISOString();save();throw e;}
  const fetchedAt=new Date().toISOString();
  const seen=new Set(state.cards.map(c=>c.hash));
  const kw=source.keywords.map(k=>k.toLowerCase());
  let added=0,duplicates=0,filtered=0;
  for(const item of items){
   const key=String(item.link||item.guid||item.title||'').trim();
   if(!key){filtered++;continue;}
   if(kw.length){
    const hay=(item.title+' '+item.summary).toLowerCase();
    if(!kw.some(k=>hay.includes(k))){filtered++;continue;}
   }
   const hash=sha256(key);
   if(seen.has(hash)){duplicates++;continue;}
   seen.add(hash);
   const cardFieldId=source.fieldId||classifyNewsField(item);
   const scored=scoreNewsItem(item,{fieldId:cardFieldId});
   state.cards.push({id:crypto.randomUUID(),sourceId:source.id,title:item.title||'(không có tiêu đề)',summary:String(item.summary||'').slice(0,500),link:item.link||'',publishedAt:item.publishedAt||null,fetchedAt,hash,usedByProjectId:null,fieldId:cardFieldId,score:scored.score,scoreBasis:scored.basis});
   added++;
  }
  source.lastScanAt=fetchedAt;source.lastError=null;save();
  return {sourceId:source.id,added,duplicates,filtered,total:items.length};
 }

 function listCards({unusedOnly=false,fieldId=null}={}){
  return state.cards.filter(c=>(!unusedOnly||!c.usedByProjectId)&&(!fieldId||c.fieldId===fieldId)).slice().reverse().map(c=>({...c}));
 }
 function markCardUsed(cardId,projectId){
  const card=state.cards.find(c=>c.id===cardId);
  if(!card)throw err('INGEST_NOT_FOUND','Không tìm thấy thẻ tin.');
  card.usedByProjectId=projectId?String(projectId):null;
  save();
  return {...card};
 }
 function counts(){
  return {sources:state.sources.length,enabledSources:state.sources.filter(s=>s.enabled).length,cards:state.cards.length,unusedCards:state.cards.filter(c=>!c.usedByProjectId).length};
 }
 return {addSource,listSources,setSourceEnabled,removeSource,scanSource,listCards,markCardUsed,counts};
}
