/** Checks every distributed source file's SHA-256. A digest is NOT a signature. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const reserved=new Set(['RELEASE_FILES_SHA256.json','SHA256SUMS.txt']);
const banned=new Set(['.git','.data','node_modules','runtime-win-x64','runtime-win-arm64','runtime-linux-x64','runtime-darwin-x64','runtime-darwin-arm64','backups','output']);
function walk(rel=''){
 const entries=[];
 for(const x of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){
  if(banned.has(x.name))continue;
  const name=rel?rel+'/'+x.name:x.name;
  if(x.isSymbolicLink())throw Error('Unexpected symlink in release: '+name);
  if(x.isDirectory())entries.push(...walk(name));
  else if(x.isFile()&&!reserved.has(name))entries.push(name);
 }
 return entries;
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'RELEASE_FILES_SHA256.json'),'utf8'));
const expected=manifest.files||{};
const actual=walk();
const mismatches=[];
for(const filename of actual){
 const digest=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,filename))).digest('hex');
 if(expected[filename]!==digest)mismatches.push({path:filename,reason:!expected[filename]?'missing manifest record':'digest mismatch'});
}
for(const filename of Object.keys(expected))if(!actual.includes(filename))mismatches.push({path:filename,reason:'missing on disk'});
const outcome={ok:mismatches.length===0,expectedFiles:Object.keys(expected).length,actualFiles:actual.length,mismatches};
console.log(JSON.stringify(outcome,null,2));
if(!outcome.ok)process.exitCode=1;
