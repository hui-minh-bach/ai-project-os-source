'use strict';
// A3 offline smoke: real on-disk HTML/JS and Markdown. NO AI-generated claim and NO publication.
const {fs,path,crypto}=require('../common.cjs');
const os=require('node:os');
const {createCore}=require('../core.cjs');
const output=path.resolve(process.argv[2]||path.join(os.tmpdir(),'ai-core-a08-local-outcomes'));
if(fs.existsSync(output)&&fs.readdirSync(output).length)throw new Error('Output must be an empty directory; never overwrite customer work.');
fs.mkdirSync(output,{recursive:true});
const core=createCore({root:path.join(output,'core-internal'),concurrency:2});
(async()=>{
 try{
  const website=core.outcomes.websiteDraft({projectId:'demo-site',approved:true,files:[
   {path:'index.html',content:'<!doctype html><html lang="vi"><meta charset="utf-8"><title>Local AI Project OS A Demo</title><main><h1>Local preview</h1><p>Verified source, not deployed.</p></main></html>'},
   {path:'app.js',content:'module.exports = {health:()=>"local-ready"};'}
  ]});
  const content=core.outcomes.contentDraft({projectId:'demo-content',approved:true,title:'A Core local content draft',sections:[{heading:'Provenance',text:'This is authored test content, not a researched claim.',sources:['https://example.org/']} ]});
  await core.queue.drain();
  for(const x of [website,content])if(core.state.find(x.taskId).state!=='completed')throw new Error('Local verifier did not approve '+x.taskId);
  const files=[['demo-site',website,'index.html','text/html'],['demo-site',website,'app.js','text/javascript'],['demo-content',content,'content-pack.md','text/markdown']];
  const receipts=[];
  for(const [dir,t,file,mimeType] of files){
   const verified=core.outcomes.finalize(t.taskId,{fileName:file,mimeType});
   const bytes=core.artifacts.read(verified.artifactId);const dest=path.join(output,dir,file);
   fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});
   receipts.push({file:path.relative(output,dest),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,verified:true,origin:'test-fixture',remotePublished:false});
  }
  const report={results:'LOCAL_OUTCOMES_OK',source:'user-authored deterministic fixtures (not AI, not external preview)',artifacts:receipts};
  fs.writeFileSync(path.join(output,'A_LOCAL_OUTCOMES.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
 }finally{core.close();}
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
