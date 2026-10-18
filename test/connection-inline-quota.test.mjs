import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function uiQuotaFixture(){
 const s=fs.readFileSync(new URL('../public/tabs/connections.js',import.meta.url),'utf8');
 const start=s.indexOf("let ccUsageSelected=''");
 const end=s.indexOf('function ccRenderUsage(){',start);
 assert.ok(start>0&&end>start,'must keep the quota widget alongside connection cards');
 const ctx=vm.createContext({state:{vault:{unlocked:true},connections:[]},esc:x=>String(x),ccNumber:n=>String(n),api:async()=>({}),$:()=>null,CSS:{escape:x=>String(x)},document:{},Date,Number,Map,Set,String,Object});
 vm.runInContext(s.slice(start,end)+`\nglobalThis.quota={cache:ccQuotaCache,panel:ccQuotaPanel,rows:ccQuotaRows,refresh:ccFetchQuota,visible:ccFetchVisibleQuotas};`,ctx);
 return ctx;
}
test('connections show only real 5-hour/week provider limits and hide them while vault is locked',()=>{
 const ctx=uiQuotaFixture();const c={id:'acc-real',kind:'chatgpt_account',credentialVersion:'v1',meta:{accountIdentity:'fixture@example.invalid'},name:'ChatGPT',model:'gpt-x',availability:{status:'verified'}};
 ctx.state.connections=[c];
 assert.match(ctx.quota.panel(c),/Chưa tải hạn mức/);
 assert.doesNotMatch(ctx.quota.panel(c),/<progress/);
 ctx.quota.cache.set(c.id,{revision:'v1',at:Date.now(),data:{rateLimitsByLimitId:{'gpt-x':{primary:{windowDurationMins:300,usedPercent:35,resetsAt:1000},secondary:{windowDurationMins:10080,usedPercent:72,resetsAt:2000}}}}});
 const html=ctx.quota.panel(c);
 assert.match(html,/5 giờ/);assert.match(html,/1 tuần/);
 assert.match(html,/65% còn lại/);assert.match(html,/28% còn lại/);
 assert.match(html,/Model gpt-x/);
 ctx.state.vault.unlocked=false;
 assert.doesNotMatch(ctx.quota.panel(c),/65%/);
 assert.match(ctx.quota.panel(c),/Mở Vault/);
});
test('unsupported providers have no fabricated subscription quota even when token count is available',()=>{
 const ctx=uiQuotaFixture();
 const c={id:'claude',kind:'claude_account',model:'sonnet',usage:{groups:[{model:'sonnet',counts:{input:120,output:30}}]}};
 const html=ctx.quota.panel(c);
 assert.match(html,/chưa cấp dữ liệu/i);assert.match(html,/150 token/);
 assert.doesNotMatch(html,/<progress/);
});
test('stale credential versions cannot reuse cached quota',()=>{
 const ctx=uiQuotaFixture();const c={id:'acc',kind:'chatgpt_account',credentialVersion:'new',meta:{accountIdentity:'fixture@example.invalid'},model:'model'};
 ctx.quota.cache.set('acc',{revision:'old',at:Date.now(),data:{rateLimits:{primary:{windowDurationMins:300,usedPercent:0}}}});
 assert.doesNotMatch(ctx.quota.panel(c),/<progress/);
});

test('logged-in but UNVERIFIED ChatGPT profiles fetch distinct quota data (no role/model verification gate)',async()=>{
 const ctx=uiQuotaFixture();
 const a={id:'account-a',kind:'chatgpt_account',name:'A',credentialVersion:'rev-a',meta:{accountIdentity:'a@fixture.invalid'},availability:{status:'unverified'}};
 const b={id:'account-b',kind:'chatgpt_account',name:'B',credentialVersion:'rev-b',meta:{accountIdentity:'b@fixture.invalid'},availability:{status:'unverified'}};
 ctx.state.connections=[a,b];let calls=[];
 ctx.api=async route=>{calls.push(route);return {rateLimits:{primary:{usedPercent:route.includes('account-a')?100:30,windowDurationMins:300,resetsAt:1900000000}}};};
 ctx.quota.visible();await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal(calls.length,2);assert.ok(calls.some(x=>x.includes('account-a')));assert.ok(calls.some(x=>x.includes('account-b')));
 assert.match(ctx.quota.panel(a),/0% còn lại/);assert.match(ctx.quota.panel(b),/70% còn lại/);
 ctx.state.vault.unlocked=false;assert.doesNotMatch(ctx.quota.panel(a),/0% còn lại/);
});
