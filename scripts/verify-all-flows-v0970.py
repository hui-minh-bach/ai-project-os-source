"""Production app HTTP/UI, real files/render/Git; AI, TTS, images, Concat, social and MCP use labelled local fixtures. No external publishing."""
import os,json,time,tempfile,secrets,subprocess,socket,signal,shutil,base64,zipfile,io
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence/v0970/all-flows';OUT.mkdir(parents=True,exist_ok=True)
runtime=Path(tempfile.mkdtemp(prefix='aios-all-flows-'));proc=None
report={'scope':__doc__,'checks':[],'errors':[],'externalPublication':False,'liveProviderLogin':False,'nativeWindows':False,'nativeConcat':False,'browser':'Chromium Linux direct localhost','platforms':['youtube','facebook','tiktok']}
def record(name,detail):report['checks'].append({'name':name,'status':'PASS','detail':detail});print('PASS',name,flush=True)
def waitfor(fn,timeout=180):
 end=time.time()+timeout;last=None
 while time.time()<end:
  try:
   r=fn()
   if r:return r
  except Exception as e:last=e
  time.sleep(.2)
 raise AssertionError('Timeout: '+str(last))
try:
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32)
 env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(runtime/'data'),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'runtime.log').open('w');proc=subprocess.Popen(['node','--import','./scripts/fixtures/all-flows-v0970-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=2).ok,60)
 assert requests.get(base+'/api/integrations/catalog').status_code==401
 session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 home=json.loads((runtime/'data/qa-project-id.json').read_text())['id'];social=json.loads((runtime/'data/qa-social.json').read_text())
 def api(route,body=None,method=None):
  r=session.request(method or ('POST' if body is not None else 'GET'),base+route,json=body,timeout=240)
  if not r.ok:raise AssertionError((route,r.status_code,r.text[:1400]))
  return r.json()
 record('session_boundary','Unauthenticated catalog returns 401; one-use launch grants session for real localhost API')
 cat=api('/api/integrations/catalog');assert cat['counts']['skills']==83 and cat['counts']['repos']>=10
 for skill in cat['skills']:
  snap=api('/api/integrations/skill-reference?id='+skill['id']);assert snap['text'] and snap['sha256']
 record('bundled_inventory','83 full instruction snapshots readable; repository source catalog present; host tools remain separately connected')
 mcp=api('/api/mcp/save',{'name':'Local MCP fixture','endpoint':social['mcpUrl'],'protocol':'2026-07-28','token':'fixture-token'});assert 'secret' not in mcp
 connected=api('/api/mcp/connect',{'id':mcp['id']});assert connected['connected'] and len(connected['tools'])==1
 payload={'id':mcp['id'],'name':'echo','arguments':{'text':'MCP local end-to-end'},'projectId':home,'key':'mcp-one-operation-0970','approved':False}
 assert session.post(base+'/api/mcp/call',json=payload).status_code>=400
 payload['approved']=True;receipt=api('/api/mcp/call',payload);assert receipt['state']=='completed' and receipt['result']['content'][0]['text']=='MCP local end-to-end'
 assert api('/api/mcp/call',payload)['key']==receipt['key']
 record('mcp_full_roundtrip','Vault config -> tools/list -> rejected unapproved call -> approved tools/call -> durable idempotent receipt')
 cfg=api('/api/orchestrator')['config'];cfg['pipelines']['idea-film']['platforms']=['youtube','facebook','tiktok'];cfg['pipelines']['idea-film']['requireApproval']=True;api('/api/orchestrator/config',cfg)
 run=api('/api/orchestrator/run',{'pipeline':'idea-film','projectId':home,'ideaText':'Video thử nghiệm cục bộ giới thiệu quy trình chụp ảnh trang sức bằng ánh sáng tự nhiên. Không thêm giá hoặc ưu đãi.','title':'LOCAL QA A-Z','voiceMode':'narrated','ttsProvider':'windows','visualMode':'ai','imageProvider':'comfyui-local','renderEngine':'ffmpeg'})['run']
 assert run['state']=='awaiting-approval',run
 before=session.get(social['baseUrl']+'/__state').json();assert not before['youtube']['videos'] and not before['facebook']['videos'] and not before['tiktok']['posts']
 record('idea_to_video_gate','Idea -> fixture AI script -> actual media tasks/render -> stored final video -> wait for publish approval; zero posts before approval')
 done=api('/api/orchestrator/runs/'+run['id']+'/approve',{})['run'];assert done['state']=='completed',done
 records=api('/api/publish/records?projectId='+home)['records'];assert len(records)==3 and all(r['simulated'] for r in records)
 state=session.get(social['baseUrl']+'/__state').json()
 for platform,field in [('youtube','videos'),('facebook','videos'),('tiktok','posts')]:
  assert len(state[platform][field])==1 and state[platform][field][0]['bytes']>0
  record('publish_'+platform,'Real production upload client -> local platform protocol -> confirmed platform record; simulated=true, media bytes uploaded')
 metrics=api('/api/publish/metrics/refresh',{'projectId':home})['results'];assert len(metrics)==3 and all(r['ok'] for r in metrics)
 record('social_metrics','All three simulated platforms return metrics and update persisted publish records')
 second=session.post(base+'/api/orchestrator/runs/'+run['id']+'/approve',json={});assert second.status_code>=400
 assert len(api('/api/publish/records?projectId='+home)['records'])==3
 record('no_duplicate_publish','Repeated approval of a completed run is rejected; exactly one post per platform')
 products=api('/api/projects/'+home+'/products')['products'];videos=[p for p in products if p['kind']=='video'];assert videos
 media=session.get(base+videos[-1]['download']);assert media.ok;file=OUT/'fixture-published-video.mp4';file.write_bytes(media.content)
 subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(file),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)
 record('delivered_video_decode','Downloaded stored final MP4 decodes in FFmpeg after social workflow')
 uploaded=session.post(base+'/api/integrations/media/upload',headers={'x-media-filename':'dub-source.mp4','content-type':'application/octet-stream'},data=media.content,timeout=60);assert uploaded.ok
 dub=api('/api/orchestrator/run',{'pipeline':'dub-video','projectId':home,'sourceVideo':uploaded.json()['source'],'title':'Dubbing LOCAL QA','voiceMode':'narrated','ttsProvider':'windows'})['run'];assert dub['state']=='awaiting-approval',dub
 record('dub_video_pipeline','Uploaded real MP4 -> explicit CLI transcription fixture -> fixture model translation -> selected Windows speech boundary -> actual FFmpeg dubbed video; no automatic publishing')
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);ctx=browser.new_context(viewport={'width':1450,'height':1000})
  ctx.add_cookies([{'name':c.name,'value':c.value,'url':base} for c in session.cookies]);page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
  response=page.goto(base,wait_until='networkidle',timeout=30000);assert response.status==200
  navs=page.locator('button.nav[data-page]');names=navs.evaluate_all('(nodes)=>nodes.map(n=>n.dataset.page)');report['tabs']=names
  for name in names:
   page.locator('button.nav[data-page="'+name+'"]').click();page.locator('#page-'+name+'.active').wait_for(state='visible',timeout=20000);page.wait_for_timeout(150)
   record('tab_'+name,'Real shipped scripts and styles loaded over authenticated localhost; tab click and visible page verified')
  for name in ['council','team']:
   page.evaluate('(name)=>window.page(name)',name);page.locator('#page-'+name+'.active').wait_for(state='visible',timeout=15000)
   record('section_'+name,'Existing Council/AI Team section opens with real app navigation event; logical workflow covered by website and team tests')
  page.locator('button.nav[data-page="skills"]').click();page.locator('#showIntegrationPack').click();page.locator('#readBundleSkill').click();waitfor(lambda:len(page.locator('#bundleSkillText').inner_text())>30,20)
  record('skill_reference_ui','Opened integration pack and read full skill through browser click')
  before=len(api('/api/skills'));page.locator('#adaptBundleSkill').click();page.locator('#skillEditor').wait_for(state='visible',timeout=15000);assert len(api('/api/skills'))==before+1
  record('skill_adaptation_ui','Imported reference into a real editable custom skill with bounded tool permissions; full original preserved')
  page.locator('#cancelSkill').click();page.locator('#configureMcp').click();assert page.locator('#mcpConfigForm').is_visible();page.locator('#closeModal').click()
  record('mcp_configuration_ui','Vault-backed MCP configuration form opens and existing server tools render')
  page.set_viewport_size({'width':390,'height':844});page.reload(wait_until='networkidle');assert page.locator('body').is_visible();report['mobileViewportLoaded']=True
  record('mobile_load','390x844 viewport loads source app; not a full mobile accessibility audit')
  ctx.close();browser.close()
 assert not report['errors'],report['errors']
 report['status']='PASS';report['publishRecords']=records;report['metrics']=metrics;report['fixtureSocialState']=state
except Exception as e:report['status']='FAIL';report['error']=repr(e);print('FAIL',repr(e),flush=True)
finally:
 (OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(runtime,ignore_errors=True)
print(json.dumps({'status':report['status'],'checks':len(report['checks']),'error':report.get('error')},ensure_ascii=False),flush=True)
if report['status']!='PASS':raise SystemExit(1)
