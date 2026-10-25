"""Normal authenticated localhost app and shipped UI, no provider preload or user data."""
import os,json,tempfile,secrets,subprocess,socket,signal,shutil,time
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence/v0971';tmp=Path(tempfile.mkdtemp(prefix='aios-ready-'));proc=None
report={'scope':__doc__,'checks':[],'windowsTested':False,'errors':[]}
try:
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32);env={**os.environ,'AI_PROJECT_OS_DATA_DIR':str(tmp/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token};env.pop('AIOS_TEST_ISOLATION',None)
 log=(tmp/'server.log').open('w');proc=subprocess.Popen(['node','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
 for i in range(100):
  try:
   if requests.get(base+'/api/health',timeout=1).ok:break
  except requests.RequestException:pass
  time.sleep(.1)
 assert requests.get(base+'/api/free-stack/status').status_code==401
 session=requests.Session();assert session.get(base+'/?launch='+token).ok
 status=session.get(base+'/api/free-stack/status',timeout=30);assert status.ok,status.text;status=status.json()
 c=next(t for t in status['tools'] if t['id']=='concat');assert not c['connected'] and not c['ready']
 assert status['narration']['rendererReady'] and not status['narration']['voiceReady'],status
 report['checks'].append('Normal API: real FFmpeg/FFprobe ready, absent Vietnamese voice blocked independently, no Concat token means no green connected badge')
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);ctx=browser.new_context(viewport={'width':1450,'height':1000});ctx.add_cookies([{'name':c.name,'value':c.value,'url':base} for c in session.cookies]);page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(base,wait_until='networkidle');page.locator('button.nav[data-page="engines"]').click();page.evaluate('renderEngines()');assert page.locator('#engineGrid article').count()>0;page.locator('#freeStackRefresh').click();page.get_by_text('Bộ dựng video đã sẵn sàng; video có lời đọc còn thiếu giọng Việt Windows/Piper.',exact=False).wait_for(timeout=30000)
  card=page.locator('#freeStackGrid article').filter(has=page.locator('h3',has_text='Concat'));assert '✓ Sẵn sàng' not in card.inner_text();assert 'Chưa cài / chưa kết nối' in card.inner_text()
  report['checks'].append('Actual engine cards show narration prerequisite and correct Concat status after Refresh click')
  assert not report['errors'],report['errors'];browser.close()
 report['status']='PASS'
finally:
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=5)
  except ProcessLookupError:pass
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(tmp,ignore_errors=True)
(OUT/'readiness-ui.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
