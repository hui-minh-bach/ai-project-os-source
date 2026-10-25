#!/usr/bin/env python3
"""App module lifecycle with mocked renderer + fetch; genuine WebGL failure separately."""
from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'scripts/space-studio'));from offline_browser import load_modules

def main():
 checks=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=browser.new_page(viewport={'width':1200,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content('<html><body><section id="page-idea" class="page"><div class="office-head"><h2>Office</h2><span></span></div><div id="officeRoom">LEGACY ROOM</div></section></body></html>')
  modules=load_modules('space-studio/app-integration.mjs');modules['space-studio/app-integration.mjs']=modules['space-studio/app-integration.mjs'].replace("import('./viewer.mjs')","import('app/space-studio/viewer.mjs')")
  modules['space-studio/viewer.mjs']='''export async function mountSpaceViewer(host){fixture.mounts++;if(fixture.mode==='fail')throw Error('Fixture GPU failure');if(fixture.mode==='delay')await new Promise(r=>fixture.resolve=r);const el=document.createElement('span');el.textContent='Renderer fixture, not a visual capture';host.append(el);return {dispose(){fixture.disposes++;el.remove();},setActive(v){fixture.active=v;},markFleetStale({clear=false}={}){fixture.stale++;if(clear)fixture.fleet=[];},setFleetSnapshot(d){fixture.fleet=d.bots;},selectAgent(id){fixture.selected=id;}};}'''
  page.evaluate('''async modules=>{const storage=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});
    window.fixture={mode:'ok',mounts:0,disposes:0,stale:0,fetches:0,status:200,fleet:[],name:'<img src=x onerror=alert(1)>'};
    window.fetch=async(url,options)=>{fixture.fetches++;fixture.method=options.method;return {ok:fixture.status===200,status:fixture.status,json:async()=>({schema:1,source:'live',generatedAt:new Date().toISOString(),bots:[{connectionId:'a',name:fixture.name,provider:'Fixture',connected:true,state:'working',role:'worker',roles:['worker'],jobs:[]}]})};};
    const imports={};for(const [k,v]of Object.entries(modules))imports['app/'+k]=URL.createObjectURL(new Blob([v],{type:'text/javascript'}));const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);await import('app/space-studio/app-integration.mjs');
  }''',modules)
  def check(name,condition):
   assert page.evaluate(condition),name;checks.append({'name':name,'result':'pass','scope':'DOM/controller/fetch fixture; renderer mocked'})
  def nav(to):page.evaluate("p=>document.dispatchEvent(new CustomEvent('page-change',{detail:{page:p}}))",to)
  nav('idea');page.wait_for_function('fixture.fleet.length===1')
  check('Actual app module hides legacy only after mounting ready','document.getElementById("officeRoom").hidden&&!document.getElementById("officeSpaceSection").hidden&&fixture.mounts===1')
  check('Roster text is safe and feed is read-only GET','fixture.method==="GET"&&document.querySelectorAll(".office-space-roster img").length===0&&document.querySelector(".office-space-roster").textContent.includes("<img")')
  page.locator('.office-space-agent').click();check('Roster selects matching account in scene','fixture.selected==="a"')
  nav('idea');check('Repeated navigation does not duplicate mount','fixture.mounts===1')
  page.evaluate("fixture.status=423");page.locator('.office-space-refresh').click();page.wait_for_function('fixture.fleet.length===0');check('Vault lock clears avatars and visible names','document.querySelectorAll(".office-space-agent").length===0&&document.querySelector(".office-space-status").dataset.status==="locked"')
  page.evaluate("fixture.status=200;fixture.name='Renamed'");page.locator('.office-space-refresh').click();page.wait_for_function("fixture.fleet[0]?.name==='Renamed'")
  check('Refresh restores updated real roster without adding renderer','fixture.mounts===1&&document.querySelector(".office-space-agent").textContent.includes("Renamed")')
  page.evaluate("fixture.status=500");page.locator('.office-space-refresh').click();page.wait_for_function("document.querySelector('.office-space-status').dataset.status==='stale'")
  check('Server error freezes visual truth and explicitly marks unknown','fixture.stale>=2&&document.querySelector(".office-space-agent").dataset.state==="unknown"')
  page.click('#officeSpaceToggle');check('Back toggle disposes and retains approved old room','fixture.disposes===1&&!document.getElementById("officeRoom").hidden&&document.getElementById("officeSpaceSection").hidden')
  before=page.evaluate('fixture.fetches');page.wait_for_timeout(2700);check('Closed scene has no continuing poll','fixture.fetches==='+str(before))
  page.click('#officeSpaceToggle');page.wait_for_function('fixture.mounts===2');nav('home');check('Leaving Idea tab disposes scene and cancels feed','fixture.disposes===2&&window.__ideaSpaceController.get()===null')
  page.evaluate("fixture.mode='delay'");nav('idea');page.wait_for_function("typeof fixture.resolve==='function'");nav('home');page.evaluate('fixture.resolve()');page.wait_for_function('fixture.disposes===3');check('Late model load cannot reopen departed tab','window.__ideaSpaceController.get()===null&&document.getElementById("officeSpaceSection").hidden')
  page.evaluate("fixture.mode='fail'");nav('idea');page.wait_for_function("!document.querySelector('.office-space-failure').hidden")
  check('Renderer failure keeps legacy usable and toggle retryable','!document.getElementById("officeRoom").hidden&&!document.querySelector("#officeSpaceToggle").disabled&&document.querySelector(".office-space-failure").textContent.includes("Fixture GPU failure")')
  assert not errors,errors
  report={'result':'pass','checks':checks,'count':len(checks),'browser':browser.version,'graphicsRendered':False,'externalCalls':0,'scope':'Real integration/controller/feed modules; fetch and renderer mocked for lifecycle isolation','pageErrors':errors};path=ROOT/'evidence/space-studio-r3/app-lifecycle.json';path.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'result':'pass','checks':len(checks)}));browser.close()
if __name__=='__main__':main()
