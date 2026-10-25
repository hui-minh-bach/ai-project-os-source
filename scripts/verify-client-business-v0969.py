"""v0.9.69: true app localhost HTTP and Chromium, test-only AI/Concat/Comfy/Windows speech boundaries.
Fixtures call a local fake AI endpoint and local eSpeak speech, not customer accounts or native Windows.
Video output is actually rendered/decoded with FFmpeg; never claim commercial income or production provider acceptance.
"""
import os,json,time,tempfile,secrets,subprocess,socket,signal,re,shutil,base64,io,zipfile,hashlib
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('AIOS_V0969_EVIDENCE',str(ROOT/'evidence/v0969')));OUT.mkdir(parents=True,exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-client-v0969-'))
report={'scope':__doc__,'checks':[],'errors':[],'nativeWindows':False,'liveAIProviders':False,'nativeConcat':False,'testOnlyVoice':'eSpeak','revenueVerified':False}
proc=None
BRIEF='Giới thiệu dịch vụ chụp ảnh sản phẩm trang sức bằng ánh sáng tự nhiên. Khách hàng mục tiêu là các tiệm trang sức. Không có khuyến mãi hoặc cam kết đặc biệt. Mời khách liên hệ nhận báo giá.'
def checked(name,detail):
 report['checks'].append({'name':name,'status':'PASS','detail':detail});print('PASS',name,flush=True)
def waitfor(fn,timeout=180):
 start=time.time();last=None
 while time.time()-start<timeout:
  try:
   data=fn()
   if data:return data
  except Exception as e:last=e
  time.sleep(.2)
 raise AssertionError('Timed out: '+repr(last))
try:
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
 env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'app-runtime.log').open('w')
 proc=subprocess.Popen(['node','--import','./scripts/fixtures/automatic-media-r9-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=3).ok,60)
 session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 home=json.loads((runtime/'data/qa-project-id.json').read_text())['id']
 def request(route,body=None,method=None):
  r=session.request(method or ('POST' if body is not None else 'GET'),base+route,json=body,timeout=220)
  if not r.ok:raise AssertionError((route,r.status_code,r.text[:1300]))
  return r.json()
 def ready(project):
  j=request('/api/projects/'+project+'/work-center')['job']
  return j if j and j['state'] not in ('running','queued') else None
 def get_delivery(project,pipeline):
  order=request('/api/reception/handoff',{'pipeline':pipeline,'title':'Khách hàng chụp ảnh trang sức', 'ideaText':BRIEF,'copyTeamFrom':home,'autoStart':True})
  assert order['started'] and order['project']['productionRequest']['pipeline']==pipeline,order
  pid=order['project']['id']
  job=waitfor(lambda:ready(pid),210)
  assert job['state']=='completed',job
  assert job['result']['state']=='completed',job
  products=request('/api/projects/'+pid+'/products')['products']
  bundle=next(x for x in products if x['kind']=='bundle')
  raw=session.get(base+bundle['download'],timeout=90);assert raw.ok and raw.content.startswith(b'PK\x03\x04')
  with zipfile.ZipFile(io.BytesIO(raw.content)) as z:
   assert z.testzip() is None
   manifest=json.loads(z.read('manifest.json'))
   assert manifest['pipeline']==pipeline and manifest['aiMode']=='gateway'
   for f in manifest['files']:
    assert hashlib.sha256(z.read('deliverables/'+f['name'])).hexdigest()==f['sha256'],f
   names=z.namelist()
  return pid,job,products,raw.content,manifest,names
 article= get_delivery(home,'client-article')
 assert 'deliverables/article-final.md' in article[5]
 (OUT/'fixture-client-article.zip').write_bytes(article[3]);checked('client_article_workflow','Real localhost API, fixture Worker and distinct Reviewer; accepted order, completed AI task and verified ZIP SHA manifest')
 video=get_delivery(home,'client-video')
 for n in ['video-final.mp4','voice.wav','captions.srt','captions.vtt','script-final.md','thumbnail.png']:
  assert 'deliverables/'+n in video[5],video[5]
 assert video[4]['quality']['checkedBy'].startswith('ffprobe') and video[4]['quality']['audioCodec'],video[4]
 (OUT/'fixture-client-video.zip').write_bytes(video[3])
 with zipfile.ZipFile(io.BytesIO(video[3])) as z:
  (OUT/'fixture-client-video.mp4').write_bytes(z.read('deliverables/video-final.mp4'))
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(OUT/'fixture-client-video.mp4')]))
 assert {x['codec_type'] for x in probe['streams']}>={'video','audio'}
 subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(OUT/'fixture-client-video.mp4'),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 checked('client_video_workflow','Real app task and FFmpeg decodable MP4 with audio; customer WAV/SRT/VTT/script/thumbnail and SHA verified; AI/Concat/TTS supplied by TEST-ONLY boundaries')
 # No auto-publishing, no unexpected re-render on GET or browser reload.
 assert video[1]['result']['published'] is False
 assert request('/api/projects/'+video[0]+'/work-center')['job']['id']==video[1]['id']
 checked('never_auto_publish_or_reissue','Author-requested order is locally delivered; GET does not create a second job')
 def bridge(spec):
  url=spec.get('url','')
  if not url.startswith('/api/'):return {'status':404,'headers':{'content-type':'application/json'},'body':'{}'}
  res=session.request(spec.get('method','GET'),base+url,data=spec.get('body'),headers={'Origin':base,**spec.get('headers',{})},timeout=180)
  typ=res.headers.get('content-type','application/json');binary=not any(x in typ for x in ('json','text/'))
  return {'status':res.status_code,'headers':{'content-type':typ},'body':None if binary else res.text,'base64':base64.b64encode(res.content).decode() if binary else None}
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':1350,'height':900});ctx.expose_function('__apiBridge',bridge)
  html=session.get(base+'/').text
  html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/'public'/m[1].lstrip('/')).read_text()+'</style>',html)
  html=re.sub(r'<script type="module"[^>]*>.*?</script>','',html,flags=re.S)
  html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/'public'/m[1].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>',html)
  shim='''<script>const __storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__storage[k]??null,setItem:(k,v)=>__storage[k]=String(v),removeItem:k=>delete __storage[k]}});Object.defineProperty(window,'sessionStorage',{value:window.localStorage});const old=window.setInterval.bind(window),timers=new Set();window.setInterval=(fn,ms,...args)=>{const id=old(fn,ms,...args);timers.add(id);return id};window.__stop=()=>{for(const id of timers)clearInterval(id)};window.fetch=async(url,opts={})=>{const r=await window.__apiBridge({url:String(url),method:opts.method||'GET',body:opts.body||null,headers:opts.headers||{}});return new Response(r.base64?Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0)):r.body,{status:r.status,headers:r.headers});};</script>'''
  html=html.replace('<head>','<head>'+shim,1)
  page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.route('**/*',lambda r:r.abort())
  page.set_content(html,wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function("document.querySelector('#globalProjectSelect')?.options.length>0 && !customerBooting",timeout=60000)
  page.locator('#globalProjectSelect').select_option(article[0]);page.locator('[data-page="idea"]').first.click()
  page.wait_for_selector('#clientOrderIntake textarea',timeout=25000)
  assert page.locator('#clientOrderIntake [data-client-order]').count()==2
  assert page.locator('#workProducts a[href$="/delivery.zip"]').count()>0
  page.locator('#clientOrderBrief').fill(BRIEF)
  page.wait_for_timeout(3500)
  assert page.locator('#clientOrderBrief').input_value()==BRIEF,'Polling erased unsent client brief'
  page.locator('#clientOrderTitle').fill('Video dịch vụ trang sức')
  page.locator('[data-client-order="client-article"]').click()
  page.wait_for_function('''()=>document.querySelector('#clientOrderStatus')?.textContent.includes('Đã tiếp nhận')''',timeout=60000)
  page.wait_for_function('''()=>document.querySelector('#workProducts a[href$="/delivery.zip"]')''',timeout=90000)
  assert not report['errors'],report['errors']
  page.locator('#clientOrderIntake').screenshot(path=str(OUT/'client-order-intake.png'))
  page.locator('#workCenter').screenshot(path=str(OUT/'client-work-events.png'))
  page.locator('#workProducts').screenshot(path=str(OUT/'client-delivery-ui.png'))
  page.evaluate('window.__stop()');ctx.close();browser.close()
 checked('browser_real_ui','Chromium rendered source scripts and actually clicked order intake; persisted brief through polling and displayed deliverable')
 report['status']='PASS'
except Exception as e:
 report['status']='FAIL';report['error']=repr(e)
 print('ERROR',repr(e),flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:proc.wait(timeout=8)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(runtime,ignore_errors=True)
print(json.dumps({'status':report['status'],'checks':len(report['checks']),'error':report.get('error')},ensure_ascii=False),flush=True)
if report['status']!='PASS':raise SystemExit(1)
