import crypto from 'node:crypto';
import {createMcpHttpClient,mcpEndpoint} from './mcp-http.mjs';
import {listConnections,getConnection,saveConnection,vaultStatus,createVaultSecretRedactor} from './vault.mjs';
import {readJson,writeJson} from './store.mjs';
const file='mcp-call-receipts.json';
const assertUnlocked=()=>{if(!vaultStatus().unlocked)throw Error('Mở Vault trước khi dùng MCP.');};
export function createMcpHub({getCore=()=>null,getProject=()=>null}={}){
 const clients=new Map(),connecting=new Set();
 function connection(id){assertUnlocked();const c=getConnection(id);if(c.kind!=='other'||!['mcp_http_2025','mcp_http_2026'].includes(c.meta?.keyType))throw Error('Không phải kết nối MCP.');return c;}
 function current(id,version){const c=connection(id);if(c.credentialVersion!==version)throw Error('MCP credential đã thay đổi; kiểm tra kết nối lại.');return c;}
 function list(){if(!vaultStatus().unlocked)return {vaultLocked:true,servers:[]};return {servers:listConnections().filter(c=>['mcp_http_2025','mcp_http_2026'].includes(c.meta?.keyType)).map(c=>{const active=clients.get(c.id);return {id:c.id,name:c.name,endpoint:c.baseUrl,connected:active?.version===getConnection(c.id).credentialVersion,tools:active?.version===getConnection(c.id).credentialVersion?active.tools:[],protocol:c.meta.keyType==='mcp_http_2026'?'2026-07-28':'2025-11-25'};})};}
 function save(input){assertUnlocked();if(input.id)connection(input.id);const baseUrl=mcpEndpoint(input.endpoint);return saveConnection({id:input.id,kind:'other',name:String(input.name||'MCP HTTP').slice(0,80),baseUrl,secret:input.token||'',meta:{keyType:input.protocol==='2026-07-28'?'mcp_http_2026':'mcp_http_2025'}});}
 async function connect(id){if(connecting.has(id))throw Error('MCP đang kiểm tra kết nối.');connecting.add(id);try{const c=connection(id),client=createMcpHttpClient({url:c.baseUrl,token:c.secret,version:c.meta.keyType==='mcp_http_2026'?'2026-07-28':'2025-11-25'});const {tools}=await client.listTools();current(id,c.credentialVersion);clients.set(id,{client,version:c.credentialVersion,tools});return {id,connected:true,tools,protocol:client.version};}finally{connecting.delete(id);}}
 async function call({id,name,arguments:args={},projectId,key,approved=false}){
  const c=connection(id),active=clients.get(id);if(!approved)throw Error('Cần duyệt chính xác tool và tham số trước khi chạy.');if(typeof key!=='string'||!/^[-a-zA-Z0-9_]{8,100}$/.test(key))throw Error('MCP cần khóa thao tác duy nhất.');if(!projectId)throw Error('MCP cần dự án cụ thể.');getProject(projectId);if(!active||active.version!==c.credentialVersion||!active.tools.some(t=>t.name===name))throw Error('MCP chưa xác minh hoặc tool không có trong danh mục.');if(!args||Array.isArray(args)||typeof args!=='object'||JSON.stringify(args).length>100000)throw Error('MCP arguments không hợp lệ.');
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify({id,name,args,projectId,version:c.credentialVersion})).digest('hex');const receipts=readJson(file,[]),old=receipts.find(r=>r.key===key);if(old){if(old.fingerprint!==fingerprint)throw Error('Khóa MCP đã dùng cho thao tác khác.');if(old.state==='completed')return old;throw Error('MCP thao tác cũ chưa xác định kết quả; không tự chạy lại.');}
  const redact=createVaultSecretRedactor(),receipt={key,id,name,projectId,fingerprint,state:'dispatching',at:new Date().toISOString()};writeJson(file,[...receipts,receipt]);
  const update=patch=>{const rows=readJson(file,[]);const r=rows.find(r=>r.key===key);Object.assign(r,patch);writeJson(file,rows);return r;};
  try{current(id,c.credentialVersion);const result=await active.client.callTool({name,arguments:args});current(id,c.credentialVersion);return update({state:'completed',result:JSON.parse(redact(JSON.stringify(result))),completedAt:new Date().toISOString()});}
  catch(e){update({state:'outcome_unknown',error:redact(e.message)});throw Error(redact(e.message));}
 }
 return {list,save,connect,call};
}
