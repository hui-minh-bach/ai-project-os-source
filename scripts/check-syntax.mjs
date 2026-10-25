import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const roots=['src','public','tools','scripts','integrations/media-engine'];
const files=[];function visit(dir){if(!fs.existsSync(dir))return;for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.name==='node_modules'||e.name.startsWith('.'))continue;const f=path.join(dir,e.name);if(e.isDirectory())visit(f);else if(/\.(?:mjs|cjs|js)$/.test(e.name))files.push(f);}}
roots.forEach(visit);let failed=0;for(const file of [...new Set(files)].sort()){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:15000});if(r.status!==0){console.error(file,r.stderr||r.error);failed++;}}
console.log(JSON.stringify({checked:files.length,failed,scope:'syntax only; not execution or visual acceptance'}));if(failed)process.exitCode=1;
