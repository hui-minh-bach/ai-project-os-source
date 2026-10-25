import crypto from 'node:crypto';
import { architectureFixture } from './architecture-fixtures.mjs';
import { requirementsFingerprint } from '../../src/lib/project-prd.mjs';
import { architectureHash } from '../../src/lib/project-architecture.mjs';
import { taskArchitectureReference } from '../../src/lib/architecture-guard.mjs';
import { readJson, writeJson } from '../../src/lib/store.mjs';
import { getProject, sendBriefToCouncil, confirmCouncilSpecification, confirmCouncilArchitecture } from '../../src/lib/projects.mjs';
import { councilBriefFingerprint } from '../../src/lib/council-spec.mjs';

export const fixtureStack={needsGithub:true,needsVercel:true,needsDatabase:false,needsAuth:false,needsStorage:false,needsPayments:false,needsDomain:false,needsBackend:false,recommended:{source:'github',deploy:'vercel',database:'none'},reasons:['Static test project'],setupOrder:['GitHub','Vercel']};
export const fixtureBrief={summary:'Static project for local contract tests',problem:'Test users need useful information',audience:'Local test users',goals:['Publish useful information'],features:['Responsive static pages'],userFlows:['Open a page and read'],constraints:['Contract fixture only'],openQuestions:[],successCriteria:['Page opens'],stack:fixtureStack};
export function memberResponse(label='Fixture member',vote='agree'){return {version:1,viewpoint:label,strengths:['Simple MVP'],risks:['Check data boundary'],recommendation:'Build the smallest useful version',vote};}
export function chairResponse(label='Fixture Chair'){return {version:1,summary:label,feasibility:'high',recommendation:'Build MVP with explicit data boundary',conflictDecisions:[{issue:'Data boundary',resolution:'Keep the MVP local',rationale:'Address the concern before expansion',members:[1]}],specification:{title:label,goals:['Deliver useful pages'],audience:'Local test users',scope:'Two static pages only',mvpFeatures:['Create feature-a.txt','Create feature-b.txt'],outOfScope:['Payments'],userFlows:['Open either page'],data:[],integrations:[],stack:['HTML and CSS'],securityPrivacy:['No credentials in source'],acceptanceCriteria:['Both pages open'],roadmap:['Build and review MVP']}};}
// Fixtures use real explicit Specification and Architecture approvals.
// Setup for existing tests whose subject is role dispatch, task normalization or
// provider stability. Real Idea analysis is covered by idea-contract.test.mjs.
export function prepareCouncilHandoff(id){const projects=readJson('projects.json',[]),p=projects.find(x=>x.id===id);p.architectureRequired=true;p.productType=p.productType||'website';p.audience=p.audience||'Local test users';p.goals=p.goals||'Publish useful information';p.analyzedBrief={...fixtureBrief,revision:p.briefRevision||0,analyzedAt:new Date().toISOString()};writeJson('projects.json',projects);return sendBriefToCouncil(id);}
export function prepareApprovedSpecification(id,specificationPatch={},options={}){
  const p=prepareCouncilHandoff(id),projects=readJson('projects.json',[]),x=projects.find(v=>v.id===id),fingerprint=councilBriefFingerprint(p),chair=chairResponse();
  chair.specification={...chair.specification,...specificationPatch};
  x.councilRuns=[{id:'test-approved-run',status:'completed',briefRevision:x.briefRevision||0,briefFingerprint:fingerprint,brief:x.councilBrief,members:[],chair:{},startedAt:new Date().toISOString()}];x.currentCouncilRunId='test-approved-run';
  x.specifications=[{id:'test-approved-spec',version:1,runId:x.currentCouncilRunId,status:'pending',briefRevision:x.briefRevision||0,briefFingerprint:fingerprint,specification:chair.specification,chair}];x.currentSpecificationId='test-approved-spec';writeJson('projects.json',projects);confirmCouncilSpecification(id,'test-approved-spec');return options.architecture===false?getProject(id):prepareApprovedArchitecture(id);
}
// Execution fixtures carry the same confirmed structured specification and
// plan/task IDs that the task API now requires. No plaintext bypass is used.
export function prepareTaskPlan(id,tasks,specificationPatch={},architecturePatch={}){
  prepareApprovedSpecification(id,specificationPatch,{architecture:false});prepareApprovedArchitecture(id,architecturePatch);
  const projects=readJson('projects.json',[]),p=projects.find(v=>v.id===id);p.planId='test-plan-'+id;p.planSpecificationId=p.approvedSpecificationId;p.planCreatedAt=new Date().toISOString();
  p.tasks=tasks.map(t=>{const task={...t,priority:t.priority||'medium',specificationId:p.approvedSpecificationId,planId:p.planId,acceptanceCriteria:t.acceptanceCriteria||String(t.doneWhen||'Complete task').split('\n').filter(Boolean).map((text,i)=>({id:`AC${i+1}`,text,status:'not-run'}))};task.architectureReference=taskArchitectureReference(p,task);return task;});p.stage='planned';writeJson('projects.json',projects);return p;
}

export function prepareApprovedArchitecture(id,patch={}){
 const projects=readJson('projects.json',[]),p=projects.find(p=>p.id===id),spec=p.specifications.find(s=>s.id===p.approvedSpecificationId);
 const proposal={...architectureFixture,compliancePolicy:{modules:[{componentId:'frontend',paths:['.'],allowedImports:[]}],dependencies:[],protectedFiles:[],rules:[]},...patch};
 const a={id:crypto.randomUUID(),version:Math.max(0,...(p.architectures||[]).map(a=>a.version))+1,status:'proposed',specificationId:spec.id,specificationVersion:spec.version,requirementsHash:requirementsFingerprint(p,spec),createdAt:new Date().toISOString(),deploymentTarget:p.deploymentTarget||'not-specified',proposal};a.contentHash=architectureHash(a);
 p.architectures=p.architectures||[];p.architectures.push(a);p.currentArchitectureId=a.id;p.architectureRequired=true;writeJson('projects.json',projects);
 return confirmCouncilArchitecture(id,{architectureId:a.id,contentHash:a.contentHash,explicitApproval:true});
}
