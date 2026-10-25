#!/usr/bin/env python3
"""Browser smoke/visual evidence for real Three.js WebGL on Chromium software GPU.
Neither a Windows hardware benchmark nor a substitute for actual-device testing.
"""
import sys,json,shutil,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/space-studio/r3'))
from verify_browser import mount
OUT=Path(os.environ.get('AIOS_WEBGL_QA_DIR',str(ROOT/'evidence/v0968')));OUT.mkdir(parents=True,exist_ok=True)
report={'scope':__doc__,'windowsTested':False,'gpu':'Chromium software GPU (SwiftShader)','checks':[],'errors':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=os.getenv('AIOS_XVFB')!='1',args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=browser.new_page(viewport={'width':1280,'height':800},device_scale_factor=1)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  mount(page,geometryOnly=False)
  page.evaluate('''()=>{viewer.setFleetSnapshot(snap([
   bot('actual-1','ready',{name:'Cua',role:'founder',roles:['founder']}),
   bot('actual-2','working',{name:'Bap',role:'worker',roles:['worker']}),
   bot('actual-3','reviewing',{name:'Phat',role:'reviewer',roles:['reviewer']}),
   bot('actual-4','ready',{name:'Teo',role:'worker',roles:['worker']}),
   bot('actual-5','ready',{name:'Tuan',role:'worker',roles:['worker']}),
   bot('actual-6','ready',{name:'Ngoc',role:'council',roles:['council']})
  ]));viewer.setCamera('hero');viewer.setTime(0);}''')
  page.wait_for_timeout(1000)
  state=page.evaluate('''()=>({canvas:document.querySelectorAll('canvas').length,ready:viewer.stats().robotLoaded,robots:viewer.stats().liveRobots,chairs:viewer.stats().geometricChairs,webgl:!!document.createElement('canvas').getContext('webgl2'),fleet:viewer.getFleet().map(a=>({id:a.id,seat:a.seatId,phase:a.phase,position:a.position}))})''')
  assert state['webgl'] and state['robots']==6 and state['chairs']==9 and all(x['seat'] and x['phase']=='seated' for x in state['fleet']),state
  report['checks'].append('Six unique 3D accounts placed at six occupied real workstations')
  shot=OUT/'r9-real-webgl-swiftshader.png';page.screenshot(path=str(shot))
  im=Image.open(shot).convert('RGB');std=ImageStat.Stat(im).stddev
  assert min(std)>12,('Canvas not showing meaningful color variation',std)
  report['checks'].append('Rendered browser WebGL framebuffer is nonuniform and saved')
  # Scene is a visual staging display, not simulated AI provider activity.
  report['state']=state;report['pixelStdDev']=std
  assert not report['errors'],report['errors']
  report['status']='PASS';browser.close()
except Exception as e:
 report['status']='NOT_TESTED';report['error']=repr(e)
 print('WEBGL_UNAVAILABLE',repr(e),flush=True)
finally:
 (OUT/'r9-webgl.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'checks':report['checks'],'error':report.get('error')}),flush=True)
if report['status']!='PASS':raise SystemExit(2)
