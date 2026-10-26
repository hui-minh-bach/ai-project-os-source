import {splitUtf8} from '../src/lib/utf8-parts.mjs';
/** Text-only AI handoff. Never renames/encodes executables or binary archives as text. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const excluded=new Set(['.git','.data','backups','run','node_modules','__pycache__','AI-PACKAGE','evidence']);
export function sourceInventory(root){
  const text=[],resources=[];
  function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,entry.name),rel=path.relative(root,file).split(path.sep).join('/');if(entry.isSymbolicLink())continue;if(entry.isDirectory()){if(!excluded.has(entry.name))walk(file);continue;}if(!entry.isFile()||/\/\.[^/]*\.zip\.[^/]+$/.test('/'+rel))continue;
    const b=fs.readFileSync(file),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});let content;
    try{content=decoder.decode(b);if(content.includes('\0'))content=undefined;}catch{}
    // Explicit source/text extensions only: no runnable binary, media, model or ZIP bytes.
    const allowed=/\.(?:mjs|cjs|js|ts|tsx|jsx|json|jsonc|html|css|svg|md|txt|py|ps1|cmd|bat|sh|yml|yaml|toml|ini|cfg|conf|go|mod|sum|sql|xml|csv|srt|vtt|env\.example)$/i.test(rel)||['LICENSE','.gitignore','.npmrc','Dockerfile'].includes(entry.name);
    const item={path:rel,bytes:b.length,sha256:hash(b)};
    if(content!==undefined&&allowed)text.push({...item,content});else resources.push(item);
  }}walk(root);return {text,resources};
}
export function encodeSource(files,metadata={}){
  const chunks=[Buffer.from('AIOS_TEXT_SOURCE_V1\n'+JSON.stringify(metadata)+'\n')];
  for(const f of files){const b=Buffer.from(f.content,'utf8');chunks.push(Buffer.from(JSON.stringify({path:f.path,bytes:b.length,sha256:hash(b)})+'\n'),b,Buffer.from('\n'));}
  return Buffer.concat(chunks);
}
export function decodeSource(bytes){
  let pos=0;const line=()=>{const end=bytes.indexOf(10,pos);if(end<0)throw Error('Truncated source header');const s=bytes.subarray(pos,end).toString('utf8');pos=end+1;return s;};
  if(line()!=='AIOS_TEXT_SOURCE_V1')throw Error('Unknown text-source format');const metadata=JSON.parse(line()),files=[],seen=new Set();
  while(pos<bytes.length){const item=JSON.parse(line());if(typeof item.path!=='string'||!item.path||item.path.includes('\\')||item.path.includes(':')||item.path.startsWith('/')||item.path.split('/').some(x=>['.','..',''].includes(x))||seen.has(item.path)||!Number.isSafeInteger(item.bytes)||item.bytes<0||pos+item.bytes>=bytes.length)throw Error('Unsafe or truncated source entry');
    const content=bytes.subarray(pos,pos+item.bytes);pos+=item.bytes;if(bytes[pos++]!==10||hash(content)!==item.sha256)throw Error('Source checksum mismatch');seen.add(item.path);files.push({...item,content});}
  return {metadata,files};
}
export function restoreSource(bytes,destination){
  const decoded=decodeSource(bytes);if(fs.existsSync(destination)&&fs.readdirSync(destination).length)throw Error('Output must be a new/empty directory; refusing overwrite');
  fs.mkdirSync(destination,{recursive:true});for(const f of decoded.files){const p=path.join(destination,f.path);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,f.content,{flag:'wx'});}return decoded.files.length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),get=flag=>args[args.indexOf(flag)+1],destination=get('--out');if(!args.includes('--out')||!destination)throw Error('Use --out DIR');
  if(args.includes('--restore')){const index=JSON.parse(fs.readFileSync(get('--restore'),'utf8')),base=path.dirname(path.resolve(get('--restore'))),chunks=[];for(const part of index.parts){if(!/^SOURCE_PART_\d+\.txt$/.test(part.name))throw Error('Unsafe part name');const b=fs.readFileSync(path.join(base,part.name));if(hash(b)!==part.sha256)throw Error('Part checksum mismatch');chunks.push(b);}const bytes=Buffer.concat(chunks);if(hash(bytes)!==index.sourceSha256)throw Error('Bundle checksum mismatch');console.log(JSON.stringify({restored:restoreSource(bytes,path.resolve(destination)),resources:'use FULL package for listed binary resources; nothing executes'}));}
  else{
    const root=path.resolve(import.meta.dirname,'..'),version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,inventory=sourceInventory(root),metadata={version,purpose:'Exact UTF-8 source, no encoded binaries. Binary resources remain in FULL ZIP.',omittedBinaryResources:inventory.resources},bytes=encodeSource(inventory.text,metadata);decodeSource(bytes);
    fs.mkdirSync(destination,{recursive:true});const parts=[];
    for(const b of splitUtf8(bytes)){const name='SOURCE_PART_'+String(parts.length+1).padStart(3,'0')+'.txt';fs.writeFileSync(path.join(destination,name),b);parts.push({name,bytes:b.length,sha256:hash(b)});}
    fs.writeFileSync(path.join(destination,'RESTORE_INDEX.txt'),JSON.stringify({version,sourceSha256:hash(bytes),files:inventory.text.length,parts},null,2));
    const core=inventory.text.filter(f=>/^(src\/|public\/|integrations\/(media-engine|ai-core)\/|scripts\/export-ai-text-source\.mjs$|docs\/MEDIA_|START-HERE-V0979|package\.json$|AGENTS\.md$)/.test(f.path));
    fs.writeFileSync(path.join(destination,'PROJECT_CORE_FOR_AI.txt'),encodeSource(core,{version,scope:'Application core source for direct attachment if ZIP is rejected. Full text source is in SOURCE_PART files; binary resources in FULL.'}));
    fs.writeFileSync(path.join(destination,'READ_FIRST.txt'),`AI Project OS ${version}\nThis ZIP contains plain UTF-8 .txt files only, no binaries/executables or nested archives. No renamed or encoded binaries.\nRead PROJECT_CORE_FOR_AI.txt first, then SOURCE_PART_*.txt in order. Each source entry stores original path, exact byte length and SHA256; source content is unmodified. RESTORE_INDEX.txt lists part hashes.\nIf your AI blocks ZIP, extract locally and attach PROJECT_CORE_FOR_AI.txt, then relevant SOURCE_PART files. This does not guarantee platform acceptance; keep the exact error if it still fails.\nFor source restoration with this script available: node scripts/export-ai-text-source.mjs --restore /path/RESTORE_INDEX.txt --out /new/empty/directory\nIt only writes verified source files, never executes them. Use FULL for binary resources and actual launch.\n`);
    console.log(JSON.stringify({version,sourceFiles:inventory.text.length,resources:inventory.resources.length,parts:parts.length,bytes:bytes.length,coreBytes:fs.statSync(path.join(destination,'PROJECT_CORE_FOR_AI.txt')).size}));
  }
}
