// LOCAL-ONLY deterministic provider fixture for the real-app R4 browser test.
// Does not call any external model. Credentials accepted here are synthetic.
import http from 'node:http';
import fs from 'node:fs';
const out=process.argv[2];
const {fixtureBrief,memberResponse,chairResponse}=await import('../../test/helpers/council-fixtures.mjs');
const modes={A:'unauthenticated',B:'ok',C:'ok',D:'outage'},calls=[];
function respond(q){
 if(q.system.includes('IDEA_BRIEF_V1'))return fixtureBrief;
 if(q.system.includes('COUNCIL_MEMBER_V1'))return memberResponse('Fixture '+q.who+' (local test only)');
 if(q.system.includes('COUNCIL_CHAIR_V1'))return chairResponse('R4 local browser acceptance');
 if(q.system.includes('AI Project Manager'))return {tasks:[{id:'T1',title:'Create local page one',role:'frontend',description:'Create t1.html',dependsOn:[],doneWhen:'t1.html exists'},{id:'T2',title:'Create local page two',role:'frontend',description:'Create t2.html',dependsOn:['T1'],doneWhen:'t2.html exists'}]};
 if(q.system.includes('senior reviewer'))return {approved:true,summary:'Local fixture reviewed diff',risks:[],fixes:[]};
 if(q.prompt.includes('TASK:\n')){
  const t=JSON.parse(q.prompt.match(/TASK:\n([^\n]+)/)?.[1]||'{"id":"T1"}');
  return q.prompt.includes('Tool result:')?{tool:'done',summary:'Completed local fixture '+t.id}:{tool:'write',path:t.id.toLowerCase()+'.html',content:`<!doctype html><title>${t.id}</title><h1>${t.id} - R4 verified local output</h1>`};
 }
 return 'LOCAL TEST ONLY - '+q.who+' received the same request and returned a valid answer. No external AI was called.';
}
const server=http.createServer(async(req,res)=>{
 res.setHeader('content-type','application/json');let raw='';for await(const b of req)raw+=b;
 const body=JSON.parse(raw||'{}');
 if(req.url==='/control'&&req.method==='POST'){Object.assign(modes,body.modes||{});return res.end(JSON.stringify({ok:true,modes}));}
 if(req.url==='/stats')return res.end(JSON.stringify({modes,calls}));
 const who=(req.url.match(/^\/([ABCD])(?:\/|$)/)||[])[1]||'A';
 if(req.url.endsWith('/models'))return res.end(JSON.stringify({data:[{id:'fixture-'+who.toLowerCase(),object:'model'}]}));
 const q={who,model:body.model,system:body.instructions||body.messages?.find(x=>x.role==='system')?.content||'',prompt:body.input||body.messages?.filter(x=>x.role!=='system').map(x=>x.content).join('\n')||'',at:Date.now()};calls.push(q);
 if(modes[who]==='unauthenticated'){res.writeHead(401);return res.end(JSON.stringify({error:{code:'local_fixture_auth_failure'}}));}
 if(modes[who]==='outage'||modes[who]==='mid-task'&&q.prompt.includes('Tool result:')){res.writeHead(503);return res.end(JSON.stringify({error:{code:'local_fixture_outage',message:'deliberate fixture outage'}}));}
 if(modes[who]==='slow')await new Promise(r=>setTimeout(r,1500));
 const value=respond(q),text=typeof value==='string'?value:JSON.stringify(value);
 res.end(JSON.stringify(req.url.includes('/chat/completions')?{choices:[{message:{content:text}}]}:{output_text:text}));
});
server.listen(0,'127.0.0.1',()=>{fs.writeFileSync(out,JSON.stringify({port:server.address().port,pid:process.pid}));console.log('Local fixture ready');});
