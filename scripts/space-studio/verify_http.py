#!/usr/bin/env python3
"""Read-only HTTP integration checks with isolated data and a temporary local server."""
from pathlib import Path
import json,os,secrets,socket,subprocess,tempfile,time,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[2]
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None

def main():
 version=json.loads((ROOT/'package.json').read_text())['version'];checks=[]
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 opener=urllib.request.build_opener(NoRedirect());token=secrets.token_hex(32);base=f'http://127.0.0.1:{port}'
 def get(path,cookie=''):
  req=urllib.request.Request(base+path,headers={'Cookie':cookie})
  try:r=opener.open(req,timeout=8)
  except urllib.error.HTTPError as e:r=e
  return r.status,r.headers,r.read()
 with tempfile.TemporaryDirectory(prefix='aios-r2-http-') as temp:
  env={**os.environ,'AI_PROJECT_OS_DATA_DIR':str(Path(temp)/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
  with open(Path(temp)/'server.log','wb') as log:
   child=subprocess.Popen(['node','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log)
   try:
    for _ in range(60):
     try:
      status,h,b=get('/api/health')
      if status==200:break
     except (urllib.error.URLError,TimeoutError):pass
     if child.poll() is not None:raise RuntimeError('Isolated server stopped')
     time.sleep(.1)
    assert json.loads(b)['version']==version;checks.append('health matches package and release version')
    assert json.loads((ROOT/'RELEASE.json').read_text())['version']==version
    assert get('/api/projects')[0]==401;checks.append('protected API rejects unauthenticated requests')
    status,h,b=get('/?launch='+token);assert status==303;cookie=h['Set-Cookie'].split(';')[0];checks.append('existing one-time launch and HttpOnly cookie remain enabled')
    assert 'HttpOnly' in h['Set-Cookie'];status,h,b=get('/',cookie);html=b.decode();assert status==200 and '/space-studio/app-integration.mjs' in html and 'id="officeRoom"' in html;checks.append('actual app HTML contains retained office and new module entry')
    assert "script-src 'self'" in h['Content-Security-Policy'];checks.append('same-origin script policy retained')
    for path in ['space-studio/design.mjs','space-studio/motion.mjs','space-studio/scene.mjs','space-studio/viewer.mjs','space-studio/controller.mjs','space-studio/app-integration.mjs','vendor/three.module.min.js','vendor/addons/GLTFLoader.js']:
     status,h,b=get('/'+path,cookie);assert status==200 and ('javascript' in h['Content-Type']),path;checks.append('serves JavaScript module: '+path)
    status,h,b=get('/space-studio.html',cookie);assert status==200 and b'space-standalone' in b;checks.append('standalone real-scene viewer is served')
    status,h,b=get('/assets/tam19.glb',cookie);assert status==200 and b[:4]==b'glTF';checks.append('original TAM19 GLB is available locally')
    status,h,b=get('/api/office/fleet',cookie)
    assert status==423 and json.loads(b)['error']=='VAULT_LOCKED';checks.append('locked Vault rejects fleet read explicitly instead of a server error')
    req=urllib.request.Request(base+'/api/vault/unlock',data=json.dumps({'password':'isolated-http-fixture-password'}).encode(),headers={'Cookie':cookie,'Content-Type':'application/json'},method='POST')
    with opener.open(req,timeout=8) as response:assert response.status==200
    status,h,b=get('/api/office/fleet',cookie);fleet=json.loads(b)
    assert status==200 and isinstance(fleet.get('bots'),list);checks.append('unlocked isolated Vault returns the real fleet projection')
    fleet={'lockedStatus':423,'unlockedStatus':status,'bots':len(fleet['bots'])}
   finally:
    child.terminate()
    try:child.wait(timeout=5)
    except subprocess.TimeoutExpired:child.kill();child.wait(timeout=5)
 report={'version':version,'result':'pass','checks':checks,'count':len(checks),'fleetRoute':fleet,'scope':'actual HTTP routes; no graphics rendering and no user data accessed'}
 out=ROOT/'evidence/space-studio/http-checks.json';out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':main()
