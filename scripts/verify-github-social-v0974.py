"""Real app browser/local Git/HTTP. CLI identity, model replies and social APIs are fixtures. No public posts or cloud changes."""
import os,json,time,tempfile,secrets,subprocess,socket,signal,shutil,sys
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence/v0974';temp=Path(tempfile.mkdtemp(prefix='aios-ghsocial074-'));proc=None
report={'scope':__doc__,'nativeWindows':False,'liveProvider':False,'checks':[],'errors':[]}
def record(s,**extra):report['checks'].append({'name':s,'status':'PASS',**extra});print('PASS',s,flush=True)
def waitfor(fn,seconds=45):
 end=time.time()+seconds
 while time.time()<end:
  try:
   v=fn()
   if v:return v
  except Exception:pass
  time.sleep(.15)
 raise AssertionError('Timed out')
try:
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32);data=temp/'data';env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(data),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'browser-runtime.log').open('w');proc=subprocess.Popen(['node','--import','./scripts/fixtures/github-social-v0974-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=1).ok);session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 def api(route,body=None):
  r=session.request('POST' if body is not None else 'GET',base+route,json=body,timeout=40);assert r.ok,(route,r.status_code,r.text[:700]);return r.json()
 home=json.loads((data/'qa-project-id.json').read_text())['id']
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ['AIOS_QA_CHROMIUM'],headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);ctx=browser.new_context(viewport={'width':1450,'height':1000});ctx.add_cookies([{'name':c.name,'value':c.value,'url':base} for c in session.cookies]);page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
  # Existing 3D is protected and already accepted; this scoped UI test does not initialize WebGL.
  page.route('**/space-studio/viewer.mjs',lambda r:r.fulfill(content_type='text/javascript',body='export function createSpaceViewer(){throw Error("QA: 3D out of scoped import/social test")}'))
  page.goto(base,wait_until='networkidle');page.locator('button.nav[data-page="idea"]').click();page.evaluate('(id)=>chooseProject(id)',home);page.locator('[data-source="github"]').click()
  page.locator('#ghVercelProject').fill('https://github.com/octo/demo');page.locator('#ghRepoUrl').fill('octo/demo');page.locator('#ghImportUrl').click();page.locator('#ghImportStatus',has_text='Ô Vercel').wait_for();assert not api('/api/github/import-jobs')['jobs'];record('Wrong GitHub URL in Vercel field gives actionable error before any clone')
  page.locator('#ghVercelProject').fill('');page.locator('#ghRepoUrl').fill('https://github.com/octo/demo');page.locator('#ghImportUrl').click();waitfor(lambda:api('/api/github/import-jobs')['jobs']);page.reload(wait_until='networkidle');page.locator('button.nav[data-page="idea"]').click();page.locator('[data-source="github"]').click();(temp/'release-auth').write_text('go')
  page.locator('#ghImportStatus',has_text='Đã chọn dự án octo/demo').wait_for(timeout=30000);pid=page.evaluate('state.project.id');assert pid!=home;assert page.locator('#globalProjectSelect').input_value()==pid
  project=api('/api/projects/'+pid);assert project['settings']['github']['fullName']=='octo/demo';assert project['modelRoles']['founder'];assert (data/'workspaces'/pid/'app.txt').read_text()=='real imported baseline\n';assert (data/'workspaces'/pid/'README.md').exists();record('Reload during import resumes polling; real Git clone arrives and selects exact imported project with copied verified AI team')
  chat=api('/api/projects/'+pid+'/chat',{'message':'Read the imported project and explain what to fix.'});assert chat['reply'];assert api('/api/projects/'+pid)['messages'][-1]['content'];page.locator('#githubRepoPanel').evaluate('(e)=>e.scrollIntoView({block:"start"})');page.screenshot(path=str(ROOT.parent.parent/'github074-internal.png'));record('Imported project can call its assigned Founder and persist a public reply (AI fixture)')
  page.locator('button.nav[data-page="publish"]').click();page.locator('#socialChannels .card').first.wait_for();assert page.locator('#socialChannels .card').count()==17
  assert 'đăng thủ công' in page.locator('#socialChannels').inner_text();record('17 channel cards separate API publishing scope from manual export')
  for kind in ['threads','x','zalo']:
   page.locator('[data-social-connect="'+kind+'"]').click();page.locator('#socialToken').fill('fake-'+kind);page.locator('#socialVerifyToken').click();page.locator('#modal').wait_for(state='hidden');page.locator('#socialChannels').filter(has_text='Test').wait_for()
   page.locator('#socialPlatform').select_option(kind);page.locator('#socialTitle').fill('UI test '+kind);page.locator('#socialText').fill('Public fixture content for '+kind);page.locator('#socialCover').fill('https://example.com/cover.png' if kind=='zalo' else '');page.locator('#socialSaveDraft').click();waitfor(lambda:len(api('/api/social/drafts?projectId='+pid)['drafts'])==['threads','x','zalo'].index(kind)+1)
   draft=api('/api/social/drafts?projectId='+pid)['drafts'][-1];assert draft['state']=='draft';assert not [c for c in json.loads((data/'qa-social-calls.json').read_text()) if c['method']=='POST' and (c['host']=={'threads':'graph.threads.net','x':'api.x.com','zalo':'openapi.zalo.me'}[kind])]
   page.locator('[data-social-preview="'+draft['id']+'"]').click();page.locator('#socialConfirmPublish').wait_for();assert 'Public fixture content for '+kind in page.locator('#modalBody').inner_text()
   if kind=='x':page.locator('#socialApiCost').check()
   page.locator('#socialConfirmPublish').click();page.locator('#modal').wait_for(state='hidden');waitfor(lambda:api('/api/social/drafts?projectId='+pid)['drafts'][-1]['state']=='published')
   record('UI '+kind+': verify token, save draft without posting, preview exact account/content, explicit publish, confirmed provider ID (social fixture)')
  # Extra channel export is not a remote post.
  page.locator('#socialPlatform').select_option('linkedin');page.locator('#socialTitle').fill('Manual');page.locator('#socialText').fill('Manual export text');page.locator('#socialSaveDraft').click();waitfor(lambda:len(api('/api/social/drafts?projectId='+pid)['drafts'])==4);draft=api('/api/social/drafts?projectId='+pid)['drafts'][-1]
  with page.expect_download() as dl:page.locator('[data-social-export="'+draft['id']+'"]').click()
  target=temp/'export.txt';dl.value.save_as(target);assert 'Manual export text' in target.read_text();assert draft['state']=='draft';record('LinkedIn text export downloads actual file and remains a draft, not a published post')
  page.locator('#socialHub').evaluate('(e)=>e.scrollIntoView({block:"start"})');page.screenshot(path=str(ROOT.parent.parent/'social074-internal.png'));page.reload(wait_until='networkidle');page.locator('button.nav[data-page="publish"]').click();page.evaluate('(id)=>chooseProject(id)',pid);page.locator('#socialDrafts').filter(has_text='Manual export text').wait_for();assert len(api('/api/social/drafts?projectId='+pid)['drafts'])==4
  records=api('/api/publish/records')['records'];assert len([r for r in records if r.get('socialDraftId')])==3;record('Reload preserves four drafts and three confirmed fixture receipts; no extra sends')
  assert not report['errors'],report['errors'];report['status']='PASS';browser.close()
except Exception as e:report['status']='FAIL';report['error']=repr(e);raise
finally:
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=6)
  except ProcessLookupError:pass
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(temp,ignore_errors=True);(OUT/'browser-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'checks':len(report['checks'])}))
