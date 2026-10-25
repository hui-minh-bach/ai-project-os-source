/** Crash-safe, identity-bound image scene receipts. No paid API calls occur here.
 * A task retry reuses verified completed scenes instead of re-billing them.
 * Receipt paths are fixed and never supplied by untrusted JSON.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const problem = (message) => Object.assign(new Error(message),{code:'IMAGE_SCENE_CHECKPOINT'});
function verifiedImage(file){
  const stat=fs.statSync(file);
  if(!stat.isFile()||stat.size<1024||stat.size>25*1024*1024)throw problem('Invalid image scene size.');
  const bytes=fs.readFileSync(file);
  const type=bytes.subarray(0,4).equals(Buffer.from([0x89,0x50,0x4e,0x47]))?'.png':
    bytes[0]===255&&bytes[1]===216?'.jpg':
    bytes.subarray(0,4).toString('ascii')==='RIFF'&&bytes.subarray(8,12).toString('ascii')==='WEBP'?'.webp':null;
  if(!type||path.extname(file).toLowerCase()!==type)throw problem('Image scene extension or signature is not valid.');
  return {sha256:sha(bytes),bytes:bytes.length};
}
function loadReceipt(dir,index,key){
  const target=path.join(dir,`scene-${String(index+1).padStart(2,'0')}.receipt.json`);
  try{
    const value=JSON.parse(fs.readFileSync(target,'utf8'));
    if(value.schema!==1||value.requestKey!==key)return null;
    if(!new RegExp(`^scene-${String(index+1).padStart(2,'0')}\\.(?:png|jpg|webp)$`).test(value.file))return null;
    const file=path.join(dir,value.file);
    if(fs.lstatSync(file).isSymbolicLink()||!fs.realpathSync(file).startsWith(fs.realpathSync(dir)+path.sep))return null;
    const check=verifiedImage(file);
    if(check.sha256!==value.sha256||check.bytes!==value.bytes)return null;
    return {...value,file};
  }catch{return null;}
}
/**
 * @param {object} input
 * @param {string} input.dir - Owned job workspace, not public uploads.
 * @param {number} input.index - Scene index, 0..99.
 * @param {object} input.request - All inputs materially changing image generation.
 * @param {(output:string)=>Promise<object>} input.generate - Existing image router.
 */
async function imageSceneCore({dir,index,request,generate}){
  if(typeof dir!=='string'||!path.isAbsolute(dir)||!Number.isInteger(index)||index<0||index>99||!request||typeof request.prompt!=='string'||!request.prompt.trim()||typeof generate!=='function')throw problem('Invalid image task scene.');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const requestKey=sha(JSON.stringify({index,request}));
  const cached=loadReceipt(dir,index,requestKey);
  if(cached)return {made:{file:cached.file,bytes:cached.bytes,provider:cached.provider,model:cached.model,connectionId:cached.connectionId,connectionName:cached.connectionName,attempts:cached.attempts,revisedPrompt:cached.revisedPrompt},resumed:true};
  const base=`scene-${String(index+1).padStart(2,'0')}`;
  const intended=path.join(dir,base+'.png');
  const made=await generate(intended);
  if(!made||typeof made.file!=='string')throw problem('Image provider did not return a file path.');
  const realDir=fs.realpathSync(dir),realFile=fs.realpathSync(made.file);
  if(!realFile.startsWith(realDir+path.sep)||!new RegExp(`^${base}\\.(?:png|jpg|webp)$`).test(path.basename(realFile)))throw problem('Image provider did not write into the owned scene directory.');
  const verified=verifiedImage(realFile);
  const data={schema:1,requestKey,file:path.basename(realFile),sha256:verified.sha256,bytes:verified.bytes,
    provider:String(made.provider||''),model:String(made.model||''),connectionId:made.connectionId||null,connectionName:made.connectionName||null,
    revisedPrompt:made.revisedPrompt||null,attempts:Array.isArray(made.attempts)?made.attempts:[]};
  const receipt=path.join(dir,base+'.receipt.json'),temp=receipt+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(temp,JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});fs.renameSync(temp,receipt);}finally{fs.rmSync(temp,{force:true});}
  return {made:{...made,file:realFile,bytes:verified.bytes},resumed:false};
}

// Concurrent retries of the same task/scene must not race two image API
// calls. Different prompts for the same scene cannot overwrite each other.
const inFlight=new Map();
export async function imageSceneOnce(args){
  const id=path.resolve(String(args?.dir||'.'))+'#'+String(args?.index);
  const signature=sha(JSON.stringify({index:args?.index,request:args?.request}));
  const current=inFlight.get(id);
  if(current){
    if(current.signature!==signature)throw Object.assign(new Error('Scene đang tạo với yêu cầu khác. Đợi tác vụ hiện tại kết thúc.'),{code:'IMAGE_SCENE_BUSY'});
    return {...await current.promise,joinedInflight:true};
  }
  const promise=imageSceneCore(args);
  inFlight.set(id,{signature,promise});
  try{return await promise;}finally{if(inFlight.get(id)?.promise===promise)inFlight.delete(id);}
}
