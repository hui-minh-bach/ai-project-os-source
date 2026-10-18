'use strict';
const {run}=require('../src/utils.cjs');
(async()=>{for(const [name,args] of [['node',['--version']],['ffmpeg',['-version']],['ffprobe',['-version']],['espeak',['--version']]]){try{const r=await run(name,args,{timeoutMs:10000});console.log(name,'OK',(r.stdout||r.stderr).split('\n')[0]);}catch(e){console.log(name,'MISSING',e.message.slice(0,160));}}})().catch(e=>{console.error(e);process.exitCode=1});
