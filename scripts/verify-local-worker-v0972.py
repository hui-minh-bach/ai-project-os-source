"""Chromium -> actual app HTTP -> rediscovered Piper -> real Vietnamese ONNX -> FFmpeg MP4.
Only AI text and illustration HTTP are fixtures. Windows-native acceptance is separate.
Requires AIOS_QA_PIPER_ASSETS (pinned model+JSON), AIOS_QA_PYTHON_PATH (installed piper),
and optional AIOS_QA_CHROMIUM. No downloads, live AI account or publishing in this script.
"""
import os,json,time,tempfile,secrets,subprocess,socket,signal,shutil,hashlib,sys
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence/v0972';OUT.mkdir(exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-real-voice-'));data=runtime/'data';data.mkdir();proc=None
report={'scope':__doc__,'nativeWindows':False,'liveAI':False,'illustrations':'local HTTP fixture, not neural image generation','speech':'Piper ONNX actual inference','checks':[]}
def record(name,**kw):report['checks'].append({'name':name,'status':'PASS',**kw});print('PASS',name,flush=True)
def waitfor(fn,seconds=180):
 end=time.time()+seconds;last=None
 while time.time()<end:
  try:
   r=fn()
   if r:return r
  except Exception as e:last=e
  time.sleep(.2)
 raise AssertionError('Timeout: '+repr(last))
try:
 assets=Path(os.environ['AIOS_QA_PIPER_ASSETS']);lib=Path(os.environ['AIOS_QA_PYTHON_PATH']);modelName='vi_VN-vais1000-medium.onnx';expected='ec7c89e2c85f4d1edc24b6120c18aaf1bda614f06b511567eb9c7c0de15e2dab'
 assert hashlib.sha256((assets/modelName).read_bytes()).hexdigest()==expected
 stage=data/'local-voice/piper-2023.11.14-2-qa.staging';engine=stage/'piper/piper';engine.parent.mkdir(parents=True)
 shutil.copyfile(assets/modelName,stage/modelName);shutil.copyfile(assets/(modelName+'.json'),stage/(modelName+'.json'))
 wrapper='#!'+sys.executable+'\nimport sys,runpy,os,json\nfrom pathlib import Path\nsys.path.insert(0,'+repr(str(lib))+')\nroot=Path('+repr(str(data))+')\n'
 wrapper+="if '--help' not in sys.argv:\n with (root/'qa-speech-calls.jsonl').open('a') as f:f.write(json.dumps({'kind':'actual Piper ONNX invocation'})+'\\n')\n if (root/'fail-speech-once').exists():\n  (root/'fail-speech-once').unlink();sys.exit(75)\nrunpy.run_module('piper',run_name='__main__')\n"
 engine.write_text(wrapper);engine.chmod(0o755)
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32);env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(data),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 for k in ['PIPER_CLI_PATH','PIPER_MODEL_PATH','PIPER_CONFIG_PATH','CONCAT_API_TOKEN','AIOS_TEST_ISOLATION']:env.pop(k,None)
 log=(OUT/'local-worker-runtime.log').open('w');proc=subprocess.Popen(['node','--import','./scripts/fixtures/local-worker-v0972-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=1).ok,45)
 session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 home=json.loads((data/'qa-project-id.json').read_text())['id']
 def api(route,body=None):
  r=session.request('POST' if body is not None else 'GET',base+route,json=body,timeout=240)
  if not r.ok:raise AssertionError((route,r.status_code,r.text[:1500]))
  return r.json()
 assert requests.post(base+'/api/production/refresh',json={}).status_code==401
 caps=api('/api/production/refresh',{});assert caps['videoReady'] and caps['defaultVoice'] is None
 record('Fresh refresh distinguishes actual FFmpeg from incomplete voice installation; unauthenticated refresh rejected')
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ.get('AIOS_QA_CHROMIUM') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);ctx=browser.new_context(viewport={'width':1450,'height':1050});ctx.add_cookies([{'name':c.name,'value':c.value,'url':base} for c in session.cookies]);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base,wait_until='networkidle');page.locator('button.nav[data-page="idea"]').click();page.evaluate('(id)=>chooseProject(id)',home)
  brief='Dịch vụ chụp ảnh trang sức bằng ánh sáng tự nhiên. Khách hàng là cửa hàng trang sức. Chỉ giới thiệu dịch vụ và mời liên hệ nhận báo giá; không thêm giá hay khuyến mãi.'
  page.locator('#clientOrderTitle').fill('Neural voice recovery QA');page.locator('#clientOrderBrief').fill(brief);page.locator('[data-client-order="client-video"]').click()
  page.locator('[data-wc="voice-refresh"]').wait_for(timeout=30000)
  project=page.evaluate('state.project.id');first=api('/api/projects/'+project+'/work-center')['job'];assert first['state']=='failed' and first['error']['code']=='MEDIA_VOICE_REQUIRED'
  record('Real client-order click fails before AI when voice is incomplete; failure receipt shown')
  # Finish an existing installed engine atomically; no saved paths or PIPER env.
  stage.rename(data/'local-voice/piper-2023.11.14-2')
  assert not (data/'local-voice.json').exists()
  page.locator('[data-wc="voice-refresh"]').click()
  def finished(pid):
   j=api('/api/projects/'+pid+'/work-center')['job'];return j if j and j['state'] not in ['queued','running'] else None
  # Wait for recovery receipt, then render completion; old failed job is historical.
  job=waitfor(lambda:(lambda j:j if j and j['id']!=first['id'] else None)(finished(project)),200)
  assert job['state']=='completed',job;assert job['result']['voiceProvider']=='local' and job['result']['engine']=='ffmpeg',job
  caps=api('/api/production/capabilities');assert caps['defaultVoice']=='local' and caps['localSpeech']['discoveredFrom']=='managed-install',caps
  record('One recovery click rediscovered installed Piper, generated real preview, resumed same order and delivered MP4',project=project,job=job['id'])
  products=api('/api/projects/'+project+'/products')['products'];names={x['name'] for x in products};assert {'voice.wav','captions.srt','captions.vtt','script-final.md','thumbnail.png'}<=names,names
  video=next(x for x in products if x['name'].endswith('.mp4'));response=session.get(base+video['download']);assert response.ok
  target=OUT/'real-piper-local-worker.mp4';target.write_bytes(response.content)
  info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)]));assert {s['codec_type'] for s in info['streams']}>={'video','audio'};assert float(info['format']['duration'])>3
  subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)
  levels=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(target),'-t','12','-vn','-af','volumedetect','-f','null','-'],capture_output=True,text=True,check=True).stderr
  assert 'mean_volume: -inf' not in levels;report['audioLevelEvidence']=levels[-1600:]
  record('Final MP4 decodes, contains non-silent neural Vietnamese speech, illustration frames and downloadable source assets',seconds=float(info['format']['duration']),modelSha256=expected)
  # Exact recovery key replay must return the same receipt and create no extra run.
  before=api('/api/projects/'+project+'/work-center');key='voice_resume_'+first['id']
  replay=api('/api/projects/'+project+'/work-center',{'action':'auto-produce','input':{'requestId':before['request']['id'],'fromReception':True},'key':key});assert replay['job']['id']==job['id'],replay
  assert len(api('/api/projects/'+project+'/work-center')['runs'])==1
  record('Duplicate recovery click/reload is idempotent and does not create a second run')
  # A different order fails once during the actual speech process AFTER script review.
  (data/'fail-speech-once').write_text('Fault injection: local executable exits once before ONNX, no fake speech')
  handoff=api('/api/reception/handoff',{'pipeline':'client-video','title':'Existing failed run recovery QA','ideaText':brief,'copyTeamFrom':home,'autoStart':True});second=handoff['project']['id']
  failed=waitfor(lambda:finished(second));assert failed['state']=='failed',failed
  before=api('/api/projects/'+second+'/work-center');assert len(before['runs'])==1 and before['runs'][0]['state']=='failed',before
  oldRun=before['runs'][0]['id'];oldStats=json.loads((data/'qa-local-stats.json').read_text());assert oldStats['scriptCalls']>0
  page.evaluate('(id)=>chooseProject(id)',second);page.locator('#workCenter [data-wc="auto-produce"]').wait_for(timeout=20000);page.locator('#workCenter [data-wc="auto-produce"]').click()
  retried=waitfor(lambda:(lambda j:j if j and j['id']!=failed['id'] else None)(finished(second)),200)
  assert retried['state']=='completed',retried
  after=api('/api/projects/'+second+'/work-center');assert len(after['runs'])==1 and after['runs'][0]['id']==oldRun and after['runs'][0]['state']=='completed',after
  time.sleep(.2);newStats=json.loads((data/'qa-local-stats.json').read_text());assert newStats['scriptCalls']==oldStats['scriptCalls'] and newStats['reviewCalls']==oldStats['reviewCalls'],(oldStats,newStats)
  record('Transient real-process failure retries the SAME existing run; approved script/reviewer are reused; no duplicate AI work',run=oldRun,fixtureCounters=newStats)
  page.reload(wait_until='networkidle');page.locator('button.nav[data-page="idea"]').click();page.evaluate('(id)=>chooseProject(id)',second);page.get_by_text('File bàn giao',exact=True).wait_for(timeout=20000)
  assert not errors,errors;report['browserErrors']=errors;report['status']='PASS';browser.close()
finally:
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=8)
  except ProcessLookupError:pass
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(runtime,ignore_errors=True)
 (OUT/'real-local-worker.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report.get('status'),'checks':len(report['checks'])}))
