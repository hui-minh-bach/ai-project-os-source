"""Actual app HTTP/Chromium/WebGL/FFmpeg. AI/image services and stored QA audio are fixtures;
not live account image access or Windows acceptance. No owner data/publication.
"""
import os,json,time,tempfile,secrets,subprocess,socket,signal,shutil,base64,sys
from pathlib import Path
import requests
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'evidence/v0973';runtime=Path(tempfile.mkdtemp(prefix='aios-reception073-'));proc=None
report={'scope':__doc__,'nativeWindows':False,'checks':[],'errors':[]}
def record(name,**extra):report['checks'].append({'name':name,'status':'PASS',**extra});print('PASS',name,flush=True)
def waitfor(fn,seconds=150):
 end=time.time()+seconds;last=None
 while time.time()<end:
  try:
   r=fn()
   if r:return r
  except Exception as e:last=e
  time.sleep(.2)
 raise AssertionError('Timeout: '+repr(last))
try:
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 base=f'http://127.0.0.1:{port}';token=secrets.token_hex(32);data=runtime/'data';env={**os.environ,'AIOS_DELIVERY_FIXTURE':'1','AI_PROJECT_OS_DATA_DIR':str(data),'AI_PROJECT_OS_PORT':str(port),'AI_PROJECT_OS_LAUNCH_TOKEN':token}
 log=(OUT/'browser-runtime.log').open('w');proc=subprocess.Popen(['node','--import','./scripts/fixtures/reception-v0973-preload.mjs','src/server.mjs'],cwd=ROOT,env=env,stdout=log,stderr=log,start_new_session=True)
 waitfor(lambda:requests.get(base+'/api/health',timeout=1).ok,60);session=requests.Session();assert session.get(base+'/?launch='+token).ok;session.headers['Origin']=base
 def api(route,body=None):
  r=session.request('POST' if body is not None else 'GET',base+route,json=body,timeout=220)
  assert r.ok,(route,r.status_code,r.text[:1200]);return r.json()
 home=json.loads((data/'qa-project-id.json').read_text())['id'];imageBase=json.loads((data/'qa-image-base.json').read_text())['base']
 handoff=api('/api/reception/handoff',{'pipeline':'client-video','title':'Project reception and seats QA','ideaText':'Dịch vụ chụp ảnh trang sức bằng ánh sáng tự nhiên, khách hàng là cửa hàng trang sức. Chỉ mời liên hệ nhận báo giá, không thêm giá hay khuyến mãi.','copyTeamFrom':home,'autoStart':True});pid=handoff['project']['id']
 waitfor(lambda:requests.get(imageBase+'/__status').json()['created']>0)
 center=api('/api/projects/'+pid+'/work-center');assert center['job']['state']=='running',center
 replies=[m for m in center['conversation'] if m['kind']=='message'];assert any(m['role']=='worker' for m in replies) and any(m['role']=='reviewer' for m in replies)
 assert any('Tạo ảnh cảnh' in m['content'] and 'đang tạo' in m['content'] for m in center['conversation']),center['conversation']
 record('Public worker/reviewer replies are saved and available while engine still runs',messages=len(replies))
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=os.environ['AIOS_QA_CHROMIUM'],headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']);ctx=browser.new_context(viewport={'width':1600,'height':1000});ctx.add_cookies([{'name':c.name,'value':c.value,'url':base} for c in session.cookies]);page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(base,wait_until='networkidle');page.locator('button.nav[data-page="idea"]').click();page.evaluate('(id)=>chooseProject(id)',pid)
  page.locator('#workProducts h3',has_text='Kết quả dự án').wait_for(timeout=20000)
  assert page.locator('#clientOrderIntake,#clientOrderBrief,[data-client-order]').count()==0
  assert page.locator('#ideaFounderTitle').inner_text()=='Trưởng phòng tiếp nhận'
  assert page.evaluate("document.querySelector('#workProducts').compareDocumentPosition(document.querySelector('#workCenter')) & Node.DOCUMENT_POSITION_FOLLOWING")
  record('Customer intake form removed; Project Results occupies its place; reception heading preserved')
  for m in replies:page.locator('#chat .idea-message-content').filter(has_text=m['content']).first.wait_for(timeout=20000)
  page.locator('#projectActivity',has_text='Tạo ảnh cảnh').wait_for(timeout=15000)
  assert page.locator('#chat .idea-message-meta').filter(has_text=replies[0]['actor']).count()>0
  record('Actual public script and reviewer feedback appear with model/account attribution inside reception chat')
  waitfor(lambda:page.evaluate('!!window.__ideaSpaceViewer&&window.__ideaSpaceViewer.getFleet().length>0'),60)
  before=page.evaluate('''()=>window.__ideaSpaceViewer.getFleet().filter(a=>['ai-b','ai-c'].includes(a.id)).map(a=>({id:a.id,seat:a.seatId,phase:a.phase,jobs:a.data.jobs,position:a.position}))''');assert len(before)==2 and all(a['seat'] for a in before),before
  after=page.evaluate('''()=>{const v=window.__ideaSpaceViewer;v.stepLive(240);return v.getFleet().filter(a=>['ai-b','ai-c'].includes(a.id)).map(a=>({id:a.id,seat:a.seatId,phase:a.phase,typing:a.motion.typing,position:a.position}));}''')
  assert all(a['phase']=='seated' for a in after),after;assert [(a['id'],a['seat'],a['position']) for a in after]==[(a['id'],a['seat'],a['position']) for a in before],(before,after)
  assert page.locator('.space-name-tag small:visible',has_text='Đang làm việc').count()>=2
  record('240 seconds of controller time during active parent render: served worker/reviewer retain exact chairs and positions; work labels visible',before=before,after=after)
  # Internal-only visual check; do not package screenshots.
  page.screenshot(path=str(ROOT.parent.parent/'reception073-internal.png'))
  frameDir=runtime/'frames';frameDir.mkdir()
  for i in range(4):
   frame=page.evaluate('window.__ideaSpaceViewer.screenshot()');(frameDir/(f'{i:03}.png')).write_bytes(base64.b64decode(frame.split(',',1)[1]));page.wait_for_timeout(120)
  subprocess.run(['ffmpeg','-v','error','-y','-framerate','2','-i',str(frameDir/'%03d.png'),'-vf','pad=ceil(iw/2)*2:ceil(ih/2)*2','-c:v','libx264','-pix_fmt','yuv420p',str(OUT/'seated-work-fixture.mp4')],check=True)
  record('Actual Three.js/GLB framebuffer recorded while task remains active; no geometry/camera replacement')
  assert requests.get(imageBase+'/__release').ok
  def done():
   j=api('/api/projects/'+pid+'/work-center')['job'];return j if j['state'] not in ['running','queued'] else None
  j=waitfor(done,180);assert j['state']=='completed',j
  products=api('/api/projects/'+pid+'/products')['products'];video=next(x for x in products if x['name'].endswith('.mp4'));target=OUT/'completed-project-fixture.mp4';target.write_bytes(session.get(base+video['download']).content);subprocess.run(['ffmpeg','-v','error','-xerror','-i',str(target),'-f','null','-'],check=True)
  page.locator('#workProducts video').wait_for(timeout=20000);assert page.locator('#clientOrderIntake').count()==0
  page.reload(wait_until='networkidle');page.locator('button.nav[data-page="idea"]').click();page.evaluate('(id)=>chooseProject(id)',pid)
  page.locator('#chat .idea-message-content').filter(has_text=replies[0]['content']).first.wait_for(timeout=20000);assert page.locator('#workProducts h3').inner_text()=='Kết quả dự án'
  record('Actual final MP4 arrives in Project Results; public messages and removed form remain correct after reload')
  assert not report['errors'],report['errors'];report['status']='PASS';browser.close()
except Exception as e:report['status']='FAIL';report['error']=repr(e);raise
finally:
 if proc:
  try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=6)
  except ProcessLookupError:pass
  except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL)
 shutil.rmtree(runtime,ignore_errors=True)
 (OUT/'browser-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'checks':len(report['checks'])}))
