#!/usr/bin/env python3
"""DOM lifecycle fixtures + genuine WebGL failure path; not a GPU success test."""
from pathlib import Path
import argparse,json,sys
from playwright.sync_api import sync_playwright
from offline_browser import ROOT,mount as offline_mount

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--chromium',default='/usr/bin/chromium');ap.add_argument('--out',type=Path,required=True);args=ap.parse_args()
 results=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1280,'height':720})
  page.set_content('<!doctype html><html><body><section id="page-idea" class="page"><div class="office-head"><h2>Office</h2><span></span></div><div id="officeRoom">LEGACY ROOM</div></section></body></html>')
  page.evaluate('''async ({controller,app})=>{
   window.fixture={mounts:0,disposes:0,mode:'ok'};
   Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});
   window.__ideaSpaceReadFleet=()=>[{id:'a',name:'<img src=x onerror=alert(1)>',provider:'TEST ONLY',state:'idle',placeholder:false}];
   const stub=`export async function mountSpaceViewer(host){window.fixture.mounts++;if(window.fixture.mode==='fail')throw Error('Test GPU construction failure');if(window.fixture.mode==='delay')await new Promise(r=>window.fixture.resolve=r);const el=document.createElement('span');el.textContent='DOM fixture, not a 3D render';host.append(el);return {dispose(){window.fixture.disposes++;el.remove();},setActive(){},setFleetSnapshot(){},markFleetStale(){},selectAgent(){}};}`;
   const url=s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}));
   const c=url(controller),v=url(stub);
   const feed=url(`export function createFleetFeed({onData,onStatus}){const push=()=>{onData({bots:[{connectionId:'a',name:'<img src=x onerror=alert(1)>',provider:'TEST ONLY',role:'worker',state:'idle',activityLabel:'Fixture'}]});onStatus('live',{count:1,lastReceived:Date.now()});};return {start:push,stop(){},dispose(){},refresh:push};}`);
   const labels=url('export const STATE_LABELS={idle:"Idle",unknown:"Unknown"}; export const ROLE_LABELS={};');
   app=app.replace("'./controller.mjs'",JSON.stringify(c)).replace("'./viewer.mjs'",JSON.stringify(v))
          .replace("'./fleet-feed.mjs'",JSON.stringify(feed)).replace("'./fleet-contract.mjs'",JSON.stringify(labels));
   await import(url(app));
  }''',{'controller':(ROOT/'public/space-studio/controller.mjs').read_text(),'app':(ROOT/'public/space-studio/app-integration.mjs').read_text()})
  def check(name,expression):
   assert page.evaluate(expression),name
   results.append({'check':name,'result':'pass','scope':'DOM fixture, mocked renderer'})
  def nav(to):page.evaluate("p=>document.dispatchEvent(new CustomEvent('page-change',{detail:{page:p}}))",to)
  nav('idea');page.wait_for_function("window.__ideaSpaceController.get()!==null")
  check('App opens scene and hides legacy only after ready',"!document.getElementById('officeSpaceSection').hidden&&document.getElementById('officeRoom').hidden&&window.fixture.mounts===1")
  page.wait_for_function("document.querySelector('.office-space-roster')?.textContent.includes('<img')",timeout=8000)
  check('Roster uses text nodes, not executable HTML',"document.querySelectorAll('.office-space-roster img').length===0&&document.querySelector('.office-space-roster').textContent.includes('<img')")
  nav('idea');check('Repeated navigation does not duplicate scene',"window.fixture.mounts===1")
  page.click('#officeSpaceToggle');check('Back toggle disposes scene and preserves old room',"window.fixture.disposes===1&&!document.getElementById('officeRoom').hidden")
  page.click('#officeSpaceToggle');page.wait_for_function('window.fixture.mounts===2');nav('home');check('Leaving tab disposes scene',"window.fixture.disposes===2&&document.getElementById('officeSpaceSection').hidden")
  page.evaluate("window.fixture.mode='delay'");nav('idea');page.wait_for_function('typeof window.fixture.resolve===\'function\'');nav('home');page.evaluate('window.fixture.resolve()');page.wait_for_function('window.fixture.disposes===3');check('Late async model cannot reopen a departed tab',"window.__ideaSpaceController.get()===null&&document.getElementById('officeSpaceSection').hidden")
  page.evaluate("window.fixture.mode='fail'");nav('idea');page.wait_for_function("!document.querySelector('.office-space-failure').hidden")
  check('Failed mount exposes error and leaves legacy available',"!document.getElementById('officeRoom').hidden&&document.querySelector('.office-space-failure').textContent.includes('Test GPU construction failure')")
  page2=browser.new_page(viewport={'width':1280,'height':720})
  actual={'check':'Actual WebGL viewer startup','result':'not_tested_success','scope':'real modules, GPU unavailable'}
  try:
   offline_mount(page2,geometry_only=False)
   actual={'check':'Actual WebGL viewer startup','result':'pass','scope':'real WebGL context; inspect separately'}
  except Exception as e:
   page2.wait_for_function("document.getElementById('spaceStatus')?.textContent.includes('Không tải được')",timeout=4500)
   visible=page2.locator('#spaceStatus').is_visible()
   assert visible,'Standalone WebGL failure must be visible'
   actual.update({'result':'environment_blocked','visibleErrorFallback':'pass','message':str(e)[:700]})
  results.append(actual)
  report={'browser':browser.version,'tests':results,'domFixturePasses':7,'webglSuccessClaimed':actual['result']=='pass','limitation':'DOM fixtures mock the renderer. They are not visual, GPU, Windows, or full-app E2E certification.'}
  browser.close()
 args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n');print(json.dumps(report,ensure_ascii=True))
if __name__=='__main__':main()
