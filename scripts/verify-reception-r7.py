"""R7 shipped frontend + real local HTTP, Git, tests and FFmpeg.
Synthetic AI/cloud fixtures only. No paid calls, no external publication.
Browser loads actual app HTML/CSS/classic JS in memory with authenticated HTTP
bridge; 3D ES modules are not loaded. This is Linux Chromium, not Windows QA.
"""
import os,json,time,tempfile,secrets,subprocess,socket,signal,re,shutil,io,zipfile
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('AIOS_R7_QA_DIR',str(ROOT/'evidence/reception-r7/browser')));OUT.mkdir(parents=True,exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-reception-r7-'))
report={'scope':__doc__.strip(),'radarScanRequests':[],'checks':[],'pageErrors':[],'externalWrites':'none; isolated fixtures'};proc=None

def record(name,detail):
 report['checks'].append({'name':name,'status':'pass','detail':detail});print('PASS',name,flush=True)
def waitfor(fn,timeout=90):
 end=time.time()+timeout;last=None
 while time.time()<end:
  try:
   r=fn()
   if r:return r
  except Exception as e:last=e
  time.sleep(.15)
 raise AssertionError('Timeout: '+str(last))
try:
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
 env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'runtime.log').open('w')
 proc=subprocess.Popen(['node','--import','./scripts/fixtures/reception-app-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=2).ok)
 session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 pid=json.loads((runtime/'data/qa-project-id.json').read_text())['id'];card=json.loads((runtime/'data/qa-news-id.json').read_text())['id']
 def api(url,body=None,method=None):
  r=session.request(method or ('POST' if body is not None else 'GET'),base+url,json=body,timeout=180)
  if not r.ok:raise AssertionError((url,r.status_code,r.text[:700]))
  return r.json()
 def finished(project):
  j=api('/api/projects/'+project+'/work-center')['job'];return j if j and j['state'] not in ['queued','running'] else None
 def work(project,action,input=None):
  r=api('/api/projects/'+project+'/work-center',{'action':action,'input':input or {},'key':secrets.token_hex(16)})
  return waitfor(lambda:finished(project),150)
 caps=api('/api/production/capabilities');assert caps['videoReady'];report['capabilities']=caps
 record('local_media_preflight','FFmpeg and FFprobe detected by actual integration host; no assumed installed speech model.')
 suggestion=api('/api/ingest/fields/suggest',{'label':'Gold jewellery','projectId':pid});assert suggestion['origin']=='ai'
 custom=api('/api/ingest/fields',{'label':'Gold jewellery QA','query':suggestion['query'],'keywords':suggestion['keywords'],'origin':'ai'})['field']
 assert any(f['id']==custom['id'] for f in api('/api/ingest/fields')['fields'])
 record('custom_category_api','AI fixture generated only keywords; real custom-category persistence and reload succeeded.')
 # Article handoff is a draft, not an immediate call/empty failed workflow.
 p=api('/api/reception/handoff',{'pipeline':'news-article','cardId':card,'copyTeamFrom':pid})['project'];articlePid=p['id']
 j=work(articlePid,'prepare');assert j['state']=='completed',j
 r=api('/api/projects/'+articlePid+'/work-center');assert r['roles']['roles']['reviewer']['connectionId']=='ai-c'
 j=work(articlePid,'produce',{'confirm':True,'requestId':r['request']['id']});assert j['state']=='completed',j
 products=api('/api/projects/'+articlePid+'/products')['products'];article=next(x for x in products if x['kind']=='article')
 assert 'example.com' in article['body'] and article['review']['approved'];assert session.get(base+article['download']).ok
 assert not next(r for r in api('/api/orchestrator')['runs'] if r['projectId']==articlePid).get('publish')
 record('article_real_output','Worker text and separate Reviewer stored a real article and downloadable Markdown in the same project. No social publication.')
 p=api('/api/reception/handoff',{'pipeline':'news-video','cardId':card,'copyTeamFrom':pid})['project'];videoPid=p['id']
 j=work(videoPid,'prepare');assert j['state']=='completed',j
 r=api('/api/projects/'+videoPid+'/work-center')
 if not caps['defaultVoice']:
  j=work(videoPid,'produce',{'confirm':True,'requestId':r['request']['id'],'voiceMode':'narrated','ttsProvider':'local'})
  assert j['state']=='failed' and j['error']['code']=='MEDIA_VOICE_REQUIRED',j
  assert not api('/api/projects/'+videoPid+'/work-center')['runs']
  record('missing_voice_before_run','No empty orchestrator run created when narrated output lacks installed voice; user must choose a valid voice or captions explicitly.')
 # Browser verifies actual UI controls and initiates caption render, not a premanufactured success.
 def bridge(spec):
  u=spec.get('url','')
  if not u.startswith('/api/'):return {'status':404,'headers':{},'body':'{}'}
  if u=='/api/ingest/scan':report['radarScanRequests'].append(json.loads(spec.get('body') or '{}'))
  response=session.request(spec.get('method','GET'),base+u,data=spec.get('body'),headers={**spec.get('headers',{}),'Origin':base},timeout=180)
  return {'status':response.status_code,'headers':{'content-type':response.headers.get('content-type','application/json')},'body':response.text}
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':1500,'height':1080},device_scale_factor=1);ctx.expose_function('__apiBridge',bridge)
  html=session.get(base+'/').text
  html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/'public'/m[1].lstrip('/')).read_text()+'</style>',html)
  html=re.sub(r'<script type="module"[^>]*>.*?</script>','',html,flags=re.S)
  html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/'public'/m[1].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>',html)
  shim='''<script>const __storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__storage[k]??null,setItem:(k,v)=>__storage[k]=String(v),removeItem:k=>delete __storage[k],clear:()=>Object.keys(__storage).forEach(k=>delete __storage[k])}});Object.defineProperty(window,'sessionStorage',{value:window.localStorage});window.__qaPending=0;window.__qaClosing=false;const __timers=new Set(),__interval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>{const id=__interval(fn,ms,...args);__timers.add(id);return id;};window.__qaStop=()=>{window.__qaClosing=true;for(const id of __timers)clearInterval(id);};window.fetch=async(url,opts={})=>{if(window.__qaClosing)throw new DOMException('Teardown','AbortError');window.__qaPending++;try{const r=await window.__apiBridge({url:String(url),method:opts.method||'GET',body:opts.body||null,headers:opts.headers||{}});return new Response(r.body,{status:r.status,headers:r.headers});}finally{window.__qaPending--;}};</script>'''
  html=html.replace('<head>','<head>'+shim,1)
  page=ctx.new_page();page.on('pageerror',lambda e:(report['pageErrors'].append(str(e)),print('PAGE_ERROR',str(e),flush=True)));page.route('**/*',lambda r:r.abort())
  page.set_content(html,wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function("document.querySelector('#globalProjectSelect')?.options.length>0 && !customerBooting",timeout=60000)
  page.locator('#globalProjectSelect').select_option(videoPid);page.locator('[data-page="idea"]').first.click()
  page.wait_for_selector('#wcVoice',timeout=30000)
  assert page.locator('#wcVoice').input_value()==''
  page.locator('#wcVoice').select_option('captions');page.locator('#wcConsent').check();page.locator('[data-work="produce"]').click()
  try:
   page.wait_for_function("document.querySelector('#workProducts video')",timeout=60000)
  except Exception:
   (OUT/'failed-ui.txt').write_text(page.locator('body').inner_text());page.screenshot(path=str(OUT/'failed-ui.png'));print('UI_ERRORS',report['pageErrors'],flush=True);raise
  page.locator('.idea-founder').screenshot(path=str(OUT/'video-reception.png'))
  prod=api('/api/projects/'+videoPid+'/products')['products'];video=next(x for x in prod if x['kind']=='video');assert video['narration']==False
  data=session.get(base+video['download']);assert data.ok and len(data.content)>1000
  (OUT/'caption-video.mp4').write_bytes(data.content)
  partial=session.get(base+video['download'],headers={'Range':'bytes=0-1023'});assert partial.status_code==206 and partial.content==data.content[:1024]
  assert session.get(base+video['download'],headers={'Range':'bytes=999999999-'}).status_code==416
  probe=json.loads(subprocess.check_output(['ffprobe','-v','quiet','-show_format','-show_streams','-of','json',str(OUT/'caption-video.mp4')]))
  assert any(s['codec_type']=='video' and s['width']==1280 for s in probe['streams']);assert float(probe['format']['duration'])>3
  subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-ss','2','-i',str(OUT/'caption-video.mp4'),'-frames:v','1',str(OUT/'caption-frame.jpg')],check=True)
  record('caption_video_ui','Explicit empty-by-default voice choice -> caption option + consent -> actual FFmpeg MP4/SRT from app, product pane, ranged download/seek contract; no fake narration.')
  count=len(api('/api/projects/'+videoPid+'/work-center')['runs']);page.evaluate('window.workCenterRefresh()');page.wait_for_timeout(800);assert len(api('/api/projects/'+videoPid+'/work-center')['runs'])==count
  page.locator('[data-work="receive"]').click();waitfor(lambda:finished(videoPid));assert api('/api/projects/'+videoPid+'/work-center')['runs'][0]['state']=='completed'
  record('receive_not_publish','Receive product closes the same local run and does not create public posts or new runs.')
  page.locator('#globalProjectSelect').select_option(articlePid);
  try:page.wait_for_function("document.querySelector('#workProducts').textContent.includes('example.com')",timeout=15000)
  except Exception:
   (OUT/'article-switch-failed.txt').write_text(page.locator('body').inner_text());print('SWITCH_STATE',page.evaluate('({pid:state.project?.id,selected:document.querySelector("#globalProjectSelect").value,active:document.querySelector(".page.active")?.id})'),flush=True);raise
  page.locator('#workProducts').screenshot(path=str(OUT/'article-delivered.png'))
  # Code project: same reception with actual git/test lifecycle.
  page.locator('#globalProjectSelect').select_option(pid);page.wait_for_selector('[data-work="prepare"]',timeout=30000);page.locator('[data-work="prepare"]').click()
  page.wait_for_selector('[data-work="approve"]',timeout=60000);page.locator('#workCenter').screenshot(path=str(OUT/'named-assignments.png'))
  page.locator('#wcSandbox').select_option('host');page.locator('#wcConsent').check();page.locator('#wcHostConsent').check();page.locator('[data-work="approve"]').click()
  page.wait_for_function("document.querySelector('#workProducts a[href$=\"source.zip\"]')",timeout=150000)
  project=api('/api/projects/'+pid);assert project['tasks'] and all(t['status']=='done' and t['review']['approved'] for t in project['tasks']),project['tasks']
  zipbytes=session.get(base+'/api/projects/'+pid+'/products/source.zip').content;(OUT/'source-fixture.zip').write_bytes(zipbytes)
  with zipfile.ZipFile(io.BytesIO(zipbytes)) as z:content=z.read('index.html').decode();assert 'app.test.mjs' in z.namelist()
  product=ctx.new_page();product.set_content(content);product.locator('#counter').click();assert product.locator('#counter').inner_text()=='1';product.close()
  page.locator('#workCenter').scroll_into_view_if_needed();page.locator('#workCenter').screenshot(path=str(OUT/'source-progress.png'))
  page.locator('#workProducts').scroll_into_view_if_needed();page.locator('#workProducts').screenshot(path=str(OUT/'source-delivered.png'))
  record('website_source_reception','Prepare -> approve spec + explicit Host -> AI writes files, independent review, actual npm test and Git merge -> real ZIP. Shipped counter button executes in browser.')
  before_receipt=api('/api/projects/'+pid)
  j=work(pid,'prepare');assert j['result']['stage']=='awaiting-execution-confirmation'
  after_receipt=api('/api/projects/'+pid);assert len(after_receipt['tasks'][0].get('executionRuns',[]))==len(before_receipt['tasks'][0].get('executionRuns',[]))
  record('prepare_never_executes_approved_code','Analysis on an already approved project only asks for explicit execution confirmation; no task rerun or Host command.')
  version=project['approvedSpecificationId'];revision=project['briefRevision']
  api('/api/projects/'+pid+'/chat',{'message':'Please explain the delivered result without changing approved scope.'})
  updated=api('/api/projects/'+pid);assert updated['approvedSpecificationId']==version and updated['briefRevision']==revision
  record('discussion_preserves_scope','A new manager conversation after approval did not invalidate the approved specification or task results.')
  page.locator('[data-page="skills"]').first.click();page.wait_for_timeout(700);assert 'Project Continuity' in page.locator('#page-skills').inner_text() or 'xuy' in page.locator('#page-skills').inner_text()
  record('continuity_skill_hub','The existing continuity skill remains visible in the real Skill Hub.')
  page.locator('[data-page="radar"]').first.click();page.wait_for_selector('#radarAddField')
  page.locator('#radarAddField').click();page.locator('#rfLabel').fill('Jewellery browser category')
  page.locator('#rfSuggest').click();page.wait_for_function('document.querySelector("#rfQuery")?.value.length>2')
  assert page.locator('#rfKeywords').input_value()
  page.locator('#rfSave').click();page.wait_for_function('document.querySelector("#modal").classList.contains("hidden")')
  page.wait_for_function('document.querySelector("#radarField")?.selectedOptions[0]?.text.includes("Jewellery browser category")')
  fid=page.locator('#radarField').input_value()
  src=api('/api/ingest/sources',{'name':'Disabled fixture RSS','url':'https://example.com/disabled-feed','fieldId':fid,'fullText':False})
  sid=src.get('id') or src.get('source',{}).get('id');assert sid
  api('/api/ingest/sources/'+sid+'/enabled',{'enabled':False})
  page.locator('#radarAge').select_option('24');page.locator('#radarScan').click()
  page.wait_for_function('!document.querySelector("#radarScan").disabled')
  assert report['radarScanRequests'][-1]=={'fieldId':fid,'maxAgeHours':24}
  assert '0/0' in page.locator('#radarStatus').inner_text()
  assert not [x for x in api('/api/ingest/sources')['sources'] if x['fieldId']==fid and x['enabled']]
  page.locator('#radarEditField').click();page.locator('#rfLabel').fill('Jewellery browser category saved')
  page.locator('#rfSave').click();page.wait_for_function('document.querySelector("#modal").classList.contains("hidden")')
  waitfor(lambda:any(f['id']==fid and f['label'].endswith('saved') for f in api('/api/ingest/fields')['fields']))
  page.locator('#page-radar').screenshot(path=str(OUT/'radar-custom-category.png'))
  record('radar_custom_ui_and_scoped_scan','Add category -> explicit AI keyword suggestion -> save -> select 24 hours -> scan sends exact category/range. Disabled sources remain disabled; edit persists. This tests controls, not live news-provider coverage.')
  ui_matrix=[]
  for width,height in [(1440,1000),(1024,800)]:
   page.set_viewport_size({'width':width,'height':height})
   for theme in ['ocean','emerald','aurora','arctic','amber']:
    page.locator('#themeSelect').select_option(theme)
    for tab in ['map','connections','idea','studio','radar','skills','engines','publish','guide']:
     page.locator('[data-page="'+tab+'"]').first.click();page.wait_for_timeout(80)
     assert page.locator('#page-'+tab).evaluate('(el)=>el.classList.contains("active")')
     assert page.evaluate('document.documentElement.dataset.theme')==theme
     ui_matrix.append({'tab':tab,'theme':theme,'width':width,'height':height,'routeVisible':True})
  report['uiMatrix']=ui_matrix
  record('nine_tabs_five_themes_two_viewports','90 route/theme/view combinations opened with the shipped frontend. Navigation smoke, not full functional/GPU/Windows acceptance for every tab.')
  page.set_viewport_size({'width':1500,'height':1080});page.locator('#themeSelect').select_option('ocean')
  page.locator('[data-page="idea"]').first.click();api('/api/vault/lock',{});page.wait_for_timeout(3200)
  assert page.locator('#workProducts a').count()==0;assert session.get(base+'/api/projects/'+pid+'/products').status_code==423
  assert session.get(base+video['download']).status_code==423
  record('vault_lock','Private products and receipt endpoints locked and product links cleared; no tokens included in screenshots.')
  page.evaluate('window.__qaStop()');page.wait_for_function('window.__qaPending===0');page.close();browser.close()
  assert not report['pageErrors'],report['pageErrors']
 report['status']='pass'
except Exception as exc:
 report['status']='failed';report['failure']=str(exc);raise
finally:
 if proc and proc.poll() is None:
  os.killpg(proc.pid,signal.SIGTERM)
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 evidence=runtime/'data/qa-provider-evidence.json'
 if evidence.exists():shutil.copyfile(evidence,OUT/'provider-fixture-evidence.json')
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('REPORT',OUT/'report.json',flush=True)
 shutil.rmtree(runtime,ignore_errors=True)
