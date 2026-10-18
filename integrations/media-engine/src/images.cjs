'use strict';
const zlib=require('node:zlib');
const {fs,sha,mkdir}=require('./utils.cjs');
// Deterministic procedural art, NOT an AI-generated image. Offline fallback only.
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
function chunk(type,body){const tag=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,body])));return Buffer.concat([len,tag,body,crc]);}
function createPng(file,{width=960,height=540,seed='village',scene=0}={}){
 const colors=[[19,34,62],[29,65,87],[45,73,78],[70,71,89]][scene%4],raw=Buffer.alloc((width*3+1)*height);
 const rng=parseInt(sha(seed+scene).slice(0,8),16),hill1=height*.67,hill2=height*.77;
 for(let y=0;y<height;y++){
  let row=y*(width*3+1);raw[row++]=0;
  for(let x=0;x<width;x++){
   const sunX=width*.78,sunY=height*.24,dist=Math.hypot(x-sunX,y-sunY),sun=dist<height*.085;
   const h1=hill1-32*Math.sin(x/width*Math.PI*2+(rng%17)),h2=hill2-24*Math.cos(x/width*Math.PI*3);
   const col=sun?[245,194,116]:y>h2?[12,39,39]:y>h1?[22,55,59]:[
       Math.min(255,colors[0]+y/height*65),
       Math.min(255,colors[1]+y/height*57),
       Math.min(255,colors[2]+y/height*42)];
   raw[row++]=col[0];raw[row++]=col[1];raw[row++]=col[2];
  }
 }
 const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;
 mkdir(require('node:path').dirname(file));fs.writeFileSync(file,Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]));return file;
}
async function illustration({gateway,description,characterSheet,output,offline=true,scene=0}){
 if(!offline&&gateway?.invoke){
   const result=await gateway.invoke({capability:'image.generate',input:{description,characterSheet,output}});
   if(result?.path&&fs.existsSync(result.path))return {path:result.path,origin:'provider'};
   throw new Error('Image provider did not return a real file');
 }
 return {path:createPng(output,{seed:characterSheet||description,scene}),origin:'procedural-offline-non-ai'};
}
module.exports={createPng,illustration};
