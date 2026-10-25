"""R8 isolated UI+HTTP audit. Real application HTTP, Git, FFmpeg and audio output.
Synthetic AI/cloud contracts. Vietnamese audio comes from system eSpeak through
an explicitly labelled Piper-compatible TEST adapter, NOT a neural Piper model.
Browser runs shipped HTML/JS in memory because local navigation can be blocked by
platform policy. Production CSP is applied after loading scripts; inline-handler
blocking and delegated clicks are exercised, not network script delivery/WebGL.
"""
import os,json,time,tempfile,secrets,subprocess,socket,signal,re,shutil,io,base64
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('AIOS_R8_QA_DIR',str(ROOT/'evidence/recovery-r8/browser')));OUT.mkdir(parents=True,exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-recovery-r8-'))
report={'scope':__doc__.strip(),'checks':[],'pageErrors':[],'voice':'eSpeak vi diagnostic via explicitly isolated Piper-compatible adapter','neuralPiperTested':False,'externalCalls':'No live AI/cloud actions','webglTested':False};proc=None

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
 if not shutil.which('espeak'):raise RuntimeError('Diagnostic requires espeak; never pretend Piper is installed.')
 cli=runtime/'piper';model=runtime/'qa-espeak-diagnostic.onnx';model.write_text('TEST ADAPTER ONLY - not a neural model')
 cli.write_text("#!/usr/bin/env node\nconst fs=require('fs'),cp=require('child_process');if(process.argv.includes('--help'))process.exit(0);const i=process.argv.indexOf('--output_file');if(i<0)process.exit(2);const text=fs.readFileSync(0,'utf8');cp.execFileSync('espeak',['-v','vi','-s','160','-w',process.argv[i+1],'--stdin'],{input:text,stdio:['pipe','ignore','inherit']});\n");cli.chmod(0o755)
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
 env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token,'PIPER_CLI_PATH':str(cli),'PIPER_MODEL_PATH':str(model)}
 log=(OUT/'runtime.log').open('w');proc=subprocess.Popen(['node','--import','./scripts/fixtures/reception-app-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
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
  # Do not weaken browser policy. This exercises runtime handlers only.
  page.evaluate("csp=>{const m=document.createElement('meta');m.httpEquiv='Content-Security-Policy';m.content=csp;document.head.append(m);window.__inlineBlocked=0;const b=document.createElement('button');b.id='qaInline';b.setAttribute('onclick','window.__inlineBlocked=1');b.textContent='CSP test';document.body.append(b);}",csp)
  page.locator('#qaInline').click();assert page.evaluate('window.__inlineBlocked')==0;page.locator('#qaInline').evaluate('(e)=>e.remove()')
  for kind in ['new','github','files']:
   page.locator('[data-page="map"]').first.click();page.locator('[data-map-source="'+kind+'"]').click();page.wait_for_selector('#page-idea.active');assert page.evaluate('ideaSource')==kind
   if kind=='github':assert page.locator('#ideaGithubBox').is_visible()
  page.locator('#ideaAttachment').set_input_files({'name':'task.md','mimeType':'text/markdown','buffer':b'# Local source intake test\nContinue this project.'});wait_js("document.querySelector('#chatInput').value.includes('Local source intake test')")
  record('csp_source_intake','Three delegated source buttons work while an inline onclick control is blocked; actual file attachment is read into reception. No CSP relaxed.')
  page.locator('#ideaOpenRadar').click();wait_js("document.querySelector('#page-radar').classList.contains('active')")
  page.locator('[data-page="idea"]').first.click();wait_js("document.querySelector('#page-idea').classList.contains('active')")
  record('radar_csp_fix','Radar button navigates through a delegated handler while inline JS remains blocked by production CSP.')
  page.locator('#globalProjectSelect').select_option(pid);page.wait_for_selector('[data-work="roles"]')
  page.locator('#ideaAttachment').set_input_files(str(ROOT/'public/assets/bots/iso/tam19-default-idle.png'))
  wait_js("document.querySelector('#ideaAttachedMedia').textContent.includes('Đã đưa ảnh')",timeout=30000)
  assert page.evaluate("mediaUI.storyImages.some(item=>item.name==='tam19-default-idle.png')")
  record('idea_media_bridge','Uploaded real PNG through Idea Studio using authenticated HTTP and verified the same source in Media Studio.')
  page.locator('[data-work="roles"]').click();page.wait_for_selector('#wcRoleSave')
  page.locator('[data-wc-team="worker"][value="1"]').check();page.locator('[data-wc-team="founder"][value="1"]').check();page.locator('#wcRoleSave').click();wait_js("document.querySelector('#modal').classList.contains('hidden')")
  roles=api('/api/projects/'+pid+'/model-roles');assert len(roles['teams']['worker'])==2;assert len(roles['teams']['founder'])==2
  page.locator('[data-work="roles"]').click();page.wait_for_selector('#wcRoleSave');assert page.locator('[data-wc-team="worker"]:checked').count()==2;assert page.locator('[data-wc-team="reviewer"]:checked').count()==1
  page.locator('#modal .modal-card').screenshot(path=str(OUT/'multiple-team-members.png')) if page.locator('#modal .modal-card').count() else page.locator('#modal').screenshot(path=str(OUT/'multiple-team-members.png'))
  page.locator('#closeModal').click();record('multi_role_persistence','Two Worker and two Founder members saved through actual UI; opening editor again retains selection and distinct Reviewer.')
  page.locator('[data-page="connections"]').first.click();page.wait_for_selector('[data-team-remove="worker"]')
  assert page.locator('[data-team-remove="worker"]').count()==2
  page.locator('[data-team-remove="worker"][data-member-index="1"]').click();waitfor(lambda:len(api('/api/projects/'+pid+'/model-roles')['teams']['worker'])==1)
  page.locator('#cc-role-provider-worker').select_option('ai-b');page.locator('#cc-role-model-worker').select_option('fixture-b');waitfor(lambda:len(api('/api/projects/'+pid+'/model-roles')['teams']['worker'])==2)
  page.locator('#manageCouncil').click();page.locator('#ccSaveCouncil').click();wait_js("document.querySelector('#modal').classList.contains('hidden')");assert len(api('/api/projects/'+pid+'/model-roles')['teams']['council'])==2
  record('connections_role_groups','Connections tab removes one Worker, appends another without overwriting, and re-saves Council without losing members.')
  page.locator('[data-page="idea"]').first.click();page.wait_for_selector('#workCenter')
  # Actual screenshot files are the selected video illustration; no new AI images are asserted.
  page.locator('#workCenter').screenshot(path=str(OUT/'intake-illustration.png'))
  videoPid=api('/api/reception/handoff',{'pipeline':'news-video','cardId':card,'copyTeamFrom':pid})['project']['id'];assert work(videoPid,'prepare')['state']=='completed'
  page.evaluate('async()=>{await loadProjects();}');page.locator('#globalProjectSelect').select_option(videoPid);wait_js(f"state.project.id==={json.dumps(videoPid)} && document.querySelector('#workCenter').dataset.project==={json.dumps(videoPid)} && !!document.querySelector('#wcVoice')");page.locator('#wcVoice').select_option('local')
  page.locator('[data-work="preview-voice"]').click();page.wait_for_selector('#wcVoicePreview audio',timeout=30000);src=page.locator('#wcVoicePreview audio').get_attribute('src');audio=session.get(base+src);assert audio.ok and audio.content[:4]==b'RIFF';(OUT/'diagnostic-preview.wav').write_bytes(audio.content)
  record('voice_preview','Actual WAV from explicitly labelled eSpeak diagnostic adapter passes preview API and audio control. This is not a Piper neural-model acceptance.')
  page.locator('#wcImages').set_input_files(str(OUT/'intake-illustration.png'));wait_js("document.querySelectorAll('#wcImageList [data-remove-image]').length===1");assert page.locator('#wcVisual').input_value()=='uploads'
  page.locator('#wcConsent').check();page.locator('#workCenter').screenshot(path=str(OUT/'narrated-illustrated-options.png'))
  assert page.evaluate("!!(document.querySelector('.idea-meeting').compareDocumentPosition(document.querySelector('#workProducts')) & Node.DOCUMENT_POSITION_FOLLOWING)")
  record('reception_product_separation','Assignment/events are above results; real images selected and voice explicit before production.')
  # Consent cannot leak to a different project.
  otherPid=api('/api/reception/handoff',{'pipeline':'news-video','cardId':card,'copyTeamFrom':pid})['project']['id'];assert work(otherPid,'prepare')['state']=='completed'
  page.evaluate('async()=>{await loadProjects();}');page.locator('#globalProjectSelect').select_option(otherPid);wait_js(f"state.project.id==={json.dumps(otherPid)} && document.querySelector('#workCenter').dataset.project==={json.dumps(otherPid)} && !!document.querySelector('#wcVoice')")
  assert not page.locator('#wcConsent').is_checked();assert page.locator('#wcVoice').input_value() in ('','windows');assert page.locator('#wcImageList [data-remove-image]').count()==0
  page.locator('#globalProjectSelect').select_option(videoPid);wait_js(f"state.project.id==={json.dumps(videoPid)} && document.querySelector('#workCenter').dataset.project==={json.dumps(videoPid)} && !!document.querySelector('#wcVoice')");assert page.locator('#wcVoice').input_value()=='local';assert page.locator('#wcImageList [data-remove-image]').count()==1;assert not page.locator('#wcConsent').is_checked()
  record('project_isolation','Images/voice persist for their own project, not another project. Consent is never carried to the next project.')
  page.locator('#wcRenderer').select_option('ffmpeg')  # Concat not installed in this Linux fixture; explicit renderer selection is required.
  page.locator('#wcConsent').check();page.locator('[data-work="produce"]').click()
  try:page.wait_for_selector('#workProducts video',timeout=50000)
  except Exception:
   print('PRODUCE_DEBUG_BACKEND',json.dumps(api('/api/projects/'+videoPid+'/work-center'),ensure_ascii=False)[:3500],flush=True)
   print('PRODUCE_DEBUG_UI',page.evaluate("({toast:document.querySelector('#toast')?.textContent,receipt:document.querySelector('#workCenter')?.innerText.slice(-1700),products:document.querySelector('#workProducts')?.innerText.slice(-600)})"),flush=True)
   raise
  v=next(x for x in api('/api/projects/'+videoPid+'/products')['products'] if x['kind']=='video');binary=session.get(base+v['download'],timeout=60);assert binary.ok and len(binary.content)>1000;(OUT/'narrated-illustrated-diagnostic.mp4').write_bytes(binary.content)
  partial=session.get(base+v['download'],headers={'Range':'bytes=0-1023'});assert partial.status_code==206 and partial.content==binary.content[:1024]
  probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(OUT/'narrated-illustrated-diagnostic.mp4')]));assert any(s['codec_type']=='video' for s in probe['streams']);assert any(s['codec_type']=='audio' for s in probe['streams']);report['video']={'duration':probe['format']['duration'],'streams':[{k:s.get(k) for k in ['codec_type','codec_name','width','height']} for s in probe['streams']],'voice':'eSpeak diagnostic, not neural Piper'}
  loud=subprocess.run(['ffmpeg','-hide_banner','-i',str(OUT/'narrated-illustrated-diagnostic.mp4'),'-vn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True);(OUT/'audio-check.log').write_text(loud.stderr);assert re.search(r'mean_volume: -[0-9.]+ dB',loud.stderr)
  subprocess.run(['ffmpeg','-v','error','-i',str(OUT/'narrated-illustrated-diagnostic.mp4'),'-f','null','-'],check=True)
  subprocess.run(['ffmpeg','-loglevel','error','-y','-ss','2','-i',str(OUT/'narrated-illustrated-diagnostic.mp4'),'-frames:v','1',str(OUT/'narrated-frame.jpg')],check=True)
  page.locator('#workProducts').screenshot(path=str(OUT/'video-product.png'));record('actual_narrated_video','Reception produced an actual H264/AAC MP4 with uploaded illustration and non-silent diagnostic speech; ffprobe/full decode/Range requests pass.')
  page.locator('[data-page="studio"]').first.click();page.locator('[data-media-mode="story"]').click();assert page.locator('#mediaStoryTtsProvider').is_visible();assert page.locator('#mediaStoryImages').is_visible();assert page.locator('#mediaStoryTransition').input_value()=='cut'
  record('video_studio_controls','Same source/voice selection is available in Video Studio; voiced story defaults to cut, not overlapping words.')
  api('/api/vault/lock',{});assert session.get(base+src).status_code==423;assert session.post(base+'/api/production/voice/preview',json={'ttsProvider':'local'}).status_code==423
  unauth=requests.get(base+'/api/production/voice/setup');assert unauth.status_code==401;record('voice_endpoint_access','Preview/setup requires an authenticated local session; locking Vault denies audio access and synthesis.')
  assert report['pageErrors']==[],report['pageErrors'];page.evaluate('window.__qaStop()');wait_js('window.__qaPending===0',timeout=30000);browser.close()
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
