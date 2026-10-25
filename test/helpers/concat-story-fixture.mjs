/** TEST ONLY: Concat JSON-RPC protocol fixture. Final exporter here is FFmpeg,
 * not native Concat. Real files/streams let assertions detect missing media.
 * This helper is never loaded by the Windows launcher. */
import net from 'node:net';import fs from 'node:fs';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile);
function stamp(n){let ms=Math.round(n*1000);return [Math.floor(ms/3600000),Math.floor(ms/60000)%60,Math.floor(ms/1000)%60].map(n=>String(n).padStart(2,'0')).join(':')+','+String(ms%1000).padStart(3,'0');}
export async function storyConcatFixture({failFirst=false,dropFirstReply=false}={}){
 let seq=0,exports=0,created=0;const projects=new Map(),calls=[],sockets=new Set(),failures=[];
 const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));let buffer='';
  socket.on('data',bytes=>{buffer+=bytes.toString();let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);const q=JSON.parse(line);calls.push(q);
   const reply=result=>{if(!socket.destroyed)socket.write(JSON.stringify({jsonrpc:'2.0',id:q.id,result})+'\n');};const error=message=>{if(!socket.destroyed)socket.write(JSON.stringify({jsonrpc:'2.0',id:q.id,error:{code:-32001,message,data:{code:'invalid'}}})+'\n');};
   (async()=>{
    if(q.method==='auth'){if(q.params.token!=='fixture-concat-token')throw Error('bad token');return reply({});}
    if(q.method==='version')return reply({apiVersion:'0.2',concat:'0.2.7-PROTOCOL-FIXTURE-NOT-NATIVE'});
    if(q.method==='project.create'){const p=path.join(q.params.location,q.params.name);fs.mkdirSync(p,{recursive:true});projects.set(p,{video:q.params.video,imports:new Map(),clips:[],texts:[]});created++;return reply({});}
    const p=projects.get(q.params?.path);if(!p)throw Error('project not open');
    if(q.method==='media.import'){if(!fs.existsSync(q.params.file))throw Error('missing media');const id='m'+ ++seq;p.imports.set(id,q.params.file);return reply({createdId:id});}
    if(q.method==='edit.apply'){const cmd=q.params.command;if(cmd.op==='addClipAtFirstFree'){if(!p.imports.has(cmd.mediaId))throw Error('unknown media');const id='c'+ ++seq;p.clips.push({...cmd,id,file:p.imports.get(cmd.mediaId)});return reply({createdId:id});}
     if(cmd.op==='updateClip'){const clip=p.clips.find(c=>c.id===cmd.clipId);if(!clip)throw Error('unknown clip');Object.assign(clip,cmd.patch);return reply({});}
     if(cmd.op==='addTextClip'){if(!cmd.style.content||cmd.duration<=0||cmd.style.fontSize>1)throw Error('bad caption');const id='t'+ ++seq;p.texts.push({...cmd,id});return reply({createdId:id});}throw Error('unsupported edit '+cmd.op);}
    if(q.method==='project.save'){fs.writeFileSync(path.join(q.params.path,'fixture-timeline.json'),JSON.stringify({...p,imports:[...p.imports]},null,2));return reply({});}
    if(q.method==='project.close'){p.closed=true;return reply({});}
    if(q.method==='export.run'){
     exports++;const job='j'+exports;
     if(failFirst&&exports===1){reply({job});setImmediate(()=>socket.write(JSON.stringify({jsonrpc:'2.0',method:'export.failed',params:{job,error:'Fixture export failure'}})+'\n'));return;}
     const pictures=p.clips.filter(c=>path.basename(c.file).startsWith('scene-')).sort((a,b)=>a.start-b.start);const voice=p.clips.find(c=>path.basename(c.file)==='narration.wav');if(!pictures.length||!voice)throw Error('narration or pictures absent');
     const list=path.join(q.params.path,'fixture-video-list.txt');fs.writeFileSync(list,pictures.map(c=>"file '"+c.file.replace(/'/g,"'\\''")+"'").join('\n'));
     const subs=path.join(q.params.path,'fixture-captions.srt');const captions=p.texts.filter(t=>t.offsetY>0);fs.writeFileSync(subs,captions.map((c,i)=>`${i+1}\n${stamp(c.start)} --> ${stamp(c.start+c.duration)}\n${c.style.content}\n`).join('\n'));
     reply({job});await exec('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',list,'-i',voice.file,'-vf',`subtitles=${subs}`,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-threads','2','-preset','veryfast','-crf','24','-c:a','aac','-b:a','128k','-movflags','+faststart',q.params.output],{timeout:120000});
     if(dropFirstReply&&exports===1){socket.destroy();return;}
     if(!socket.destroyed)socket.write(JSON.stringify({jsonrpc:'2.0',method:'export.done',params:{job,output:q.params.output}})+'\n');return;
    }throw Error('unsupported method '+q.method);
   })().catch(e=>{failures.push(e.message);error(e.message);});
  }});
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {settings:{host:'127.0.0.1',port:server.address().port,token:'fixture-concat-token'},calls,projects,failures,get exports(){return exports},get created(){return created},close:()=>{for(const s of sockets)s.destroy();return new Promise(r=>server.close(r));}};
}
