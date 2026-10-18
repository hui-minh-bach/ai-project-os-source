import { readJson, writeJson } from '../../src/lib/store.mjs';
import { sendBriefToCouncil, confirmCouncilSpecification } from '../../src/lib/projects.mjs';
import { councilBriefFingerprint } from '../../src/lib/council-spec.mjs';

export const fixtureStack={needsGithub:true,needsVercel:true,needsDatabase:false,needsAuth:false,needsStorage:false,needsPayments:false,needsDomain:false,needsBackend:false,recommended:{source:'github',deploy:'vercel',database:'none'},reasons:['Static test project'],setupOrder:['GitHub','Vercel']};
export const fixtureBrief={summary:'Static project for local contract tests',problem:'Test users need useful information',audience:'Local test users',goals:['Publish useful information'],features:['Responsive static pages'],userFlows:['Open a page and read'],constraints:['Contract fixture only'],openQuestions:[],successCriteria:['Page opens'],stack:fixtureStack};
export function memberResponse(label='Fixture member',vote='agree'){return {version:1,viewpoint:label,strengths:['Simple MVP'],risks:['Check data boundary'],recommendation:'Build the smallest useful version',vote};}
export function chairResponse(label='Fixture Chair'){return {version:1,summary:label,feasibility:'high',recommendation:'Build MVP with explicit data boundary',conflictDecisions:[{issue:'Data boundary',resolution:'Keep the MVP local',rationale:'Address the concern before expansion',members:[1]}],specification:{title:label,goals:['Deliver useful pages'],audience:'Local test users',scope:'Two static pages only',mvpFeatures:['Create feature-a.txt','Create feature-b.txt'],outOfScope:['Payments'],userFlows:['Open either page'],data:[],integrations:[],stack:['HTML and CSS'],securityPrivacy:['No credentials in source'],acceptanceCriteria:['Both pages open'],roadmap:['Build and review MVP']}};}
// Setup for existing tests whose subject is role dispatch, task normalization or
// provider stability. Real Idea analysis is covered by idea-contract.test.mjs.
export function prepareCouncilHandoff(id){const projects=readJson('projects.json',[]),p=projects.find(x=>x.id===id);p.productType=p.productType||'website';p.audience=p.audience||'Local test users';p.goals=p.goals||'Publish useful information';p.analyzedBrief={...fixtureBrief,revision:p.briefRevision||0,analyzedAt:new Date().toISOString()};writeJson('projects.json',projects);return sendBriefToCouncil(id);}
export function prepareApprovedSpecification(id,specificationPatch={}){
  const p=prepareCouncilHandoff(id),projects=readJson('projects.json',[]),x=projects.find(v=>v.id===id),fingerprint=councilBriefFingerprint(p),chair=chairResponse();
  chair.specification={...chair.specification,...specificationPatch};
  x.councilRuns=[{id:'test-approved-run',status:'completed',briefRevision:x.briefRevision||0,briefFingerprint:fingerprint,brief:x.councilBrief,members:[],chair:{},startedAt:new Date().toISOString()}];x.currentCouncilRunId='test-approved-run';
  x.specifications=[{id:'test-approved-spec',version:1,runId:x.currentCouncilRunId,status:'pending',briefRevision:x.briefRevision||0,briefFingerprint:fingerprint,specification:chair.specification,chair}];x.currentSpecificationId='test-approved-spec';writeJson('projects.json',projects);return confirmCouncilSpecification(id,'test-approved-spec');
}
// Execution fixtures carry the same confirmed structured specification and
// plan/task IDs that the task API now requires. No plaintext bypass is used.
export function prepareTaskPlan(id,tasks,specificationPatch={}){
  prepareApprovedSpecification(id,specificationPatch);
  const projects=readJson('projects.json',[]),p=projects.find(v=>v.id===id);p.planId='test-plan-'+id;p.planSpecificationId=p.approvedSpecificationId;p.planCreatedAt=new Date().toISOString();
  p.tasks=tasks.map(t=>({...t,priority:t.priority||'medium',specificationId:p.approvedSpecificationId,planId:p.planId}));p.stage='planned';writeJson('projects.json',projects);return p;
}
