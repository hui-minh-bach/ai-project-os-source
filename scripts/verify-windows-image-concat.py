"""App UI + actual HTTP/media production, with OS speech and AI/Concat protocol fixtures.
NOT native Windows, live AI image generation or native Concat acceptance.
Audio is eSpeak and final fixture export is FFmpeg; the app dispatches Concat commands.
"""
import os,json,time,tempfile,secrets,subprocess,socket,signal,re,shutil,io,base64
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('AIOS_MEDIA_QA_DIR',str(ROOT/'evidence/media-pipeline/browser')));OUT.mkdir(parents=True,exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-media-pipeline-'))
report={'scope':__doc__.strip(),'checks':[],'pageErrors':[],'voice':'eSpeak vi via test-only Windows boundary; not native Windows','neuralPiperTested':False,'externalCalls':'No live AI/cloud actions','webglTested':False};proc=None

def wait_js(expr,timeout=30000):
 return waitfor(lambda:page.evaluate(expr),timeout/1000)

def record(name,detail):
 report['checks'].append({'name':name,'status':'pass','detail':detail});print('PASS',name,flush=True)
def waitfor(fn,timeout=90):
 end=time.time()+timeout;last=None
 while time.time()<end:
  try:
   r=fn()
   if r:return r
  except Exception as e:last=e
  time.sleep(.2)
 raise AssertionError('Timeout: '+str(last))
try:
 if not shutil.which('espeak'):raise RuntimeError('eSpeak required for isolated OS boundary fixture')
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
 env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'runtime.log').open('w');proc=subprocess.Popen(['node','--import','./scripts/fixtures/media-pipeline-app-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=2).ok)
 session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 pid=json.loads((runtime/'data/qa-project-id.json').read_text())['id'];card=json.loads((runtime/'data/qa-news-id.json').read_text())['id']
 def api(url,body=None,method=None):
  r=session.request(method or ('POST' if body is not None else 'GET'),base+url,json=body,timeout=240)
  if not r.ok:raise AssertionError((url,r.status_code,r.text[:1000]))
  return r.json()
 def finished(project):
  j=api('/api/projects/'+project+'/work-center')['job'];return j if j and j['state'] not in ['queued','running'] else None
 def work(project,action,input=None):
  api('/api/projects/'+project+'/work-center',{'action':action,'input':input or {},'key':secrets.token_hex(16)});return waitfor(lambda:finished(project),180)
 def bridge(spec):
  u=spec.get('url','')
  if not u.startswith('/api/'):return {'status':404,'headers':{},'body':'{}'}
  body=base64.b64decode(spec['bodyBase64']) if spec.get('bodyBase64') is not None else spec.get('body')
  response=session.request(spec.get('method','GET'),base+u,data=body,headers={**spec.get('headers',{}),'Origin':base},timeout=240)
  typ=response.headers.get('content-type','application/json');binary=not any(x in typ for x in ['json','text/'])
  return {'status':response.status_code,'headers':{'content-type':typ},'body':None if binary else response.text,'base64':base64.b64encode(response.content).decode() if binary else None}
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);ctx=browser.new_context(viewport={'width':1500,'height':1080},device_scale_factor=1);ctx.expose_function('__apiBridge',bridge)
  direct=ctx.new_page()
  try:
   rr=direct.goto(base+'/?launch='+token,wait_until='domcontentloaded',timeout=20000);report['directBrowserNavigation']={'status':rr.status}
  except Exception as e:report['directBrowserNavigation']={'status':'blocked','reason':str(e).split(' at http')[0]}
  direct.close()
  raw=session.get(base+'/');csp=raw.headers['content-security-policy'];report['productionCsp']=csp
  html=raw.text
  html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(ROOT/'public'/m[1].lstrip('/')).read_text()+'</style>',html)
  html=re.sub(r'<script type="module"[^>]*>.*?</script>','',html,flags=re.S)
  html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/'public'/m[1].lstrip('/')).read_text().replace('</script','<\\/script')+'</script>',html)
  shim='''<script>const __storage={};Object.defineProperty(window,'localStorage',{value:{getItem:k=>__storage[k]??null,setItem:(k,v)=>__storage[k]=String(v),removeItem:k=>delete __storage[k],clear:()=>Object.keys(__storage).forEach(k=>delete __storage[k])}});Object.defineProperty(window,'sessionStorage',{value:window.localStorage});window.__qaPending=0;window.__qaClosing=false;const __timers=new Set(),__interval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>{const id=__interval(fn,ms,...args);__timers.add(id);return id;};window.__qaStop=()=>{window.__qaClosing=true;for(const id of __timers)clearInterval(id);};window.fetch=async(url,opts={})=>{if(window.__qaClosing)throw new DOMException('Teardown','AbortError');window.__qaPending++;try{let b64=null,body=opts.body||null;if(body instanceof Blob){const a=new Uint8Array(await body.arrayBuffer());let s='';for(const x of a)s+=String.fromCharCode(x);b64=btoa(s);body=null;}const r=await window.__apiBridge({url:String(url),method:opts.method||'GET',body,bodyBase64:b64,headers:opts.headers||{}});return new Response(r.base64?Uint8Array.from(atob(r.base64),c=>c.charCodeAt(0)):r.body,{status:r.status,headers:r.headers});}finally{window.__qaPending--;}};</script>'''
  html=html.replace('<head>','<head>'+shim,1)
  page=ctx.new_page();page.on('pageerror',lambda e:(report['pageErrors'].append(str(e)),print('PAGE_ERROR',str(e),flush=True)));page.route('**/*',lambda r:r.abort());page.on('dialog',lambda d:d.accept())
  page.set_content(html,wait_until='domcontentloaded',timeout=60000);wait_js("document.querySelector('#globalProjectSelect')?.options.length>0 && !customerBooting",timeout=60000)
  page.evaluate("csp=>{const m=document.createElement('meta');m.httpEquiv='Content-Security-Policy';m.content=csp;document.head.append(m);}",csp)
  videoPid=api('/api/reception/handoff',{'pipeline':'idea-film','ideaText':'Create a short illustrative film about a team helping customers. Two scenes, concise narration.','title':'QA media pipeline - synthetic inputs','copyTeamFrom':pid})['project']['id']
  assert work(videoPid,'prepare')['state']=='completed'
  page.evaluate('async()=>{await loadProjects();}')
  page.locator('#globalProjectSelect').select_option(videoPid)
  page.locator('[data-page="idea"]').first.click()
  wait_js(f"state.project.id==={json.dumps(videoPid)} && document.querySelector('#workCenter').dataset.project==={json.dumps(videoPid)} && !!document.querySelector('#wcWindowsVoice')")
  assert page.locator('#wcVoice').input_value()=='windows'
  assert page.locator('#wcWindowsVoice').input_value()=='winrt:fixture-vi'
  assert page.locator('#wcRenderer').input_value()=='concat'
  assert page.locator('#wcVisual').input_value()=='ai'
  assert not page.locator('#wcConsent').is_checked()
  assert not page.locator('#wcImagePaid').is_checked()
  record('sane_defaults','Installed Windows voice + automatic image pool + Concat; paid API permission is not preselected.')
  page.locator('[data-work="preview-voice"]').click()
  page.wait_for_selector('#wcVoicePreview audio',timeout=30000)
  preview=page.locator('#wcVoicePreview audio').get_attribute('src')
  r=session.get(base+preview);assert r.ok and r.content[:4]==b'RIFF'
  record('speech_preview','Actual WAV returned and readable; voice engine is the declared eSpeak OS fixture.')
  page.locator('#wcImagePaid').check()
  page.locator('[data-work="check-pipeline"]').click()
  wait_js("document.querySelector('#wcPipelineStatus')?.textContent.includes('Artist B')")
  ev=json.loads((runtime/'data/qa-media-evidence.json').read_text());assert not ev['imageAttempts'] and ev['concatExports']==0
  page.locator('#workCenter').screenshot(path=str(OUT/'pipeline-ready.png'))
  record('preflight_no_spend','Voice/model catalog/Concat readiness checked before any image or final render.')
  page.locator('#wcConsent').check();page.locator('[data-work="produce"]').click()
  waitfor(lambda: any(p['kind']=='video' for p in api('/api/projects/'+videoPid+'/products')['products']),180)
  page.wait_for_selector('#workProducts video',timeout=30000)
  v=next(p for p in api('/api/projects/'+videoPid+'/products')['products'] if p['kind']=='video')
  binary=session.get(base+v['download'],timeout=60);assert binary.ok and len(binary.content)>1000
  output=OUT/'pipeline-diagnostic-NOT-native-windows-concat.mp4';output.write_bytes(binary.content)
  partial=session.get(base+v['download'],headers={'Range':'bytes=0-1023'});assert partial.status_code==206 and partial.content==binary.content[:1024]
  probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(output)]));assert any(s['codec_type']=='video' for s in probe['streams']) and any(s['codec_type']=='audio' for s in probe['streams'])
  subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(output),'-f','null','-'],check=True)
  subprocess.run(['ffmpeg','-loglevel','error','-y','-ss','2','-i',str(output),'-frames:v','1',str(OUT/'diagnostic-frame.jpg')],check=True)
  report['video']={'seconds':probe['format']['duration'],'streams':[{k:s.get(k) for k in ['codec_type','codec_name','width','height']} for s in probe['streams']],'file':output.name}
  time.sleep(.6);ev=json.loads((runtime/'data/qa-media-evidence.json').read_text())
  assert ev['imageAttempts'][0]=={'account':'artist-a','status':429} and ev['imageAttempts'][1]=={'account':'artist-b','status':200},ev
  assert ev['concatExports']==1 and ev['concatProjects']==1 and not ev['concatFailures'],ev
  assert 'export.run' in ev['concatMethods'] and 'project.save' in ev['concatMethods'] and 'project.close' in ev['concatMethods']
  report['providerEvidence']=ev
  page.locator('#workProducts').screenshot(path=str(OUT/'product-delivered.png'))
  record('end_to_end_reception','Same reception request produces a reviewed MP4 via Windows speech boundary, A429 -> B image handoff, actual Concat RPC calls and fixture export, then product download and Range decode.')
  count=ev['concatExports'];page.evaluate('async()=>{await window.workCenterRefresh();}');time.sleep(1)
  assert json.loads((runtime/'data/qa-media-evidence.json').read_text())['concatExports']==count
  record('refresh_no_duplicate','Refreshing product view does not generate new images or export again.')
  otherPid=api('/api/reception/handoff',{'pipeline':'idea-film','ideaText':'Another separate idea.','title':'Second fixture','copyTeamFrom':pid})['project']['id'];assert work(otherPid,'prepare')['state']=='completed'
  page.evaluate('async()=>{await loadProjects();}')
  page.locator('#globalProjectSelect').select_option(otherPid)
  wait_js(f"document.querySelector('#workCenter').dataset.project==={json.dumps(otherPid)} && !!document.querySelector('#wcImagePaid')")
  assert not page.locator('#wcImagePaid').is_checked() and not page.locator('#wcConsent').is_checked()
  record('consent_isolation','Paid image permission and request approval are not carried into another project.')
  page.locator('[data-page="studio"]').first.click();page.locator('[data-media-mode="story"]').click()
  assert page.locator('#mediaStoryTtsProvider').input_value()=='windows'
  assert page.locator('#mediaStoryRenderer').input_value()=='concat'
  record('studio_same_pipeline','Video Studio exposes the same Windows/Concat path as reception.')
  api('/api/vault/lock',{})
  assert session.get(base+v['download']).status_code==423 and session.post(base+'/api/production/prepare',json={}).status_code==423
  assert requests.get(base+'/api/production/windows-voices').status_code==401
  record('access_controls','Unauthenticated voice enumeration and locked-vault production/product access are refused.')
  assert not report['pageErrors'],report['pageErrors']
  page.evaluate('window.__qaStop()');wait_js('window.__qaPending===0',timeout=30000);browser.close()
 report['status']='pass'
except Exception as e:
 report['status']='failed';report['error']=str(e);print('FAILED',str(e),flush=True)
 try:page.screenshot(path=str(OUT/'failed.png'));(OUT/'failed-dom.txt').write_text(page.locator('body').inner_text())
 except Exception:pass
 raise
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(8)
  except Exception:
   try:os.killpg(proc.pid,signal.SIGKILL)
   except:pass
 shutil.rmtree(runtime,ignore_errors=True)
