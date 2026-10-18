'use strict';
const path=require('node:path');
const {privateDir,fail}=require('./common.cjs');
const {State}=require('./state.cjs');
const {ArtifactStore}=require('./artifacts.cjs');
const {Vault}=require('./vault.cjs');
const {ProviderGateway}=require('./providers.cjs');
const {ToolRegistry,SkillRegistry,McpRegistry}=require('./tools.cjs');
const {TaskQueue}=require('./runtime.cjs');
const {AgentTeam}=require('./agents.cjs');
const {PublicationGate}=require('./publication.cjs');
const {OutcomeKit}=require('./outcomes.cjs');
function createCore({root,vault=null,fetchImpl,concurrency=2,commercialPolicy=false}={}){if(!root)throw fail('CONFIG','Explicit data root is required');const base=privateDir(path.resolve(root));const state=new State(path.join(base,'state'));const artifacts=new ArtifactStore(path.join(base,'artifacts'));const tools=new ToolRegistry({root:path.join(base,'workspaces')});const providers=new ProviderGateway({vault:vault||{get:()=>{throw fail('VAULT_LOCKED','Provide authorized Vault adapter or initialize encrypted Vault');}},state,fetchImpl,commercialPolicy});const skills=new SkillRegistry(state,tools);const mcp=new McpRegistry(tools);const queue=new TaskQueue({state,tools,artifacts,providers,concurrency});queue.skills=skills;const agents=new AgentTeam({state,providers,queue});const publication=new PublicationGate({state,artifacts});const outcomes=new OutcomeKit({state,queue,tools,artifacts});return {agents,publication,outcomes,version:'CoreServices v1',state,artifacts,tools,providers,skills,mcp,queue,createVault:(options)=>{const connected=new Vault(path.join(base,'vault'),options);providers.vault=connected;return connected;},close:()=>{queue.stop();state.stop();}};}
module.exports={createCore,State,ArtifactStore,Vault,ProviderGateway,ToolRegistry,SkillRegistry,McpRegistry,TaskQueue,AgentTeam,PublicationGate,OutcomeKit};
