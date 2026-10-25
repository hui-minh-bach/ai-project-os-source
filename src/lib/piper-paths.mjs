import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {DATA_DIR} from './store.mjs';
const APP_ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const PIPER_CONFIG_FILE=path.join(DATA_DIR,'local-voice.json');
const regular=p=>{try{return fs.statSync(p).isFile();}catch{return false;}};
function valid(c){return c&&[c.cli,c.model,c.config].every(x=>typeof x==='string'&&path.isAbsolute(x)&&regular(x));}
function vietnamese(config){try{const c=JSON.parse(fs.readFileSync(config,'utf8'));return /^vi(?:-|_|$)/i.test(String(c.espeak?.voice||c.language?.code||''));}catch{return false;}}
function configAt(file){try{const c=JSON.parse(fs.readFileSync(file,'utf8'));return c.schema===1&&valid(c)?c:null;}catch{return null;}}
/** Only app-owned installation locations; never scans drives/downloads or runs installers.
 * Custom hosts must explicitly opt in with a dataDir, preventing owner-state leakage in tests. */
export function resolvePiperEnvironment(env=process.env,{dataDir=DATA_DIR,appRoot=APP_ROOT,includeSaved=env===process.env}={}){
 if(!includeSaved)return env;
 for(const base of [...new Set([dataDir,path.join(appRoot,'.data')])]){
  const c=configAt(path.join(base,'local-voice.json'));
  if(c)return {...env,PIPER_CLI_PATH:c.cli,PIPER_MODEL_PATH:c.model,PIPER_CONFIG_PATH:c.config,AIOS_PIPER_SOURCE:base===dataDir?'saved':'legacy-saved'};
 }
 // Explicit legacy environment configuration remains authoritative.
 if(env.PIPER_MODEL_PATH||env.PIPER_CLI_PATH||env.PIPER_CONFIG_PATH)return env;
 for(const base of [...new Set([dataDir,path.join(appRoot,'.data')])]){
  const root=path.join(base,'local-voice');let dirs=[];
  try{dirs=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()&&/^piper-[\d.]+-?\d*$/.test(e.name)).map(e=>e.name).sort().reverse().slice(0,8);}catch{}
  for(const name of dirs){const dir=path.join(root,name),cli=path.join(dir,'piper',process.platform==='win32'?'piper.exe':'piper');let names=[];
   try{names=fs.readdirSync(dir).filter(n=>/^vi[_-][a-z0-9_.-]+\.onnx$/i.test(n)).sort().slice(0,8);}catch{}
   for(const name of names){const c={cli,model:path.join(dir,name),config:path.join(dir,name+'.json')};
    if(valid(c)&&vietnamese(c.config))return {...env,PIPER_CLI_PATH:c.cli,PIPER_MODEL_PATH:c.model,PIPER_CONFIG_PATH:c.config,AIOS_PIPER_SOURCE:base===dataDir?'managed-install':'legacy-install'};
   }
  }
 }
 return env;
}
export function piperEnvironment(env=process.env){return resolvePiperEnvironment(env);}
export function savePiperPaths({cli,model,config}){
 fs.mkdirSync(path.dirname(PIPER_CONFIG_FILE),{recursive:true,mode:0o700});
 const temp=PIPER_CONFIG_FILE+'.tmp';fs.writeFileSync(temp,JSON.stringify({schema:1,cli,model,config},null,2),{mode:0o600});fs.renameSync(temp,PIPER_CONFIG_FILE);
}
