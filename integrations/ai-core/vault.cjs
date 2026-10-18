'use strict';
// Opt-in encrypted local store; never import a browser cookie, password or ChatGPT session.
// The master passphrase comes from an operator-supplied environment variable and is never written to disk.
const {fs,path,crypto,fail,privateDir,atomic,load}=require('./common.cjs');
class Vault{
 constructor(root,{master=process.env.KBL_CORE_MASTER_KEY}={}){if(typeof master!=='string'||master.length<32)throw fail('VAULT_LOCKED','Set a unique KBL_CORE_MASTER_KEY (32+ characters), or inject an existing approved Vault adapter');this.master=master;this.root=privateDir(root);this.file=path.join(this.root,'vault.enc.json');this.db=load(this.file,{version:1,items:{}});if(this.db.version!==1)throw fail('VAULT_FORMAT','Unsupported vault data');}
 key(salt){return crypto.scryptSync(this.master,Buffer.from(salt,'base64'),32);}
 set(id,secret){if(!/^[a-z0-9_-]{1,80}$/.test(id)||typeof secret!=='string'||!secret.trim())throw fail('VAULT_INPUT','Invalid account or secret');const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',this.key(salt.toString('base64')),iv);const ct=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);this.db.items[id]={salt:salt.toString('base64'),iv:iv.toString('base64'),ciphertext:ct.toString('base64'),tag:cipher.getAuthTag().toString('base64')};atomic(this.file,this.db);}
 get(id){const v=this.db.items[id];if(!v)throw fail('VAULT_MISSING','No secret for account');try{const dec=crypto.createDecipheriv('aes-256-gcm',this.key(v.salt),Buffer.from(v.iv,'base64'));dec.setAuthTag(Buffer.from(v.tag,'base64'));return Buffer.concat([dec.update(Buffer.from(v.ciphertext,'base64')),dec.final()]).toString('utf8');}catch{throw fail('VAULT_LOCKED','Wrong vault key or damaged vault');}}
 has(id){return !!this.db.items[id];}
 remove(id){delete this.db.items[id];atomic(this.file,this.db);}
}
module.exports={Vault};
