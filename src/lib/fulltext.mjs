import { fetchPublic } from './public-fetch.mjs';
/** Full-text extraction for news cards, following the Miniflux pattern: when
 * a feed item carries only a short summary, fetch the article page the user
 * subscribed to and extract its main text locally with a small heuristic
 * reader (no third-party service, no new dependency). The extracted text is
 * stored on the card and clearly attributed to its source link; failures
 * never break a scan — the card simply keeps its feed summary. */

function decodeEntities(text){
 return String(text)
  .replace(/&#x([0-9a-fA-F]+);/g,(_,h)=>{try{return String.fromCodePoint(parseInt(h,16));}catch{return '';}})
  .replace(/&#(\d+);/g,(_,n)=>{try{return String.fromCodePoint(Number(n));}catch{return '';}})
  .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
}
function stripTags(html){
 return decodeEntities(String(html||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h[1-6])>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[ \t]+/g,' ').replace(/\n\s*\n+/g,'\n').trim();
}
function pageTitle(html){
 const og=String(html||'').match(/<meta[^>]+property\s*=\s*["']og:title["'][^>]+content\s*=\s*["']([^"']+)["']/i)||String(html||'').match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:title["']/i);
 if(og)return decodeEntities(og[1]).trim().slice(0,300);
 const t=String(html||'').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
 return t?stripTags(t[1]).slice(0,300):'';
}

/** Hàm thuần: trích phần thân bài từ HTML. Ưu tiên khối <article> dài nhất;
 * nếu không có, gom các đoạn <p> đủ dài, loại đoạn chứa quá nhiều liên kết
 * (menu/tóm tắt liên quan) và đoạn trùng lặp. */
export function extractArticleText(html,{maxChars=12000}={}){
 if(typeof html!=='string'||!html.trim())return {title:'',text:'',paragraphs:0};
 let doc=html
  .replace(/<!--[\s\S]*?-->/g,' ')
  .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header|aside|button|select|textarea)[\s>][\s\S]*?<\/\1>/gi,' ')
  .replace(/<(script|style|noscript|svg|iframe|form|nav|footer|header|aside|button|select|textarea)\b[^>]*\/?>/gi,' ');
 const title=pageTitle(doc);
 const articles=[...doc.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(m=>m[1]);
 let scope=doc;
 if(articles.length)scope=articles.sort((a,b)=>b.length-a.length)[0];
 const rawParas=[...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>m[1]);
 const seen=new Set();const paras=[];
 for(const raw of rawParas){
  const linkText=(raw.match(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)||[]).map(a=>stripTags(a)).join(' ').length;
  const text=stripTags(raw).replace(/\s+/g,' ').trim();
  if(text.length<40)continue;
  if(linkText>0&&linkText/text.length>0.6)continue;
  const key=text.slice(0,80).toLowerCase();
  if(seen.has(key))continue;
  seen.add(key);paras.push(text);
 }
 // Fallback: no usable <p> set (some CMS render body in divs) — take the
 // longest text block of the article scope instead.
 if(paras.length<2){
  const block=stripTags(scope).split('\n').map(s=>s.trim()).filter(s=>s.length>=60);
  const joined=block.join('\n\n');
  if(joined.length>paras.join('\n\n').length){return {title,text:joined.slice(0,maxChars),paragraphs:block.length};}
 }
 return {title,text:paras.join('\n\n').slice(0,maxChars),paragraphs:paras.length};
}

function err(code,message){const e=new Error(message);e.code=code;return e;}

/** Tải một trang bài và trích toàn văn. Trả {ok:true,title,text,chars} hoặc
 * {ok:false,reason} — không ném lỗi nghiệp vụ để scan không bị chặn. */
export async function fetchArticleText(url,{fetchImpl=fetchPublic,timeoutMs=15000,maxBytes=3_000_000,maxChars=12000}={}){
 let parsed=null;try{parsed=new URL(String(url||''));}catch{}
 if(!parsed||!['http:','https:'].includes(parsed.protocol))return {ok:false,reason:'invalid-url'};
 if(typeof fetchImpl!=='function')return {ok:false,reason:'no-fetch'};
 const ctl=typeof AbortController!=='undefined'?new AbortController():null;
 const timer=ctl?setTimeout(()=>ctl.abort(),Math.max(1000,timeoutMs)):null;
 try{
  const res=await fetchImpl(parsed.toString(),{headers:{'user-agent':'AI-Project-OS-Local (+full-text reader)','accept':'text/html,application/xhtml+xml'},signal:ctl?.signal,redirect:'follow'});
  if(!res||res.ok===false||(typeof res.status==='number'&&res.status>=400))return {ok:false,reason:'http-'+(res?.status||'?')};
  const ctype=String(res.headers?.get?.('content-type')||'');
  if(ctype&&!/html|xml/i.test(ctype))return {ok:false,reason:'not-html'};
  const html=typeof res.text==='function'?await res.text():String(res?.text??'');
  if(html.length>maxBytes)return {ok:false,reason:'too-large'};
  const {title,text}=extractArticleText(html,{maxChars});
  if(text.length<200)return {ok:false,reason:'too-short'};
  return {ok:true,title,text,chars:text.length};
 }catch(e){
  return {ok:false,reason:e?.name==='AbortError'?'timeout':String(e?.message||e).slice(0,120)};
 }finally{if(timer)clearTimeout(timer);}
}
export { err as fullTextError };
