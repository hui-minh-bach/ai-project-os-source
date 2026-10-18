'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const uid=()=>crypto.randomUUID();
const fail=(code,message)=>Object.assign(new Error(message),{code});
const redact=s=>String(s).replace(/(sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{15,}|(?:api[_-]?key|authorization|bearer|password|token|secret)\s*[=:]\s*[^\s,;]+)/gi,'[REDACTED]');
function safeName(s){if(typeof s!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(s))throw fail('INVALID_ID','Invalid resource identifier');return s;}
function contained(root,relative){if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.includes('\\')||relative.includes('\0'))throw fail('PATH_DENIED','Relative path required');const base=path.resolve(root),dest=path.resolve(base,relative);if(dest===base||!dest.startsWith(base+path.sep))throw fail('PATH_DENIED','Path outside isolated workspace');let current=base;for(const seg of path.relative(base,dest).split(path.sep)){current=path.join(current,seg);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw fail('PATH_DENIED','Symlinks are forbidden');}return dest;}
function privateDir(dir){let abs=path.resolve(dir),root=path.parse(abs).root,p=root;for(const v of abs.slice(root.length).split(path.sep).filter(Boolean)){p=path.join(p,v);if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw fail('PATH_DENIED','Symlink directory');}fs.mkdirSync(abs,{recursive:true,mode:0o700});if(process.platform!=='win32')fs.chmodSync(abs,0o700);return abs;}
function atomic(file,obj){const tmp=file+'.'+uid()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(obj,null,2),{flag:'wx',mode:0o600});fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}}
function load(file,init){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return structuredClone(init);throw fail('CORRUPT_STATE',`Cannot read state file ${path.basename(file)}; it has not been overwritten`);}}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function cleanError(e){return {code:String(e.code||'ERROR').slice(0,40),message:redact(e.message||'Operation failed').slice(0,450)};}
module.exports={fs,path,crypto,uid,fail,redact,safeName,contained,privateDir,atomic,load,delay,cleanError};
