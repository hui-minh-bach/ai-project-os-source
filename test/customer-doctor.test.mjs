import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {systemDoctor} from '../src/lib/system-doctor.mjs';
const root=path.resolve(import.meta.dirname,'..');

test('doctor checks local project/storage without network or paid APIs',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-doctor-test-'));
  try {
    const report=systemDoctor({root,dataDir:path.join(dir,'data'),backupDir:path.join(dir,'backup'),smoke:false});
    assert.equal(report.version,'0.9.34');
    assert.equal(report.capabilities.projectManagement,true);
    assert.equal(report.capabilities.backup,true);
    assert.equal(report.capabilities.cloudSpeechVerified,false);
    assert.equal(report.checks.find(x=>x.id==='encode').status,'info');
    assert.ok(!fs.readdirSync(path.join(dir,'data')).some(x=>x.includes('aios-doctor')),'temporary health files must be deleted');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('doctor refuses broken application, read-only assumptions and untrusted executables',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-doctor-fail-'));
  try {
    const report=systemDoctor({root:path.join(dir,'empty'),dataDir:path.join(dir,'data'),backupDir:path.join(dir,'backup'),smoke:false,ffmpegBin:'nonexistent-aios-ffmpeg',ffprobeBin:'nonexistent-aios-ffprobe'});
    assert.equal(report.checks.find(x=>x.id==='files').status,'fail');
    assert.equal(report.checks.find(x=>x.id==='media').status,'warning');
    assert.equal(report.capabilities.video,false);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('doctor live H.264 encoder returns a fact not a fabricated green result',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'aios-doctor-video-'));
  try {
    const result=systemDoctor({root,dataDir:path.join(dir,'data'),backupDir:path.join(dir,'backup'),smoke:true});
    assert.equal(result.capabilities.video,result.checks.find(x=>x.id==='encode').status==='pass');
    assert.ok(['pass','fail','warning'].includes(result.checks.find(x=>x.id==='encode').status));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
