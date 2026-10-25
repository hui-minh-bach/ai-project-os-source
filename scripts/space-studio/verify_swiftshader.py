from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
from offline_browser import mount
out=Path('evidence/v0967');out.mkdir(parents=True,exist_ok=True)
res={'environment':'Linux Chromium software WebGL (SwiftShader), not Windows GPU','source':'unchanged public/space-studio/*'}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl'])
  page=browser.new_page(viewport={'width':1280,'height':720},device_scale_factor=1)
  try:
   mount(page,clean=False,capture=True,manual=True,quality='low')
   page.wait_for_function('window.__spaceReady===true',timeout=14000)
   page.evaluate("window.__spaceStudio.setTime(5)")
   page.screenshot(path=str(out/'space-real-swiftshader.png'))
   res['result']='pass';res['screenshot']='space-real-swiftshader.png';res['kind']='real Chromium WebGL and source geometry'
  except Exception as e:
   res['result']='blocked';res['detail']=str(e)[:1000]
  finally:browser.close()
except Exception as e:res['result']='blocked';res['detail']=str(e)[:1000]
(out/'webgl-probe.json').write_text(json.dumps(res,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(res,ensure_ascii=False))
