'use strict';
// Vault setup for the existing KBL worker. Never takes a secret on the command line.
const path=require('node:path');
const {Vault}=require('./vault.cjs');
const {cleanError}=require('./common.cjs');
function readHidden(message){return new Promise((resolve,reject)=>{
 if(!process.stdin.isTTY||typeof process.stdin.setRawMode!=='function')return reject(new Error('Interactive terminal required; never pass API keys on the command line'));
 const chunks=[];process.stdout.write(message);process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 function done(error,value){process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',onKey);process.stdout.write('\n');if(error)reject(error);else resolve(value);}
 function onKey(s){for(const ch of s){if(ch==='\u0003')return done(new Error('Cancelled'));if(ch==='\r'||ch==='\n')return done(null,chunks.join(''));if(ch==='\u007f'||ch==='\b'){chunks.pop();continue;}if(ch>=' '&&ch!=='\u007f'&&chunks.length<8192)chunks.push(ch);}}
 process.stdin.on('data',onKey);
});}
async function main(){const [action,id]=process.argv.slice(2);
 if(!['set','has','remove'].includes(action)||!/^[a-z0-9_-]{1,80}$/.test(id||''))throw new Error('Usage: node vault-cli.cjs set|has|remove <provider-account-id>');
 const root=process.env.KBL_CORE_DATA_DIR||path.join(__dirname,'..','..','work','ai-core-v1');const vault=new Vault(path.join(root,'vault'));
 if(action==='has')return console.log(vault.has(id)?'PRESENT (encrypted)':'MISSING');
 if(action==='remove'){if(!vault.has(id))return console.log('MISSING');const answer=await readHidden('Type DELETE to remove encrypted entry: ');if(answer!=='DELETE')throw new Error('Not confirmed');vault.remove(id);return console.log('Removed encrypted entry');}
 const secret=await readHidden('API key (input hidden): ');if(!secret.trim())throw new Error('Empty secret');vault.set(id,secret);console.log('Stored encrypted key for '+id+'; plaintext not printed');}
if(require.main===module)main().catch(e=>{console.error('Vault:',cleanError(e).code,cleanError(e).message);process.exitCode=1;});
module.exports={readHidden};
