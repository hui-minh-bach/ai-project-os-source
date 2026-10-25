/** Local QA only; production startup never imports this module. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import http from 'node:http';
if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw Error('Local test temp directory required');
const fixtureRoot=process.env.AI_PROJECT_OS_DATA_DIR;fs.mkdirSync(fixtureRoot,{recursive:true});const cli=path.join(fixtureRoot,'whisper-cli-fixture');const model=path.join(fixtureRoot,'not-a-real-whisper-model.bin');fs.writeFileSync(model,'TEST ONLY - no inference weights');
fs.writeFileSync(cli,'#!/usr/bin/env node\nconst fs=require("fs");if(process.argv.includes("--help")){console.log("Whisper TEST FIXTURE");process.exit(0);}const ix=process.argv.indexOf("-of"),audio=process.argv[process.argv.indexOf("-f")+1];if(ix<0||!fs.existsSync(audio))process.exit(2);fs.writeFileSync(process.argv[ix+1]+".srt","1\\n00:00:00,000 --> 00:00:04,000\\nLocal synthetic source transcript.\\n\\n2\\n00:00:04,000 --> 00:00:08,000\\nOnly testing the dubbing workflow.\\n");\n',{mode:0o755});process.env.WHISPER_CLI_PATH=cli;process.env.WHISPER_MODEL_PATH=model;
await import('./automatic-media-r9-preload.mjs');
const {startMockPlatforms}=await import('../../test/fixtures/mock-platforms.mjs');
const {saveConnection}=await import('../../src/lib/vault.mjs');
const mock=await startMockPlatforms();
for(const kind of ['youtube','facebook','tiktok'])saveConnection({id:'qa-social-'+kind,kind,name:kind+' LOCAL SIMULATION',secret:JSON.stringify({accessToken:'mock-access-token',refreshToken:'mock-refresh-token'}),baseUrl:mock.baseUrl,meta:{channelTitle:'Synthetic channel',pageId:'page-1',pageName:'Synthetic Page',username:'mock.creator',tiktokApproved:true}});
const mcp=http.createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;const q=JSON.parse(raw);res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:q.method==='tools/list'?{tools:[{name:'echo',description:'Echo local QA only',inputSchema:{type:'object',properties:{text:{type:'string'}}}}]}:{content:[{type:'text',text:q.params.arguments.text}]}}));});await new Promise(r=>mcp.listen(0,'127.0.0.1',r));
fs.writeFileSync(path.join(process.env.AI_PROJECT_OS_DATA_DIR,'qa-social.json'),JSON.stringify({baseUrl:mock.baseUrl,mcpUrl:'http://127.0.0.1:'+mcp.address().port+'/mcp',simulated:true}));
process.on('SIGTERM',()=>{mock.close();mcp.closeAllConnections();mcp.close();});
