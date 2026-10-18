import fs from 'node:fs';
import path from 'node:path';
import { ask } from './providers.mjs';
import { safeResolve } from './workspace.mjs';
import { runNpm } from './sandbox.mjs';
import { skillPrompt, skillTaskContext } from './skills.mjs';
import { redactVaultSecrets, createVaultSecretRedactor } from './vault.mjs';
import crypto from 'node:crypto';

function parseTool(text){
  const raw=String(text||'').trim();
  const candidates=[raw];
  for(const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi))candidates.push(m[1].trim());
  for(const c of candidates){try{const j=JSON.parse(c);if(j?.tool)return j;}catch{}}
  for(let i=0;i<raw.length;i++){
    if(raw[i]!=='{')continue;let depth=0,inStr=false,esc=false;
    for(let j=i;j<raw.length;j++){
      const ch=raw[j];if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch==='"')inStr=false;continue;}if(ch==='"'){inStr=true;continue;}if(ch==='{')depth++;else if(ch==='}')depth--;if(depth===0){try{const obj=JSON.parse(raw.slice(i,j+1));if(obj?.tool)return obj;}catch{}break;}
    }
  }
  return null;
}
function packageScripts(root){
  const file=safeResolve(root,'package.json');if(!fs.existsSync(file))return [];
  const scripts=JSON.parse(fs.readFileSync(file,'utf8')).scripts||{};
  return Object.keys(scripts).filter(s=>/^[a-zA-Z0-9:_-]{1,80}$/.test(s)&&typeof scripts[s]==='string');
}
function unavailableTest(mode,reason,status='NOT_RUN'){
  const at=new Date().toISOString();return {id:crypto.randomUUID(),source:'runtime',kind:'test',command:null,script:null,mode,status,exitCode:null,startedAt:null,completedAt:at,durationMs:0,timedOut:false,reason,stdout:'',stderr:''};
}
export async function runTaskTests({root,sandboxMode='safe'}){
  let scripts;try{scripts=packageScripts(root);}catch(e){return unavailableTest(sandboxMode,'Không đọc được package/test script: '+redactVaultSecrets(e.message),'ERROR');}
  if(!scripts.includes('test'))return unavailableTest(sandboxMode,'Không có package.json với test script; test chưa chạy.');
  return (await runNpm(root,'test',{mode:sandboxMode})).receipt;
}
function localSnapshot(root,{maxFiles=45,maxBytes=150000}={}){const out=[];let used=0;function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(out.length>=maxFiles||used>=maxBytes)return;if(e.isSymbolicLink())continue;if(['node_modules','.git','.next','dist','build','.turbo','coverage'].includes(e.name))continue;let p;try{p=safeResolve(root,path.relative(root,path.join(dir,e.name)).replaceAll('\\','/'),true)}catch{continue}if(e.isDirectory())walk(p);else{let b;try{b=fs.readFileSync(p)}catch{continue}if(b.includes(0))continue;const rel=path.relative(root,p).replaceAll('\\','/');const text=b.toString('utf8').slice(0,Math.max(0,maxBytes-used));used+=Buffer.byteLength(text);out.push({path:rel,content:text});}}}walk(root);return out;}
function toolHelp(scripts,sandboxMode){return `\nTOOLS — output exactly ONE JSON object on one line, no markdown fence:\n`+
`{"tool":"list","path":"."}\n{"tool":"read","path":"relative/file"}\n{"tool":"write","path":"relative/file","content":"complete file"}\n{"tool":"patch","path":"relative/file","find":"exact text","replace":"replacement"}\n`+
(scripts.length&&sandboxMode!=='safe'?`{"tool":"run_npm","script":"${scripts[0]}"}  // allowed: ${scripts.join(', ')}\n`:'')+
`{"tool":"workspace_snapshot"}\n{"tool":"done","summary":"what changed and what remains"}\nNever access .env, .git, node_modules, absolute paths or .. . Do not invent test results.`;}

async function execute(root,req,sandboxMode){
  if(req.tool==='list'){
    const p=safeResolve(root,req.path||'.',true);const names=fs.readdirSync(p,{withFileTypes:true}).filter(x=>{if(['.git','node_modules','.next','dist','build'].includes(x.name)||x.isSymbolicLink())return false;try{safeResolve(root,path.relative(root,path.join(p,x.name)),true);return true;}catch{return false;}}).slice(0,180);
    return {text:names.map(x=>(x.isDirectory()?'[D] ':'[F] ')+x.name).join('\n'),status:'SUCCESS'};
  }
  if(req.tool==='read'){const p=safeResolve(root,req.path);const b=fs.readFileSync(p);if(b.length>220000)throw new Error('File quá lớn để đọc trong agent loop.');return {text:b.toString('utf8'),status:'SUCCESS'};}
  if(req.tool==='write'){const p=safeResolve(root,req.path);const content=String(req.content??'');if(Buffer.byteLength(content)>350000)throw new Error('File quá lớn.');fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content,'utf8');return {text:'written '+req.path,status:'SUCCESS'};}
  if(req.tool==='patch'){const p=safeResolve(root,req.path),s=fs.readFileSync(p,'utf8'),find=String(req.find??'');if(!find||!s.includes(find))throw new Error('Không tìm thấy đoạn cần patch.');fs.writeFileSync(p,s.replace(find,String(req.replace??'')),'utf8');return {text:'patched '+req.path,status:'SUCCESS'};}
  if(req.tool==='run_npm'){
    if(sandboxMode!=='safe'&&!packageScripts(root).includes(req.script))return {text:'NOT_RUN: npm script không được phép.',status:'NOT_RUN',receipt:unavailableTest(sandboxMode,'npm script không có trong package.json; command chưa chạy.')};
    const r=await runNpm(root,req.script,{mode:sandboxMode});return {text:JSON.stringify(r.receipt),status:r.receipt.status,receipt:r.receipt};
  }
  if(req.tool==='workspace_snapshot')return {text:localSnapshot(root,{maxFiles:55,maxBytes:160000}).map(f=>`--- ${f.path}\n${f.content}`).join('\n').slice(0,170000),status:'SUCCESS'};
  if(req.tool==='done')return {text:String(req.summary||''),status:'DONE'};
  throw new Error('Tool không hỗ trợ: '+req.tool);
}

function boundedPrompt(messages,maxChars=520000){
  if(!messages.length)return '';
  const first=messages[0];
  const tail=messages.slice(1).slice(-10);
  const selected=[first,...tail];
  let used=0;const parts=[];
  for(let i=selected.length-1;i>=0;i--){
    const m=selected[i];
    let body=String(m.content||'');
    const budget=Math.max(0,maxChars-used);
    if(!budget)break;
    if(body.length>budget)body=body.slice(body.length-budget);
    parts.unshift(`[${i+1}] ${m.role.toUpperCase()}\n${body}`);
    used+=body.length;
  }
  return parts.join('\n\n');
}

export async function runNativeTask({root,workerId,spec,task,skills=[],maxTurns=18,sandboxMode='safe',extraContext='',assertCurrent=()=>{},onEvent=()=>{}}){
  const redact=createVaultSecretRedactor();
  let scripts=[];try{scripts=packageScripts(root);}catch{}
  const initial=localSnapshot(root,{maxFiles:28,maxBytes:100000}).map(f=>`--- ${f.path}\n${f.content}`).join('\n');
  const system='Bạn là coding worker trong AI Project OS Local. Làm thay đổi nhỏ, đúng task, giữ tương thích, không đọc secret. '+toolHelp(scripts,sandboxMode);
  const messages=[{role:'user',content:`SPEC:\n${spec}\n\nTASK:\n${JSON.stringify(skillTaskContext(task))}\n\nEXTRA CONTEXT:\n${extraContext||'(none)'}\n\nWORKSPACE BAN ĐẦU:\n${initial||'(trống)'}`}],log=[],testReceipts=[];
  const emit=entry=>{const sanitized=JSON.parse(redact(JSON.stringify({at:new Date().toISOString(),...entry})));log.push(sanitized);if(sanitized.receipt)testReceipts.push(sanitized.receipt);onEvent(sanitized);};
  try{
    for(let turn=0;turn<maxTurns;turn++){
      assertCurrent();const prompt=boundedPrompt(messages),startedAt=new Date().toISOString(),started=performance.now();let answer;
      emit({kind:'agent-request',turn:turn+1,status:'WAITING',startedAt});
      try{answer=await ask(workerId,{usageContext:{role:'worker'},system:system+skillPrompt(skills,{role:'worker'}),prompt});}catch(e){emit({kind:'agent',turn:turn+1,status:'ERROR',startedAt,durationMs:Math.round(performance.now()-started),error:e.message});throw e;}
      emit({kind:'agent',turn:turn+1,status:'RECEIVED',startedAt,durationMs:Math.round(performance.now()-started),answer});assertCurrent();messages.push({role:'assistant',content:answer});
      const req=parseTool(answer);if(!req){emit({kind:'tool',turn:turn+1,tool:'parse',status:'INVALID',output:'Không có tool JSON hợp lệ.'});messages.push({role:'user',content:'Hãy dùng đúng một tool JSON hoặc done.'});continue;}
      assertCurrent();const toolStartedAt=new Date().toISOString(),toolStarted=performance.now();let out;
      try{out=await execute(root,req,sandboxMode);}catch(e){out={text:'ERROR: '+redactVaultSecrets(e.message),status:'ERROR'};}
      emit({kind:'tool',turn:turn+1,tool:req.tool,path:req.path||'',script:req.script||'',sandbox:sandboxMode,status:out.status,startedAt:toolStartedAt,durationMs:Math.round(performance.now()-toolStarted),output:out.text,receipt:out.receipt||null});assertCurrent();
      if(out.status==='DONE')return {summary:redact(out.text),log,testReceipts};
      messages.push({role:'user',content:`Tool result:\n${redact(out.text)}`});
    }
    throw new Error('Native agent vượt quá số lượt cho phép.');
  }catch(e){e.agentLog=log;e.testReceipts=testReceipts;throw e;}
}

export async function reviewNativeTask({reviewerId,spec,task,diff,testReceipts=[],skills=[],assertCurrent=()=>{}}){
  assertCurrent();
  // The Reviewer is stateless: no Worker conversation, answers or prior opinion.
  const prompt=`SPEC:\n${spec}\n\nTASK:\n${JSON.stringify(skillTaskContext(task))}\n\nGIT DIFF:\n${String(diff||'').slice(0,150000)||'(none)'}\n\nTRUSTED RUNTIME RECEIPTS:\n${JSON.stringify(testReceipts)}`;
  const system='Bạn là senior reviewer độc lập. Kiểm correctness, regression, secret exposure, path/security, acceptance criteria. Chỉ receipt source runtime có exitCode/status mới là bằng chứng command/test. NOT_RUN hoặc BLOCKED không phải PASS. Không suy acceptance từ summary. Trả JSON thuần {"approved":true|false,"summary":"...","risks":["..."],"fixes":["..."]}. Có thể thêm "acceptance":[{"criterionId":"AC1","met":true|false,"explanation":"bằng chứng cụ thể trong diff hoặc receipt"}] khi đã kiểm từng tiêu chí. approved/met phải là boolean.'+skillPrompt(skills,{role:'reviewer'});
  const startedAt=new Date().toISOString(),started=performance.now(),raw=await ask(reviewerId,{usageContext:{role:'reviewer'},system,prompt}),base={startedAt,completedAt:new Date().toISOString(),durationMs:Math.round(performance.now()-started),raw:redactVaultSecrets(raw)};
  const invalid=summary=>({...base,approved:false,status:'REJECTED',summary,risks:[raw.slice(0,1000)],fixes:[],acceptance:[]});
  try{
    const j=JSON.parse(String(raw).trim());if(!j||typeof j!=='object'||Array.isArray(j)||typeof j.approved!=='boolean')return invalid('Reviewer cần JSON hợp lệ với approved là boolean.');
    return {...base,approved:j.approved===true,status:j.approved===true?'APPROVED':'REJECTED',summary:String(j.summary||'').slice(0,4000),risks:Array.isArray(j.risks)?j.risks.map(String).slice(0,20):[],fixes:Array.isArray(j.fixes)?j.fixes.map(String).slice(0,20):[],acceptance:Array.isArray(j.acceptance)?j.acceptance.filter(c=>typeof c?.criterionId==='string'&&typeof c.met==='boolean'&&typeof c.explanation==='string'&&c.explanation.trim()).slice(0,20).map(c=>({criterionId:c.criterionId,met:c.met,explanation:c.explanation.slice(0,2000)})):[]};
  }catch{return invalid('Reviewer không trả JSON thuần hợp lệ.');}
}
