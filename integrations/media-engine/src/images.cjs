'use strict';
const zlib=require('node:zlib');
const {fs,sha,mkdir}=require('./utils.cjs');
// Deterministic procedural art, NOT an AI-generated image. Offline fallback only.
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0;}
function chunk(type,body){const tag=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(body.length);crc.writeUInt32BE(crc32(Buffer.concat([tag,body])));return Buffer.concat([len,tag,body,crc]);}
function createPng(file,{width=1280,height=720,seed='village',scene=0}={}){
 // Deterministic procedural illustration v2: layered flat-art scenes with a
 // graded sky, sun/moon with glow, clouds or stars, three ridge lines, tree
 // silhouettes, an occasional house with a lit window, film grain and a
 // vignette. Still NOT an AI image — labelled procedural-offline-non-ai.
 let rs=parseInt(sha(seed+':'+scene).slice(0,8),16)>>>0;
 const rnd=()=>{rs=(rs*1664525+1013904223)>>>0;return rs/4294967296;};
 const moods=[
  {sky:[[24,32,64],[58,62,102],[112,86,110]],orb:[250,203,130],orbY:.26,stars:.35,front:[10,30,34],mid:[17,46,50],back:[27,60,64]},
  {sky:[[66,120,178],[120,172,214],[178,214,232]],orb:[255,240,190],orbY:.2,stars:0,front:[24,66,52],mid:[36,88,66],back:[54,110,84]},
  {sky:[[38,36,78],[104,62,104],[196,110,84]],orb:[252,176,110],orbY:.34,stars:.12,front:[12,28,36],mid:[22,44,50],back:[34,60,60]},
  {sky:[[8,12,32],[16,24,54],[28,40,74]],orb:[232,238,248],orbY:.22,stars:1,front:[6,16,22],mid:[10,26,32],back:[16,36,44]},
  {sky:[[30,58,52],[62,102,80],[110,150,104]],orb:[246,226,160],orbY:.24,stars:.05,front:[10,32,28],mid:[18,50,42],back:[28,70,56]},
  {sky:[[40,84,120],[86,140,178],[150,196,214]],orb:[255,244,200],orbY:.3,stars:0,front:[16,52,66],mid:[26,76,88],back:[40,102,110]},
 ];
 const M=moods[scene%moods.length];
 const lerp=(a,b,t)=>a+(b-a)*t;
 const skyAt=y=>{const t=y/height;const c=t<.55?M.sky[0].map((v,i)=>lerp(v,M.sky[1][i],t/.55)):M.sky[1].map((v,i)=>lerp(v,M.sky[2][i],(t-.55)/.45));return c;};
 const orbX=width*(.68+.14*rnd()),orbY=height*M.orbY,orbR=height*.075;
 const clouds=[];for(let i=0;i<7;i++)clouds.push({x:rnd()*width,y:height*(.06+rnd()*.24),r:width*(.05+rnd()*.09),s:.10+rnd()*.12});
 const ridge=(base,amp,f1,f2)=>{const p1=rnd()*6.28,p2=rnd()*6.28,arr=new Float32Array(width);for(let x=0;x<width;x++){arr[x]=base+amp*Math.sin(x/width*f1+p1)+amp*.5*Math.sin(x/width*f2+p2);}return arr;};
 const rBack=ridge(height*.6,height*.05,3.1,7.3),rMid=ridge(height*.72,height*.045,4.2,9.1),rFront=ridge(height*.85,height*.04,5.3,11.7);
 const trees=[];for(let i=0;i<26;i++){const x=Math.floor(rnd()*width);trees.push({x,y:rMid[x],s:height*(.02+rnd()*.03)});}
 const house=scene%3===0?{x:width*(.12+rnd()*.2),w:width*.075,h:height*.075}:null;
 const raw=Buffer.alloc((width*3+1)*height);
 for(let y=0;y<height;y++){
  let row=y*(width*3+1);raw[row++]=0;
  const sky=skyAt(y);
  for(let x=0;x<width;x++){
   let col;
   if(y<rBack[x]){col=[sky[0],sky[1],sky[2]];
    const dO=Math.hypot(x-orbX,y-orbY);
    if(dO<orbR)col=[M.orb[0],M.orb[1],M.orb[2]];
    else if(dO<orbR*3.2){const g=Math.pow(1-(dO-orbR)/(orbR*2.2),2)*.5;col=col.map((v,i)=>Math.min(255,v+(M.orb[i]-v)*g));}
    if(!M.stars){let cl=0;for(const c of clouds){const d=Math.hypot((x-c.x)/1.9,y-c.y);if(d<c.r)cl+=c.s*(1-d/c.r);}if(cl>0)col=col.map(v=>Math.min(255,v+70*Math.min(1,cl)));}
   }
   else if(y<rMid[x])col=M.back;else if(y<rFront[x])col=M.mid;else col=M.front;
   // tree silhouettes standing on the middle ridge
   for(const t of trees){const dx=x-t.x;if(Math.abs(dx)<t.s*.5&&y<t.y&&y>t.y-t.s*2.2){const half=t.s*(0.5-(t.y-y)/(t.s*2.6));if(Math.abs(dx)<half+t.s*.06)col=[8,20,20];}}
   // house on the front ridge: body, triangle roof narrowing upward, and a
   // lit window drawn last so nothing paints over it
   if(house){const hx0=house.x-house.w/2,hx1=house.x+house.w/2;
    let hy=-1;for(let gx=Math.max(0,Math.floor(hx0));gx<Math.min(width,Math.ceil(hx1));gx++)hy=Math.max(hy,rFront[gx]);hy+=6;
    const roofH=house.h*.55,apexY=hy-house.h-roofH;
    if(x>hx0&&x<hx1&&y<=hy&&y>hy-house.h)col=[10,16,20];
    if(y<=hy-house.h&&y>apexY){const t=(y-apexY)/roofH;const half=(house.w/2+7)*t;if(Math.abs(x-house.x)<half)col=[8,13,17];}
    if(Math.abs(x-house.x)<house.w*.15&&y<hy-house.h*.3&&y>hy-house.h*.68)col=[250,196,96];}
   const vig=1-.22*Math.pow(Math.hypot((x-width/2)/(width/2),(y-height/2)/(height/2)),2)*.5;
   const gr=(rnd()-.5)*9;
   raw[row++]=Math.max(0,Math.min(255,col[0]*vig+gr));raw[row++]=Math.max(0,Math.min(255,col[1]*vig+gr));raw[row++]=Math.max(0,Math.min(255,col[2]*vig+gr));
  }
 }
 // stars as a post-pass (bright pixels + a few sparkle crosses) in the sky
 if(M.stars>0){const n=Math.floor(240*M.stars);for(let i=0;i<n;i++){const x=Math.floor(rnd()*width),y=Math.floor(rnd()*height*.5);if(y>=rBack[x])continue;const b=.45+rnd()*.55;const set=(xx,yy,f)=>{if(xx<0||yy<0||xx>=width||yy>=height)return;const o=yy*(width*3+1)+1+xx*3;raw[o]=Math.min(255,raw[o]+180*f*b);raw[o+1]=Math.min(255,raw[o+1]+190*f*b);raw[o+2]=Math.min(255,raw[o+2]+210*f*b);};set(x,y,1);if(rnd()>.8){set(x-1,y,.4);set(x+1,y,.4);set(x,y-1,.4);set(x,y+1,.4);}}}
 const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);head[8]=8;head[9]=2;
 mkdir(require('node:path').dirname(file));fs.writeFileSync(file,Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(raw,{level:6})),chunk('IEND',Buffer.alloc(0))]));return file;
}
async function illustration({gateway,description,characterSheet,output,offline=true,scene=0}){
 if(!offline&&gateway?.invoke){
   try{
     const result=await gateway.invoke({capability:'image.generate',input:{description,characterSheet,output}});
     if(result?.path&&fs.existsSync(result.path))return {path:result.path,origin:'provider'};
   }catch{/* provider unavailable: fall through to the procedural fallback */}
 }
 return {path:createPng(output,{seed:characterSheet||description,scene}),origin:'procedural-offline-non-ai'};
}
module.exports={createPng,illustration};
