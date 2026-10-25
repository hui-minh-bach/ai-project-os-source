"""Real localhost news article -> fixture AI -> local draft; never claim an external Facebook post."""
import os,json,time,tempfile,secrets,subprocess,socket,signal,shutil
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence/v0970';temp=Path(tempfile.mkdtemp(prefix='aios-news-article-'));proc=None;report={'scope':__doc__,'checks':[]}
try:
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32);env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(temp/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'news-article-runtime.log').open('w');proc=subprocess.Popen(['node','--import','./scripts/fixtures/reception-app-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 for i in range(100):
  try:
   if requests.get(base+'/api/health',timeout=1).ok:break
  except requests.RequestException:pass
  time.sleep(.1)
 session=requests.Session();assert session.get(base+'/?launch='+token).ok
 def api(route,body=None):
  r=session.request('POST' if body is not None else 'GET',base+route,json=body,timeout=90);assert r.ok,(r.status_code,r.text);return r.json()
 pid=json.loads((temp/'data/qa-project-id.json').read_text())['id'];card=json.loads((temp/'data/qa-news-id.json').read_text())['id']
 run=api('/api/orchestrator/run',{'pipeline':'news-article','projectId':pid,'cardId':card})['run'];assert run['state']=='awaiting-approval' and run['article']['body'];report['checks'].append('RSS card -> gateway AI path -> stored article -> approval gate')
 document=session.get(base+'/api/work-products/'+run['id']+'/article.md');assert document.ok and len(document.text)>100;report['checks'].append('Actual Markdown download')
 done=api('/api/orchestrator/runs/'+run['id']+'/approve',{})['run'];assert done['state']=='completed' and done['publish'][0]['draft'] and done['publish'][0]['url'] is None
 report['checks'].append('Local draft receipt after approval; no external text-post capability claimed');report['status']='PASS'
except Exception as e:report['status']='FAIL';report['error']=repr(e)
finally:
 (OUT/'news-article.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=5)
  except ProcessLookupError:pass
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(temp,ignore_errors=True)
print(json.dumps(report,ensure_ascii=False))
if report['status']!='PASS':raise SystemExit(1)
