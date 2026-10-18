'use strict';
// MANUAL ONLY; this is not discovered as a .test.cjs by the Node test runner.
// An actual authorized account, API billing ceiling and pricing must be supplied.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createCore}=require('../core.cjs');
const e=process.env;
const required=['AI_CORE_LIVE_KEY','AI_CORE_LIVE_MODEL','AI_CORE_LIVE_PROVIDER','AI_CORE_PRICE_IN_PER_MILLION','AI_CORE_PRICE_OUT_PER_MILLION'];
if(e.AI_CORE_LIVE_APPROVAL!=='I_APPROVE_PAID_PROBE'||required.some(k=>!e[k])){
 console.log('SKIP: Live Provider A02 requires an authorized test key, model, provider, price inputs, and explicit paid-probe approval. No network or charges made.');process.exit(0);
}
const allowed=['openai','gemini','anthropic'];if(!allowed.includes(e.AI_CORE_LIVE_PROVIDER)){console.error('SKIP: Unsupported official provider.');process.exit(2);}
const prices=[Number(e.AI_CORE_PRICE_IN_PER_MILLION),Number(e.AI_CORE_PRICE_OUT_PER_MILLION)];if(prices.some(p=>!Number.isFinite(p)||p<0||p>1000)){console.error('SKIP: Configure verified pricing');process.exit(2);}
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'core-live-probe-'));
 const core=createCore({root,vault:{get:()=>e.AI_CORE_LIVE_KEY},commercialPolicy:true});
 try{
  core.providers.register({id:'live',type:e.AI_CORE_LIVE_PROVIDER,pricePerMillionInput:prices[0],pricePerMillionOutput:prices[1]});
  core.providers.setBudget(Math.min(.25,Number(e.AI_CORE_LIVE_BUDGET_USD||.10)));
  const v=await core.providers.verifyModel({providerId:'live',model:e.AI_CORE_LIVE_MODEL,approved:true,costCeilingUsd:.01,maxOutputTokens:16});
  core.providers.assign('Worker',{providerId:'live',model:e.AI_CORE_LIVE_MODEL});
  const quote=core.providers.quote('Worker',{prompt:'Reply OK.',maxOutputTokens:32});
  const approval=core.providers.approveCharge({role:'Worker',projectId:'smoke',idempotencyKey:'live-probe-once',maxUsd:Math.max(.01,quote.estimatedUpperBoundUsd),approved:true});
  const result=await core.providers.generateApproved('Worker',{projectId:'smoke',prompt:'Reply OK.',maxOutputTokens:32,approvalId:approval.id});
  if(typeof result.text!=='string'||!result.text.trim())throw new Error('LIVE_MODEL_EMPTY');
  console.log(JSON.stringify({result:'LIVE_OK',provider:e.AI_CORE_LIVE_PROVIDER,model:e.AI_CORE_LIVE_MODEL,verifiedCapabilities:v.ref.verifiedCapabilities,approvalConsumed:true,usageAvailable:Number.isFinite(result.usage?.input),spentUsd:core.providers.spendUsd,uncertainUsd:core.providers.uncertainUsd}));
 }finally{core.close();fs.rmSync(root,{recursive:true,force:true});}
})().catch(err=>{console.error('LIVE_BLOCKED:',String(err.code||'PROVIDER_ERROR'));process.exitCode=1;});
