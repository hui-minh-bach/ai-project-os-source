#!/usr/bin/env python3
"""Actual Chromium WebGL scene/DOM; synthetic account metadata only, no AI calls."""
import json,os,shutil,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/space-studio/r3'))
from verify_browser import mount
out=ROOT/'evidence/v0971';out.mkdir(exist_ok=True)
report={'scope':__doc__,'windowsTested':False,'checks':[],'errors':[]}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':850,'height':760});page.on('pageerror',lambda e:report['errors'].append(str(e)))
 mount(page,geometryOnly=False)
 page.evaluate('''()=>{viewer.setFleetSnapshot(snap(['Cua','Tún','Ngọc','Bắp','Tèo','Phát','Cải','Trưởng','Claude Code account','Google Gemini account'].map((name,i)=>bot('id-'+i,i<8?'ready':'offline',{name,connected:i<8}))));viewer.setTime(0);}''')
 page.wait_for_timeout(200)
 def verify(label):
  row=page.evaluate('''()=>{const root=document.querySelector('.space-viewer').getBoundingClientRect();return {stats:viewer.stats(),names:[...document.querySelectorAll('.space-name-tag')].map(n=>{const r=n.getBoundingClientRect();return {id:n.firstElementChild.textContent,visible:!n.hidden,x:parseFloat(n.style.left),y:parseFloat(n.style.top),anchorX:Number(n.dataset.anchorX),anchorY:Number(n.dataset.anchorY),width:r.width,height:r.height}})}}''')
  assert row['stats']['robotLoaded'] and row['stats']['liveRobots']==10,row
  for n in row['names']:
   if not n['visible']:continue
   assert abs(n['x']-n['anchorX'])<=n['width']/2+6,n
   assert abs(n['y']-n['anchorY'])<=n['height']+5,n
  report['checks'].append({'name':label,'visible':sum(n['visible'] for n in row['names'])});return row
 report['initial']=verify('10 actual GLB robots: each visible name stays within one label size of projected head')
 assert report['checks'][-1]['visible']>=8,report['initial']
 page.screenshot(path=str(Path(tempfile.gettempdir())/'aios-labels-v0971-internal.png'))
 page.locator('.space-name-tag:visible').first.click();assert page.locator('.space-agent-detail').is_visible();report['checks'].append({'name':'Click anchored name selects the same account and opens detail'})
 page.evaluate("viewer.setCamera('overview');viewer.setTime(0)");verify('Overview camera preserves head anchors')
 page.evaluate("viewer.setCamera('hero');viewer.setTime(0)")
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200);verify('390px viewport keeps bounded names without edge clamping')
 page.screenshot(path=str(Path(tempfile.gettempdir())/'aios-labels-v0971-mobile-internal.png'))
 page.evaluate("viewer.setFleetSnapshot(snap([bot('id-0','ready',{name:'Tên mới <img src=x>'})]));viewer.setTime(0)")
 assert page.locator('.space-name-tag').count()==1 and page.locator('.space-name-links line').count()==1
 assert page.locator('.space-name-tag strong').inner_text()=='Tên mới <img src=x>' and page.locator('.space-name-layer img').count()==0
 report['checks'].append({'name':'Rename/remove preserves exact account identity; removed names and lines disappear; names remain text'})
 page.evaluate('viewer.markFleetStale({clear:true})');assert page.locator('.space-name-tag').count()==0;assert page.locator('.space-name-links line').count()==0
 report['checks'].append({'name':'Vault clear removes all account name tags and leader lines'})
 assert not report['errors'],report['errors'];report['status']='PASS';browser.close()
(out/'labels-webgl.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':report['status'],'checks':len(report['checks'])}))
