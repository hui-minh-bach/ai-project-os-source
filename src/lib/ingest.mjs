/** Nguồn tin (RSS/Atom) cho vòng khép kín: quét feed theo nguồn đã khai báo,
 * khử trùng lặp bằng mã băm và lưu thẻ tin vào một tệp JSON local. Không tự
 * bịa nội dung: thẻ chỉ chứa đúng những gì feed công bố, kèm link gốc để đối
 * chiếu. Parser là bản tối giản viết tay (RSS 2.0 + Atom) — feed có cấu trúc
 * lồng nhau bất thường hoặc CDATA chứa thẻ đóng của chính item có thể phân
 * tích thiếu; trường hợp đó scan báo INGEST_PARSE thay vì nuốt lỗi. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { classifyNewsField, scoreNewsItem, newsFieldById, listNewsFields } from './news-fields.mjs';
import { fetchArticleText } from './fulltext.mjs';
import { fetchPublic, publicUrl } from './public-fetch.mjs';

function err(code,message){const e=new Error(message);e.code=code;return e;}
const FEED_KINDS=new Set(['rss','atom','auto']);
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');

function decodeEntities(text){
 return String(text)
  .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>{try{return String.fromCodePoint(parseInt(h,16));}catch{return '';}})
  .replace(/&#(\d+);/g,(_,n)=>{try{return String.fromCodePoint(Number(n));}catch{return '';}})
  .replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function cleanText(raw){
 return decodeEntities(decodeEntities(String(raw||'')).replace(/<\/?(a|font|b|i|u|p|br|div|span|img|table|thead|tbody|tr|td|th|ul|ol|li|strong|em|small|sub|sup|h[1-6])\b[^>]*>/gi,' ')).replace(/\s+/g,' ').replace(/\s+([,.;:!?…])/g,'$1').trim();
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
  publisher:cleanText(tagText(block,'source'))||null,
 }));
}

/** Kho nguồn tin + thẻ tin bền vững trong một tệp JSON (ghi qua tệp tạm rồi
 * đổi tên để tránh hỏng dữ liệu khi mất điện giữa chừng). */
export function createIngestStore({file,fetchImpl}={}){
 if(typeof file!=='string'||!file.trim())throw err('INGEST_FILE','Thiếu đường dẫn tệp dữ liệu nguồn tin.');
 let state={version:2,sources:[],cards:[],customFields:[]};
 if(fs.existsSync(file)){
  try{
   const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
   if(parsed&&Array.isArray(parsed.sources)&&Array.isArray(parsed.cards))state={version:2,sources:parsed.sources,cards:parsed.cards,customFields:Array.isArray(parsed.customFields)?parsed.customFields:[]};
  }catch{throw err('INGEST_PARSE','Tệp dữ liệu nguồn tin bị hỏng, không đọc được: '+file);}
 }
 function save(){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const tmp=file+'.tmp-'+crypto.randomUUID();
  fs.writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600});
  fs.renameSync(tmp,file);
 }

 function listFields(){return [...listNewsFields().map(f=>({...f,custom:false})),...structuredClone(state.customFields)];}
 function fieldById(id){return listFields().find(f=>f.id===id)||null;}
 function saveField(input={}){
  const label=String(input.label||'').trim(),query=String(input.query||label).trim();
  if(label.length<2||label.length>80||query.length<2||query.length>400||/[\x00-\x1f]/.test(label+query))throw err('INGEST_FIELD','Ten linh vuc 2-80 ky tu; truy van 2-400 ky tu.');
  const keywords=[...new Set((Array.isArray(input.keywords)?input.keywords:[label]).map(k=>String(k).trim()).filter(k=>k&&k.length<=80))].slice(0,20);
  const prior=input.id?state.customFields.find(f=>f.id===input.id):null;
  if(input.id&&!prior)throw err('INGEST_FIELD','Chi sua linh vuc tu tao.');
  if(listFields().some(f=>f.id!==prior?.id&&f.label.toLocaleLowerCase('vi')===label.toLocaleLowerCase('vi')))throw err('INGEST_FIELD_DUPLICATE','Linh vuc nay da ton tai.');
  if(!prior&&state.customFields.length>=100)throw err('INGEST_FIELD_LIMIT','Toi da 100 linh vuc tuy chinh.');
  const base=label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'topic';
  const f={id:prior?.id||'custom-'+base+'-'+crypto.randomUUID().slice(0,8),label,query,keywords:keywords.length?keywords:[label],custom:true,createdAt:prior?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),origin:input.origin==='ai'?'ai':'user'};
  if(prior){state.customFields[state.customFields.indexOf(prior)]=f;}else state.customFields.push(f);
  save();return structuredClone(f);
 }
 function removeField(id){
  if(!state.customFields.some(f=>f.id===id))throw err('INGEST_FIELD','Chi xoa linh vuc tuy chinh.');
  state.customFields=state.customFields.filter(f=>f.id!==id);
  // Keep historic cards and sources, disabling subscriptions instead of deleting news.
  for(const source of state.sources)if(source.fieldId===id)source.enabled=false;
  save();return true;
 }
 const findSource=id=>state.sources.find(s=>s.id===id);
 const copySource=s=>({...s,keywords:[...s.keywords]});

 function addSource({name,url,kind='auto',enabled=true,keywords=[],fieldId=null,fullText=true,managedSearch=false}={}){
  const fid=fieldId?String(fieldId).trim():null;
  if(fid&&!fieldById(fid))throw err('INGEST_FIELD','Lĩnh vực tin không hợp lệ: '+fid);
  let parsed=null;try{parsed=new URL(String(url||''));}catch{}
  if(!parsed||!['http:','https:'].includes(parsed.protocol))throw err('INGEST_URL','Địa chỉ nguồn tin phải là URL http(s) hợp lệ.');
  publicUrl(parsed.toString());
  if(!FEED_KINDS.has(kind))throw err('INGEST_URL','Loại nguồn tin phải là rss, atom hoặc auto.');
  const kw=Array.isArray(keywords)?[...new Set(keywords.map(k=>String(k||'').trim()).filter(Boolean))].slice(0,20):[];
  const source={id:crypto.randomUUID(),name:String(name||'').trim().slice(0,120)||parsed.hostname,url:parsed.toString(),kind,enabled:enabled!==false,keywords:kw,fieldId:fid,fullText:fullText!==false,managedSearch:managedSearch===true,createdAt:new Date().toISOString(),lastScanAt:null,lastError:null};
  state.sources.push(source);save();
  return copySource(source);
 }
 function updateSource(id,patch={}){
  const source=findSource(id);if(!source)throw err('INGEST_NOT_FOUND','Source not found.');
  if(patch.url!==undefined)source.url=publicUrl(String(patch.url)).toString();
  if(patch.name!==undefined)source.name=String(patch.name).trim().slice(0,120);
  if(patch.managedSearch!==undefined)source.managedSearch=patch.managedSearch===true;
  if(patch.keywords!==undefined)source.keywords=[...new Set(patch.keywords.map(String))].slice(0,20);
  save();return copySource(source);
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
 async function performScan(sourceId,{fetchImpl:scanFetch,fullText=true,maxAgeHours=0,nowMs=Date.now()}={}){
  const source=findSource(sourceId);
  if(!source)throw err('INGEST_NOT_FOUND','Không tìm thấy nguồn tin cần quét.');
  if(!source.enabled)throw err('INGEST_DISABLED','Nguồn tin đang tắt; hãy bật lại trước khi quét.');
  const fetcher=scanFetch||fetchImpl||fetchPublic;
  if(typeof fetcher!=='function')throw err('INGEST_FETCH','Môi trường chưa có hàm tải feed.');
  let xml='';const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),15000);
  try{
   const res=await fetcher(source.url,{headers:{accept:'application/rss+xml, application/atom+xml, application/xml, text/xml','user-agent':'AI-Project-OS-Local'},signal:ctl.signal});
   if(res&&typeof res.status==='number'&&res.status>=400)throw new Error('HTTP '+res.status);
   if(res&&res.ok===false)throw new Error('HTTP '+(res.status||'?'));
   if(Number(res.headers?.get?.('content-length')||0)>2000000)throw new Error('Feed exceeds 2 MB.');
   if(res.body?.getReader){const reader=res.body.getReader(),chunks=[];let bytes=0;while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.byteLength;if(bytes>2000000){await reader.cancel();throw new Error('Feed exceeds 2 MB.');}chunks.push(Buffer.from(item.value));}xml=Buffer.concat(chunks).toString('utf8');}
   else xml=typeof res?.text==='function'?await res.text():String(res?.text??res??'');
   if(xml.length>2000000)throw new Error('Feed exceeds 2 MB.');
  }catch(e){
   clearTimeout(timer);
   source.lastError='Không tải được feed: '+String(e?.message||e).slice(0,200);
   source.lastScanAt=new Date().toISOString();save();
   throw err('INGEST_FETCH','Không tải được nguồn tin "'+source.name+'": '+String(e?.message||e).slice(0,200));
  }
  clearTimeout(timer);
  let items;
  try{items=parseFeed(xml);}
  catch(e){source.lastError=e.message;source.lastScanAt=new Date().toISOString();save();throw e;}
  const fetchedAt=new Date().toISOString();
  const seen=new Map(state.cards.map(c=>[c.hash,c]));
  const kw=source.keywords.map(k=>k.toLowerCase());
  let added=0,duplicates=0,filtered=0,stale=0,undated=0,future=0;
  const addedCards=[];
  for(const item of items.slice(0,500)){
   const when=Date.parse(item.publishedAt);
   if(maxAgeHours>0){if(!Number.isFinite(when)){undated++;continue;}if(when>nowMs+300000){future++;continue;}if(nowMs-when>maxAgeHours*3600000){stale++;continue;}}
   const key=String(item.link||item.guid||item.title||'').trim();
   if(!key){filtered++;continue;}
   if(kw.length){
    const hay=(item.title+' '+item.summary).toLowerCase();
    if(!kw.some(k=>hay.includes(k))){filtered++;continue;}
   }
   const hash=sha256(key);
   if(seen.has(hash)){const existing=seen.get(hash);if(source.fieldId){existing.fieldIds=[...new Set([existing.fieldId,...(existing.fieldIds||[]),source.fieldId].filter(Boolean))];}duplicates++;continue;}
   const cardFieldId=source.fieldId||classifyNewsField(item,listFields());
   const scored=scoreNewsItem(item,{fieldId:cardFieldId,field:fieldById(cardFieldId),now:new Date(nowMs)});
   const card={id:crypto.randomUUID(),sourceId:source.id,title:item.title||'(không có tiêu đề)',summary:String(item.summary||'').slice(0,500),link:item.link||'',publisher:item.publisher||null,publishedAt:item.publishedAt||null,fetchedAt,hash,usedByProjectId:null,fieldId:cardFieldId,score:scored.score,scoreBasis:scored.basis};
   seen.set(hash,card);state.cards.push(card);addedCards.push(card);
   added++;
  }
  // Full-text (Miniflux pattern): only for brand-new cards whose feed summary
  // is too short to write from, capped per scan so a big feed stays fast, and
  // fully failure-tolerant — a card without full text simply keeps its summary.
  let fullTextFetched=0;
  if(fullText&&source.fullText!==false){
   for(const card of addedCards){
    if(fullTextFetched>=3)break;
    if(!card.link||String(card.summary||'').length>=280)continue;
    try{
     const r=await fetchArticleText(card.link,{fetchImpl:fetcher});
     if(r.ok){card.fullText=r.text.slice(0,6000);card.fullTextAt=fetchedAt;fullTextFetched++;}
    }catch{/* a failed article fetch never fails the scan */}
   }
  }
  source.lastScanAt=fetchedAt;source.lastError=null;save();
  return {sourceId:source.id,name:source.name,added,duplicates,filtered,stale,undated,future,total:items.length,fullTextFetched};
 }


 const pendingScans=new Map();
 function scanSource(id,options={}){
  if(pendingScans.has(id))return pendingScans.get(id);
  const work=performScan(id,options).finally(()=>pendingScans.delete(id));pendingScans.set(id,work);return work;
 }
 function listCards({unusedOnly=false,fieldId=null,maxAgeHours=0,nowMs=Date.now()}={}){
  return state.cards.filter(c=>(!unusedOnly||!c.usedByProjectId)&&(!fieldId||c.fieldId===fieldId||(c.fieldIds||[]).includes(fieldId))&&(!maxAgeHours||(Number.isFinite(Date.parse(c.publishedAt))&&Date.parse(c.publishedAt)<=nowMs+300000&&nowMs-Date.parse(c.publishedAt)<=maxAgeHours*3600000))).slice().reverse().map(c=>({...c,...scoreNewsItem(c,{fieldId:fieldId||c.fieldId,field:fieldById(fieldId||c.fieldId),now:new Date(nowMs)})}));
 }
 function markCardUsed(cardId,projectId){
  const card=state.cards.find(c=>c.id===cardId);
  if(!card)throw err('INGEST_NOT_FOUND','Không tìm thấy thẻ tin.');
  card.usedByProjectId=projectId?String(projectId):null;
  save();
  return {...card};
 }
 function getCard(cardId){
  const card=state.cards.find(c=>c.id===cardId);
  return card?{...card}:null;
 }
 function setCardFullText(cardId,{text,title}={}){
  const card=state.cards.find(c=>c.id===cardId);
  if(!card)throw err('INGEST_NOT_FOUND','Không tìm thấy thẻ tin.');
  card.fullText=String(text||'').slice(0,6000);
  if(title)card.fullTextTitle=String(title).slice(0,300);
  card.fullTextAt=new Date().toISOString();
  save();
  return {...card};
 }
 function counts(){
  return {sources:state.sources.length,enabledSources:state.sources.filter(s=>s.enabled).length,cards:state.cards.length,unusedCards:state.cards.filter(c=>!c.usedByProjectId).length};
 }
 return {listFields,fieldById,saveField,removeField,addSource,listSources,updateSource,setSourceEnabled,removeSource,scanSource,listCards,markCardUsed,getCard,setCardFullText,counts};
}
