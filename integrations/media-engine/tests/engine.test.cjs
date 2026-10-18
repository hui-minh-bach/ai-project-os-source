'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {within}=require('../src/utils.cjs');const subs=require('../src/subtitles.cjs');
const timeline=require('../src/timeline.cjs'),story=require('../src/story.cjs'),concat=require('../src/concat.cjs');
const {Publisher}=require('../src/publisher.cjs');const {registerMediaEngine}=require('../index.cjs');const {makeLocalPorts}=require('../adapters/local-ports.cjs');
test('subtitle round-trip and word edits',()=>{const input=[{id:'1',start:0,end:1.23,text:'Xin chào'},{id:'2',start:1.24,end:3,text:'Việt Nam'}];assert.match(subs.srt(input),/00:00:01,230/);assert.match(subs.vtt(input),/WEBVTT/);assert.equal(subs.parseSrt(subs.srt(input))[1].text,'Việt Nam');assert.equal(subs.edit(input,[{id:'1',text:'Chào bạn'}])[0].text,'Chào bạn');assert.throws(()=>subs.normalize([{start:2,end:1,text:'x'}]));});
test('source workspace traversal blocked',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'media-safe-'));try{assert.throws(()=>within(dir,'../not-in-workspace'),e=>e.code==='FORBIDDEN_PATH');}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('edit plan checks bounds, ratios and time',()=>{const media={path:'/tmp/source.mp4',seconds:6};const p=timeline.validate({kind:'edit',ratio:'9:16',segments:[{start:1,end:3}]},media);assert.equal(p.height,1280);assert.throws(()=>timeline.validate({kind:'edit',ratio:'16:9',segments:[{start:3,end:8}]},media));});
test('original story text is preserved when split',()=>{const input='Một ngày bình yên. Cánh đồng vàng dưới nắng. Mẹ gọi em về.';assert.equal(story.scenes(input,40).join(' '),input);assert.ok(story.characters('Ông Lâm gặp bà Mai.').length>=1);});
test('publishing blocked without approval or official OAuth',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'media-publish-'));try{const video=path.join(dir,'x.mp4');fs.writeFileSync(video,'video');const p=new Publisher(dir),draft=p.createDraft({channel:'youtube',title:'safe',video});const published=await p.publish(draft.id);assert.equal(published.status,'BLOCKED');assert.equal(p.state.publishKeys.length,0);}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('Concat public bind rejected',async()=>{await assert.rejects(()=>concat.probe({host:'0.0.0.0',token:'pass'}),e=>e.code==='FORBIDDEN_NETWORK');});
test('registers only media task names with CoreServices ports',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'media-ports-'));try{const ports=makeLocalPorts(root);const module=registerMediaEngine({CoreServices:ports,workspace:root});assert.equal(module.taskNames.length,8);assert.deepEqual([...ports._test.handlers.keys()],module.taskNames);assert.equal(module.status.v10,'BLOCKED');}finally{fs.rmSync(root,{recursive:true,force:true})}});
test('Concat loopback authentication + version JSON-RPC parser with local stub',async()=>{
 const net=require('node:net'),server=net.createServer(sock=>{let buf='';sock.on('data',b=>{buf+=b.toString('utf8');let n;while((n=buf.indexOf('\n'))>=0){const msg=JSON.parse(buf.slice(0,n));buf=buf.slice(n+1);if(msg.method==='auth')sock.write(JSON.stringify({jsonrpc:'2.0',id:0,result:{authenticated:true}})+'\n');if(msg.method==='version')sock.write(JSON.stringify({jsonrpc:'2.0',id:1,result:{version:'test-stub',capabilities:['json-rpc']}})+'\n');}})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const got=await concat.probe({port:server.address().port,host:'127.0.0.1',token:'unit-token'});assert.equal(got.version,'test-stub');}
 finally{await new Promise(resolve=>server.close(resolve));}
});
test('publisher uses one idempotency key for only one authorized upload',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'media-publish-id-'));try{const vid=path.join(dir,'x.mp4');fs.writeFileSync(vid,'mock');const p=new Publisher(dir),draft=p.createDraft({channel:'youtube',title:'test',video:vid,rights:'own'});p.approve(draft.id);let calls=0;
 const opt={enabled:true,oauth:{accessToken:'only-local-test'},verifiedApi:true,apiAdapter:{uploadOfficial:async()=>{calls++;return {id:'mock-test'}}}};
 assert.equal((await p.publish(draft.id,opt)).status,'PUBLISHED');assert.equal((await p.publish(draft.id,opt)).status,'ALREADY_SUBMITTED');assert.equal(calls,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('SRT flattens internal paragraph breaks into one timestamped caption',()=>{
 const text=subs.srt([{start:0,end:2,text:'Chương mở đầu\n\nĐây là câu văn.'}]);assert.match(text,/Chương mở đầu Đây là câu văn/);assert.equal(subs.parseSrt(text).length,1);
});
