'use strict';
const cp=require('node:child_process');
const {fs,path,fail,redact,uid,privateDir,contained,safeName}=require('./common.cjs');
// A workspace is not permission to read its credentials, Git metadata or private keys.
function allowWorkspacePath(rel){
 if(typeof rel!=='string'||!rel||rel.includes('\\')||rel.includes('\0'))throw fail('PATH_DENIED','Unsafe workspace path');
 const segments=rel.split('/').map(v=>v.toLowerCase());
 if(segments.some(seg=>!seg||seg==='.'||seg==='..'||/^(\.env(?:\..*)?|\.git|\.ssh|\.aws|\.azure|\.vercel|\.npmrc|\.netrc|node_modules|id_rsa.*|id_ed25519.*|.*\.(?:pem|key|p12|pfx|kdbx))$/.test(seg)))throw fail('PATH_DENIED','Credential and dependency paths are protected');
 return rel;
}
function binaryAvailable(name){try{const out=cp.spawnSync(name,['--version'],{timeout:2000,windowsHide:true,encoding:'utf8'});return !out.error&&out.status===0;}catch{return false;}}
function probeLocalFiles(root){
 const probe=path.join(root,'.ai-core-health-'+uid());
 try{fs.writeFileSync(probe,'AI_CORE_OK',{flag:'wx',mode:0o600});return fs.readFileSync(probe,'utf8')==='AI_CORE_OK';}
 catch{return false;}finally{fs.rmSync(probe,{force:true});}
}
class ToolRegistry{
 constructor({root}){this.root=privateDir(root);this.tools=new Map();this.installBuiltins();}
 register({name,description,run,approvalRequired=true}){safeName(name);if(this.tools.has(name)||typeof run!=='function')throw fail('TOOL_INVALID','Duplicate or non-executable tool');this.tools.set(name,{name,description:String(description||''),run,approvalRequired});}
 list(){return [...this.tools.values()].map(({name,description,approvalRequired})=>{const installed=name==='git_status'?binaryAvailable('git'):name==='node_check'?binaryAvailable(process.execPath):['file_read','file_write'].includes(name)?probeLocalFiles(this.root):null;return {name,description,approvalRequired,installed,status:installed===null?'unverified':installed?'available':'missing'};});}
 async call(name,args,permission){const t=this.tools.get(name);if(!t)throw fail('TOOL_MISSING','Tool is not installed');if(!permission||!Array.isArray(permission.allowedTools)||!permission.allowedTools.includes(name)||t.approvalRequired&&!permission.approved)throw fail('TOOL_DENIED','Tool not approved');safeName(permission.projectId);safeName(permission.workspaceId);const cwd=privateDir(path.join(this.root,permission.projectId,permission.workspaceId));return await t.run(args,cwd,permission);}
 installBuiltins(){this.register({name:'file_read',description:'Read a text file inside assigned workspace',approvalRequired:false,run:({path:rel},cwd)=>{const p=contained(cwd,allowWorkspacePath(rel)),s=fs.statSync(p);if(!s.isFile()||s.size>512000)throw fail('TOO_LARGE','File too large');return fs.readFileSync(p,'utf8');}});
 this.register({name:'file_write',description:'Write a text file inside assigned workspace',run:({path:rel,text},cwd)=>{if(typeof text!=='string'||Buffer.byteLength(text)>512000)throw fail('TOO_LARGE','Text too large');const file=contained(cwd,allowWorkspacePath(rel)),parent=path.dirname(file);privateDir(parent);const tmp=path.join(parent,'.ai-core-'+uid()+'.tmp');try{fs.writeFileSync(tmp,text,{flag:'wx',mode:0o600});contained(cwd,allowWorkspacePath(rel));fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}return {written:path.basename(file),bytes:Buffer.byteLength(text)};}});
 this.register({name:'git_status',description:'Read Git status for assigned worktree',approvalRequired:false,run:async(_,cwd)=>run('git',['status','--porcelain'],cwd)});
 this.register({name:'node_check',description:'Syntax-check JS file in assigned workspace',approvalRequired:false,run:async({path:rel},cwd)=>run(process.execPath,['--check',contained(cwd,allowWorkspacePath(rel))],cwd)});
 // No general shell tool. Allowlisted Git operations use execFile without shell.
 }
}
function run(program,args,cwd,timeout=15000){return new Promise((resolve,reject)=>{const child=cp.execFile(program,args,{cwd,timeout,windowsHide:true,maxBuffer:512000,env:{PATH:process.env.PATH,SYSTEMROOT:process.env.SYSTEMROOT,HOME:process.env.HOME,USERPROFILE:process.env.USERPROFILE}},(error,stdout,stderr)=>{if(error){const e=fail('PROCESS_FAILED',`${path.basename(program)} exited ${error.code||'error'}: ${redact(String(stderr)).slice(0,250)}`);return reject(e);}resolve({stdout,stderr});});child.stdin?.end();});}
class SkillRegistry{
 constructor(state,tools){this.state=state;this.tools=tools;}
 add({id,description,tools:need=[],instructions,enabled=false}){safeName(id);if(!Array.isArray(need)||need.some(n=>!this.tools.tools.has(n))||typeof instructions!=='string'||!instructions.trim())throw fail('SKILL_INVALID','Skill must reference installed tools and instructions');const item={id,description:String(description||''),tools:need,instructions,enabled:!!enabled};if(this.state.data.skills.some(s=>s.id===id))throw fail('SKILL_EXISTS','Skill exists');this.state.data.skills.push(item);this.state.persist();return {...item};}
 enable(id,enabled){const s=this.state.data.skills.find(s=>s.id===id);if(!s)throw fail('SKILL_MISSING','Skill not registered');s.enabled=enabled===true;this.state.persist();return {...s};}
 get(id){const s=this.state.data.skills.find(s=>s.id===id&&s.enabled);if(!s)throw fail('SKILL_DISABLED','Skill disabled or missing');for(const t of s.tools)if(!this.tools.tools.has(t))throw fail('SKILL_INVALID','Tool was removed');return {...s};}
}
// MCP is an explicit APPROVED adapter hook. Install no arbitrary MCP executables.
class McpRegistry{
 constructor(toolRegistry){this.tools=toolRegistry;this.connections=new Map();}
 register({id,client,approved=false}){safeName(id);if(!approved||!client||typeof client.listTools!=='function'||typeof client.callTool!=='function')throw fail('MCP_DENIED','MCP client requires explicit approval and compatible methods');this.connections.set(id,client);return {id,connected:true};}
 async importTools(id){const client=this.connections.get(id);if(!client)throw fail('MCP_MISSING','No approved MCP client');const result=await client.listTools();const names=[];for(const t of result.tools||[]){if(!/^[a-zA-Z0-9_-]{1,60}$/.test(t.name||''))continue;const name='mcp_'+id+'_'+t.name;this.tools.register({name,description:String(t.description||'').slice(0,300),run:async(args)=>client.callTool({name:t.name,arguments:args}),approvalRequired:true});names.push(name);}return names;}
}
module.exports={ToolRegistry,SkillRegistry,McpRegistry,allowWorkspacePath};
