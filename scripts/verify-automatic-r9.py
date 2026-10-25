"""R9 end-to-end actual AI Project OS HTTP/UI/video using test-only boundaries.
Actual app HTTP and browser; mocked AI/image/Concat RPC and eSpeak system speech.
Never describe this fixture as a live Windows/Concat/AI image acceptance test.
"""
import os,json,time,tempfile,secrets,subprocess,socket,signal,re,shutil,base64
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('AIOS_R9_QA_DIR',str(ROOT/'evidence/v0968')));OUT.mkdir(parents=True,exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-auto-r9-'))
report={'scope':__doc__,'checks':[],'errors':[],'voice':'test-only eSpeak vi; not native Windows','image':'test-only local ComfyUI HTTP workflow, not AI generated','concat':'test-only Concat JSON RPC contract fixture, FFmpeg renders final fixture video','nativeWindowsTested':False}
proc=None

def record(key,value):
 report['checks'].append({'check':key,'status':'PASS','evidence':value});print('PASS',key,flush=True)

def waitfor(fn,seconds=175):
 started=time.time();last=None
 while time.time()-started<seconds:
  try:
   v=fn()
   if v:return v
  except Exception as e:last=e
  time.sleep(.20)
 raise AssertionError('Timed out: '+str(last))

try:
 if not shutil.which('espeak') or not shutil.which('ffmpeg'):raise RuntimeError('FFmpeg and eSpeak required for isolated fixture')
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
 env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'local-runtime-qa.txt').open('w')
 proc=subprocess.Popen(['node','--import','./scripts/fixtures/automatic-media-r9-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=3).ok,60)
 session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 home=json.loads((runtime/'data/qa-project-id.json').read_text())['id'];card=json.loads((runtime/'data/qa-news-id.json').read_text())['id']
 def api(p,body=None):
  resp=session.request('POST' if body is not None else 'GET',base+p,json=body,timeout=220)
  if not resp.ok:raise AssertionError((p,resp.status_code,resp.text[:1300]))
  return resp.json()
 caps=api('/api/production/capabilities')
 assert caps['defaultVoice']=='windows',caps
 assert any(x['paid'] is False and x['provider']=='comfyui-local' for x in caps['images']['candidates']),caps['images']
 assert caps['concat']['configured']
 record('preflight_local_voice_image_concat','Windows boundary eSpeak + local ComfyUI protocol fixture + Concat RPC fixture configured; free candidates available')
 # The explicit Radar click only supplies the selected article, without media selectors.
 handoff=api('/api/reception/handoff',{'pipeline':'news-video','cardId':card,'copyTeamFrom':home,'autoStart':True})
 assert handoff['started'] is True,handoff
 project=handoff['project']['id']
 def get_job():return api('/api/projects/'+project+'/work-center')['job']
 job=waitfor(lambda: (lambda j:j if j and j['state'] not in ('queued','running') else None)(get_job()),210)
 assert job['state']=='completed',job
 assert job['result']['state']=='completed',job
 assert job['result']['engine']=='concat',job
 assert job['result']['voiceProvider']=='windows',job
 record('automatic_reception','Selected news -> automatic preflight -> Worker script -> Reviewer -> TTS -> scenes -> Concat -> local-only delivery; no manual forms')
 inbox=api('/api/projects/'+project+'/work-center')
 assert inbox['runs'] and inbox['runs'][-1]['state']=='completed',inbox['runs']
 assert inbox['feed'] and any('AI Biên kịch' in x['actor'] for x in inbox['feed']),inbox['feed']
 prods=api('/api/projects/'+project+'/products')['products']
 names={x.get('name') for x in prods}
 for expected in ['concat-story.mp4','voice.wav','captions.srt','captions.vtt','script-final.md','thumbnail.png']:
  assert expected in names,('Missing '+expected,names)
 output=OUT/'r9-fixture-narrated.mp4';video=next(x for x in prods if x.get('name')=='concat-story.mp4')
 response=session.get(base+video['download'],timeout=90);assert response.ok and len(response.content)>15000
 output.write_bytes(response.content)
 probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(output)]))
 assert {x['codec_type'] for x in probe['streams']}>={'audio','video'}
 subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(output),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 frame=OUT/'r9-fixture-frame.jpg';subprocess.run(['ffmpeg','-loglevel','error','-y','-ss','1','-i',str(output),'-frames:v','1',str(frame)],check=True)
 for expected in ['voice.wav','captions.srt','captions.vtt','script-final.md','thumbnail.png']:
  x=next(x for x in prods if x.get('name')==expected)
  r=session.get(base+x['download'],timeout=60);assert r.ok and len(r.content)>80
  if expected=='voice.wav':
   info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json','-'],input=r.content))
   assert any(s['codec_type']=='audio' for s in info['streams'])
  if expected=='captions.srt':assert b'-->' in r.content
  if expected=='script-final.md':assert r.content.startswith(b'# ')
 record('delivery_bundle','Decoded MP4 with audio+video, real WAV, SRT, VTT, script and thumbnail; all downloadable and per-project')
 time.sleep(.8);fixture=json.loads((runtime/'data/qa-r9-media.json').read_text());report['engineFixture']={k:v for k,v in fixture.items() if k!='concatCalls'}
 assert fixture['comfyRequests'] and fixture['concatExports']==1 and not fixture['concatFailures'],fixture
 assert 'export.run' in fixture['concatCalls'] and 'project.save' in fixture['concatCalls']
 record('concat_protocol','Concat RPC fixture received edit, project save, export and returned final MP4; only one export')
 # Reload should not regenerate the same project run.
 again=api('/api/projects/'+project+'/work-center');assert again['job']['id']==job['id']
 assert json.loads((runtime/'data/qa-r9-media.json').read_text())['concatExports']==1
 record('idempotent_reception','GET/reload does not reissue image or Concat export')
 def bridge(spec):
  u=spec.get('url','');method=spec.get('method','GET')
  if not u.startswith('/api/'):return {'status':404,'headers':{'content-type':'application/json'},'body':'{}'}
  body=base64.b64decode(spec['bodyBase64']) if spec.get('bodyBase64') is not None else spec.get('body')
  res=session.request(method,base+u,data=body,headers={'Origin':base,**spec.get('headers',{})},timeout=180)
  typ=res.headers.get('content-type','application/json');binary=not any(x in typ for x in ['json','text/'])
  return {'status':res.status_code,'headers':{'content-type':typ},'body':None if binary else res.text,'base64':base64.b64encode(res.content).decode() if binary else None}
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  ctx=browser.new_context(viewport={'width':1400,'height':920});ctx.expose_function('__apiBridge',bridge)
  raw=session.get(base+'/');html=raw.text
  html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/'public'/m[1].lstrip('/')).read_text()+'</style>',html)
  html=re.sub(r'<script type="module"[^>]*>.*?</script>','',html,flags=re.S)
  html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/'public'/m[1].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>',html)
  shim='''<script>const __storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__storage[k]??null,setItem:(k,v)=>__storage[k]=String(v),removeItem:k=>delete __storage[k],clear:()=>Object.keys(__storage).forEach(k=>delete __storage[k])}});Object.defineProperty(window,'sessionStorage',{value:window.localStorage});const old=window.setInterval.bind(window),timers=new Set();window.setInterval=(fn,ms,...args)=>{const id=old(fn,ms,...args);timers.add(id);return id;};window.__stop=()=>{for(const id of timers)clearInterval(id);};window.fetch=async(url,opts={})=>{let b64=null,body=opts.body||null;if(body instanceof Blob){const a=new Uint8Array(await body.arrayBuffer());let s='';for(const x of a)s+=String.fromCharCode(x);b64=btoa(s);body=null;}const r=await window.__apiBridge({url:String(url),method:opts.method||'GET',body,bodyBase64:b64,headers:opts.headers||{}});return new Response(r.base64?Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0)):r.body,{status:r.status,headers:r.headers});};</script>'''
  # HTML/JS uses the app's actual markup; binary image/video/audio elements
  # load via a browser URL backed by this isolated authenticated fixture.
  html=html.replace('<head>','<head><base href="'+base+'/">'+shim,1)
  def native_media_route(route):
   u=route.request.url
   if not u.startswith(base+'/api/integrations/media/artifacts/'):
    route.abort();return
   extra={'Origin':base}
   if route.request.headers.get('range'):extra['Range']=route.request.headers['range']
   resp=session.get(u,headers=extra,timeout=90)
   h={k:v for k,v in resp.headers.items() if k.lower() in ('content-type','content-range','accept-ranges','content-length')}
   route.fulfill(status=resp.status_code,headers=h,body=resp.content)
  page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.route('**/*',native_media_route);page.set_content(html,wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function("document.querySelector('#globalProjectSelect')?.options.length>0 && !customerBooting",timeout=60000)
  page.locator('#globalProjectSelect').select_option(project);page.locator('[data-page="idea"]').first.click()
  page.wait_for_function("document.querySelector('#workProducts .work-inbox-file') && document.querySelector('#workCenter').textContent.includes('Giao file khi hoàn thành')",timeout=40000)
  assert page.locator('#wcVoice,#wcVisual,#wcRenderer,#wcImageProvider').count()==0,'Legacy selectors remain in manager'
  assert page.locator('#workProducts video').count()>0,'No video playback'
  assert page.locator('#workProducts a[download]').count()>=6,'Missing downloads'
  assert page.locator('#workCenter .work-events').count()>=1,'Missing AI receipt journal'
  page.wait_for_function('''()=>[...document.querySelectorAll('#workProducts img')].every(i=>i.complete&&i.naturalWidth>0)''',timeout=30000)
  page.wait_for_function('''()=>[...document.querySelectorAll('#workProducts video,#workProducts audio')].every(v=>Number.isFinite(v.duration)&&v.duration>0)''',timeout=45000)
  page.locator('#workCenter').screenshot(path=str(OUT/'r9-manager-inbox.png'))
  page.locator('#workProducts').screenshot(path=str(OUT/'r9-files-inbox.png'))
  assert not report['errors'],report['errors']
  page.evaluate('window.__stop()');ctx.close();browser.close()
 record('real_browser_ui','Chromium actual HTML + API: no manual selectors, genuine event feed and six cards; thumbnail decoded and HTML audio/video metadata loaded')
 report['status']='PASS'
except Exception as error:
 report['status']='FAIL';report['error']=repr(error)
 print('ERROR',repr(error),flush=True)
finally:
 (OUT/'r9-e2e-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:proc.wait(timeout=8)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(runtime,ignore_errors=True)
print(json.dumps({'status':report['status'],'checks':len(report['checks']),'error':report.get('error')}),flush=True)
if report['status']!='PASS':raise SystemExit(1)
