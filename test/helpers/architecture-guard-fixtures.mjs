import crypto from 'node:crypto';
import {architectureFixture} from './architecture-fixtures.mjs';
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
export const api='{"openapi":"3.0.0","paths":{"/items":{"get":{}}}}\n';
export const seed={'frontend/view.mjs':'export function greet(name) { return name; }\n','backend/service.mjs':'export function data() { return 1; }\n','api/openapi.json':api,'package.json':'{"type":"module","dependencies":{}}\n'};
export const policy=()=>({modules:[{componentId:'frontend',paths:['frontend/','package.json'],allowedImports:[]},{componentId:'backend',paths:['backend/','api/','database/','security/'],allowedImports:[]}],dependencies:[],protectedFiles:[{path:'api/openapi.json',sha256:sha(api),kind:'api'}],rules:[{id:'no-browser-storage',description:'Không đưa dữ liệu vào localStorage',paths:['frontend/'],forbiddenText:['localStorage']}]});
export function proposal(){return {...architectureFixture,components:[{id:'frontend',name:'Frontend',responsibility:'Giao diện',boundary:'frontend/; không import source backend'},{id:'backend',name:'Backend',responsibility:'API và dữ liệu',boundary:'backend/, api/'}],relationships:[{from:'frontend',to:'backend',contract:'HTTPS GET /items'}],compliancePolicy:policy()};}
