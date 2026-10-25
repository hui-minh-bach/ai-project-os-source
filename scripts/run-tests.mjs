/** App tests only. Bundled third-party skill/repo tests are never auto-executed. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {spawn} from 'node:child_process';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8')).version.replaceAll('.','');
const out=path.join(ROOT,'evidence/v'+version+'/regression');fs.mkdirSync(out,{recursive:true});
const dirs=['test','integrations/ai-core/tests','integrations/media-engine/tests'];
const modules=dirs.flatMap(dir=>fs.readdirSync(path.join(ROOT,dir)).filter(n=>/\.test\.(?:mjs|cjs)$/.test(n)).map(n=>dir+'/'+n)).sort();
const results=[];let index=0;
function logName(name){return 'module-'+name.replaceAll('/','_')+'.log';}
async function run(module){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'aios-app-test-')),copy=path.join(temp,'app');const started=Date.now();
 const filter=source=>{const rel=path.relative(ROOT,source).split(path.sep).join('/');return !rel.split('/').some(n=>['.data','backups','.git','node_modules','__pycache__'].includes(n))&&!rel.startsWith('vendor/repo-snapshots')&&!/^evidence\/v097[0-9]/.test(rel);};
 fs.cpSync(ROOT,copy,{recursive:true,filter});const env={...process.env,AIOS_TEST_ISOLATION:'1'};delete env.AI_PROJECT_OS_DATA_DIR;delete env.AI_PROJECT_OS_BACKUP_DIR;
 let text='',timedOut=false;
 const result=await new Promise(resolve=>{const child=spawn(process.execPath,['--test','--test-reporter=spec',module],{cwd:copy,env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']});
  const kill=()=>{try{if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});else process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}};
  const timer=setTimeout(()=>{timedOut=true;kill();},90000);const append=b=>{text+=b.toString();if(text.length>4_000_000){timedOut=true;kill();}};
  child.stdout.on('data',append);child.stderr.on('data',append);child.on('error',e=>{clearTimeout(timer);resolve({module,status:'fail',error:e.message});});child.on('close',code=>{clearTimeout(timer);resolve({module,status:timedOut?'timeout':code===0?'pass':'fail',exitCode:code,seconds:+((Date.now()-started)/1000).toFixed(2),log:logName(module)});});
 });
 fs.writeFileSync(path.join(out,logName(module)),text);fs.rmSync(temp,{recursive:true,force:true,maxRetries:4,retryDelay:100});return result;
}
async function worker(){while(index<modules.length){const module=modules[index++];const result=await run(module);results.push(result);process.stdout.write(result.status.toUpperCase()+' '+module+'\n');}}
await Promise.all([worker(),worker()]);results.sort((a,b)=>a.module.localeCompare(b.module));const counts={tests:0,pass:0,fail:0,skipped:0,cancelled:0};for(const row of results){const log=fs.readFileSync(path.join(out,logName(row.module)),'utf8');for(const key of Object.keys(counts)){const values=[...log.matchAll(new RegExp('(?:ℹ |# )'+key+' (\\d+)','g'))];if(values.length)counts[key]+=Number(values.at(-1)[1]);}}
const summary={schema:1,modules:results.length,passedModules:results.filter(r=>r.status==='pass').length,counts,results,scope:'Separate clean source copy per app test module; third-party source and skill tests excluded'};fs.writeFileSync(path.join(out,'final-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({modules:summary.modules,passedModules:summary.passedModules,counts}));if(results.some(r=>r.status!=='pass'))process.exitCode=1;
