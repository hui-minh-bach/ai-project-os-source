import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.mjs';

const ROOT = path.join(DATA_DIR, 'workspaces');
fs.mkdirSync(ROOT, { recursive: true });

const SENSITIVE_BASENAMES = new Set(['.npmrc','.pypirc','.netrc','credentials','credentials.json','id_rsa','id_ed25519','known_hosts']);
function safeId(s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '-'); }
export function workspaceDir(projectId) { const d = path.join(ROOT, safeId(projectId)); fs.mkdirSync(d, { recursive: true }); return d; }

function blockedName(name){
  const n=String(name||'').toLowerCase();
  if(SENSITIVE_BASENAMES.has(n))return true;
  if(/^\.env(?:\.|$)/i.test(n) && n!=='.env.example')return true;
  if(/\.(?:pem|key|p12|pfx)$/i.test(n))return true;
  return false;
}

function assertNoSymlink(root,p){
  const rel=path.relative(root,p);
  if(!rel||rel==='.')return;
  let cur=root;
  for(const part of rel.split(path.sep)){
    cur=path.join(cur,part);
    let st;try{st=fs.lstatSync(cur);}catch(e){if(e.code==='ENOENT')break;throw e;}
    if(st.isSymbolicLink())throw new Error('Không cho phép đọc/ghi qua symbolic link trong workspace.');
  }
}

export function safeResolve(root, rel, allowDot=false) {
  const clean = String(rel || '').replaceAll('\\','/');
  if ((!clean && !allowDot) || clean.includes('\0') || clean.startsWith('/') || /^[A-Za-z]:\//.test(clean) || clean.split('/').includes('..') || /(^|\/)(?:\.git|\.ssh|\.aws|node_modules)(\/|$)/i.test(clean)) throw new Error('Đường dẫn file không an toàn.');
  const parts=clean.split('/').filter(Boolean);
  if(parts.some(blockedName))throw new Error('File nhạy cảm bị chặn khỏi agent workspace tools.');
  const p = path.resolve(root, clean || '.');
  if (p!==root && !p.startsWith(root + path.sep)) throw new Error('File vượt khỏi workspace.');
  assertNoSymlink(root,p);
  return p;
}

export function snapshot(projectId, { maxFiles = 45, maxBytes = 150000 } = {}) {
  const root = workspaceDir(projectId); const out = []; let used = 0;
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (out.length >= maxFiles || used >= maxBytes) return;
      if (e.isSymbolicLink()) continue;
      if (['node_modules','.git','.next','dist','build','.turbo','coverage'].includes(e.name) || blockedName(e.name)) continue;
      const p = path.join(dir,e.name);
      if (e.isDirectory()) walk(p); else {
        let b;try{b=fs.readFileSync(p);}catch{continue;} if (b.includes(0)) continue;
        const rel = path.relative(root,p).replaceAll('\\','/');
        const text = b.toString('utf8').slice(0, Math.max(0, maxBytes-used)); used += Buffer.byteLength(text); out.push({ path: rel, content: text });
      }
    }
  }
  walk(root); return out;
}

export function workspaceSummary(projectId){
  const files=snapshot(projectId,{maxFiles:500,maxBytes:1_000_000});
  return {path:workspaceDir(projectId),fileCount:files.length,files:files.map(x=>x.path)};
}

export function applyFiles(projectId, files) {
  if (!Array.isArray(files) || files.length > 30) throw new Error('AI trả quá nhiều file.');
  const root = workspaceDir(projectId); const written = [];
  for (const f of files) {
    if (!f?.path || typeof f.content !== 'string') continue;
    if (Buffer.byteLength(f.content) > 350000) throw new Error(`File quá lớn: ${f.path}`);
    const p = safeResolve(root, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, f.content, 'utf8'); written.push(f.path);
  }
  return written;
}
