/** TEST ONLY: synthetic AI/cloud contracts. Never loaded by RUN-WINDOWS. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {cloudFixture} from '../../test/helpers/launch-cloud-fixture.mjs';
if(process.env.AIOS_DELIVERY_FIXTURE!=='1'||!process.env.AI_PROJECT_OS_DATA_DIR?.startsWith(os.tmpdir()+path.sep))throw new Error('Delivery fixture must run with an isolated temporary data directory.');
const {unlockVault,saveConnection}=await import('../../src/lib/vault.mjs');
const {createProject,updateProjectModelRoles,updateProjectSettings,getProject}=await import('../../src/lib/projects.mjs');
const {recordModels}=await import('../../src/lib/model-bindings.mjs');
const {getConnection}=await import('../../src/lib/vault.mjs');
const {prepareTaskPlan,fixtureBrief,memberResponse,chairResponse}=await import('../../test/helpers/council-fixtures.mjs');
const {writeJson}=await import('../../src/lib/store.mjs');
const f=cloudFixture(),originalFetch=globalThis.fetch,aiCalls=[];let failedA=false;
const product={
 'index.html':'<!doctype html><html lang="vi"><meta charset="utf-8"><title>Local delivery fixture</title><link rel="stylesheet" href="style.css"><main><h1>Customer idea - fixture site</h1><p>This is a test product, not a customer deployment.</p><button id="counter" onclick="this.textContent=Number(this.textContent)+1">0</button></main></html>',
 'style.css':'body{font:18px system-ui;background:#eff8fa;margin:0;padding:8vw;color:#103c50}main{max-width:800px;margin:auto}button{padding:12px 24px}',
 'package.json':JSON.stringify({name:'delivery-fixture',private:true,type:'module',scripts:{test:'node --test app.test.mjs'}}),
 'app.test.mjs':`import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';test('page serves the intended title and functional counter',()=>{const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');assert.match(html,/<h1>Customer idea/);assert.match(html,/id="counter"/);assert.ok(html.includes('Number(this.textContent)+1'));});`,
 'aios.delivery.json':JSON.stringify({version:1,kind:'web',framework:'static',supabase:{enabled:false},smokePaths:['/']})
};
const ai=http.createServer(async(req,res)=>{
 let input='';for await(const b of req)input+=b;const q=JSON.parse(input),system=q.messages?.find(x=>x.role==='system')?.content||q.instructions||'',prompt=q.messages?.filter(x=>x.role!=='system').map(x=>x.content).join('\n')||q.input||'';aiCalls.push({model:q.model,stage:system.includes('IDEA_BRIEF_V1')?'analysis':system.includes('COUNCIL_MEMBER_V1')?'council-member':system.includes('COUNCIL_CHAIR_V1')?'council-chair':system.includes('AI Project Manager')?'plan':system.includes('senior reviewer')?'review':'worker',review:system.includes('senior reviewer')});
 res.setHeader('content-type','application/json');if(q.model==='fixture-a'&&!failedA){failedA=true;res.writeHead(401);res.end(JSON.stringify({error:{message:'Synthetic failure for handover test'}}));return;}
 let answer;
 if(system.includes('Bạn là dịch giả phụ đề')){const input=JSON.parse(prompt);answer=input.segments.map((_,i)=>'Đây là đoạn dịch thử nghiệm số '+(i+1)+'.');}
 else if(system.includes('RADAR_FIELD_V1'))answer={query:'gold jewellery OR trang suc',keywords:['gold','jewellery','trang suc'],explanation:'Synthetic keyword suggestion for a local test.'};
 else if(system.includes('CLIENT_CONTENT_REVIEW_V1'))answer={approved:true,feedback:'Client brief comparison by TEST ONLY reviewer, not live AI.',correctedText:''};
 else if(system.includes('MEDIA_TEXT_REVIEW_V1'))answer={approved:true,feedback:'Fixture review of supplied evidence only; no audio or video inspection claimed.',correctedText:''};
 else if(system.includes('CLIENT_ARTICLE_V1'))answer='Bài đăng dịch vụ chụp ảnh trang sức bằng ánh sáng tự nhiên theo brief thử nghiệm. Liên hệ nhận báo giá. Không tự thêm giá hoặc khuyến mãi.';
 else if(system.includes('CLIENT_VIDEO_SCRIPT_V1'))answer='Xin chào. Nếu cửa hàng cần ảnh sản phẩm trang sức bằng ánh sáng tự nhiên, chúng tôi cung cấp dịch vụ chụp ảnh sản phẩm. Hãy liên hệ để nhận báo giá phù hợp. Nội dung này do khách cung cấp để thử nghiệm.';
 else if(system.includes('NEWS_ARTICLE_V1'))answer='Bai phan tich thu nghiem.\n\nDu kien tu nguon: Ban tin mau ghi nhan mot thay doi trong cua hang. Day la du lieu co lap de kiem tra ung dung, khong phai tin thi truong that.\n\nNhan dinh: Can doc nguon goc truoc khi dua ra quyet dinh. Khong suy ra gia vang hay loi nhuan tu ban tin nay.\n\nNguon: https://example.com/news/local-fixture';
 else if(system.includes('video')||system.includes('phim ng'))answer='Day la ban tin thu nghiem tu nguon da chon. Noi dung duoc viet lai de kiem tra quy trinh lam viec, khong phai thong tin thi truong truc tiep. Khong dua ra gia hay loi khuyen dau tu. Nguon example.com.';
 else if(system.includes('IDEA_BRIEF_V1'))answer={...fixtureBrief,summary:'Build a local fixture static website',features:['Responsive static counter page'],successCriteria:['Counter works and actual npm test passes']};
 else if(system.includes('COUNCIL_MEMBER_V1'))answer=memberResponse('Independent synthetic member');
 else if(system.includes('COUNCIL_CHAIR_V1')){answer=chairResponse('One-button fixture website');Object.assign(answer.specification,{scope:'Static HTML page with a functioning counter, test and delivery manifest.',mvpFeatures:['Responsive counter page'],acceptanceCriteria:['Counter increments and npm test passes']});}
 else if(system.includes('AI Project Manager'))answer={tasks:[{title:'Build fixture static site',role:'frontend',description:'Create index.html, style.css, package.json with a meaningful offline test, and aios.delivery.json. Local QA fixture only.',priority:'high',dependsOn:[],doneWhen:'Actual files and tests work',acceptanceCriteria:['Counter increments and tests pass']} ]};
 else if(system.includes('senior reviewer'))answer={approved:true,summary:'Synthetic independent reviewer checked the supplied diff and receipts.',risks:[],fixes:[],acceptance:[1,2,3].map(i=>({criterionId:'AC'+i,met:true,explanation:'Fixture contract verified in diff and runtime test receipt.'}))};
 else{const marker='HOST OPERATION LEDGER (already performed; do not replay completed operations):\n',i=prompt.lastIndexOf(marker);let ledger=[];try{ledger=JSON.parse(prompt.slice(i+marker.length));}catch{}
  const written=new Set(ledger.filter(x=>x.tool==='write'&&x.status==='SUCCESS').map(x=>x.path));const packaging=prompt.includes('"title":"One-button delivery package"'),files=packaging?{'README.md':'# Local fixture\n\nRun npm test. Static deployment uses root index.html. This is synthetic QA, not a customer delivery.\n'}:product;
  const next=Object.entries(files).find(([name])=>!written.has(name));answer=next?{tool:'write',path:next[0],content:next[1]}:{tool:'done',summary:'Fixture files implemented; actual tests are run by the host.'};
 }
 const text=typeof answer==='string'?answer:JSON.stringify(answer);res.end(JSON.stringify(req.url.includes('chat')?{choices:[{message:{content:text}}]}:{output_text:text}));
});await new Promise(resolve=>ai.listen(0,'127.0.0.1',resolve));
globalThis.fetch=(url,options)=>{const host=new URL(typeof url==='string'?url:url.url||url.href).hostname;return ['api.vercel.com','api.supabase.com','abcdefghijklmnopqrst.supabase.co','fixture.vercel.app'].includes(host)?f.fetch(url,options):originalFetch(url,options);};
unlockVault('fixture-vault-password-not-a-user-secret');
for(const [id,name,model] of [['ai-a','Planner A','fixture-a'],['ai-b','Builder B','fixture-b'],['ai-c','Reviewer C','fixture-c']]){saveConnection({id,kind:'openai_compatible',name,secret:'fixture-token-'+id,model,baseUrl:'http://127.0.0.1:'+ai.address().port});recordModels(getConnection(id),[model]);}
saveConnection({id:'v',kind:'vercel',name:'Vercel fixture - NOT LIVE',secret:f.credentials.v.secret});saveConnection({id:'s',kind:'supabase',name:'Supabase fixture - NOT LIVE',secret:f.credentials.s.secret});
const p=createProject({name:'One-button QA - NOT LIVE',idea:'Build a static fixture site with a working counter.',productType:'website',audience:'Test operator',goals:'Verify the application pipeline, not a real deployment.'});
updateProjectModelRoles(p.id,{founder:{connectionId:'ai-a',model:'fixture-a'},worker:{connectionId:'ai-a',model:'fixture-a'},reviewer:{connectionId:'ai-c',model:'fixture-c'},council:[{connectionId:'ai-a',model:'fixture-a'},{connectionId:'ai-c',model:'fixture-c'}],backups:{founder:{connectionId:'ai-b',model:'fixture-b'},worker:{connectionId:'ai-b',model:'fixture-b'}}});
updateProjectSettings(p.id,{sandboxMode:'safe',reviewRequired:true,maxParallel:1,autoFailover:true,failoverScope:'project'});
if(process.env.AIOS_DELIVERY_UNPLANNED==='0')prepareTaskPlan(p.id,[{id:'T1',title:'Build fixture static site',description:'Create index.html, style.css, package.json with a meaningful offline test, and aios.delivery.json. Local QA fixture only.',role:'frontend',status:'todo',dependsOn:[],doneWhen:'Actual files and tests work',skills:['frontend-web','qa-test'],engineId:'native'}],{scope:'Static HTML page with a functioning counter, test and delivery manifest.',mvpFeatures:['Static page with counter'],acceptanceCriteria:['Counter increments and npm test passes']});
writeJson('qa-project-id.json',{id:p.id});
const stats=()=>{try{fs.writeFileSync(path.join(process.env.AI_PROJECT_OS_DATA_DIR,'qa-provider-evidence.json'),JSON.stringify({aiCalls,cloudCalls:f.calls.map(x=>({url:x.url,method:x.method})),resources:{project:f.project?.id,deployment:f.deployment?.id}},null,2));}catch{}};
const timer=setInterval(stats,500);timer.unref();process.on('SIGTERM',()=>{stats();clearInterval(timer);ai.closeAllConnections();ai.close();});

// Seed exactly one local news card through the real parser. No external news calls.
const {createIngestStore}=await import('../../src/lib/ingest.mjs');
const store=createIngestStore({file:path.join(process.env.AI_PROJECT_OS_DATA_DIR,'ingest.json'),fetchImpl:async()=>new Response('<rss><channel><item><title>Local fixture news - not real market news</title><link>https://example.com/news/local-fixture</link><description>Local fixture data only. No real market prices.</description><pubDate>'+new Date().toUTCString()+'</pubDate></item></channel></rss>')});
const source=store.addSource({name:'Local QA feed',url:'https://example.com/feed',fieldId:'kinh-doanh',fullText:false});
await store.scanSource(source.id,{fullText:false});
writeJson('qa-news-id.json',{id:store.listCards()[0].id});
