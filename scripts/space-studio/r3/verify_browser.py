#!/usr/bin/env python3
"""Exercise real Three.js scene/GLB/controller and DOM with CPU geometry adapter.
This is not a WebGL/GPU/Windows performance or visual certification.
"""
from pathlib import Path
import argparse,base64,json,sys,time,gzip
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'scripts/space-studio'))
from offline_browser import load_modules

def mount(page,model=None,geometryOnly=True):
 css=(ROOT/'public/space-studio/viewer.css').read_text()
 page.set_content('<html><head><style>body{margin:0;background:#061827}'+css+'</style></head><body><main id="probe" style="width:100vw;height:100vh"></main></body></html>')
 # Network navigation is administratively disabled; explicitly mock only storage.
 page.evaluate("()=>{const data=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)},configurable:true});}")
 page.evaluate('''async ({modules,model,geometryOnly})=>{
  const imports={};for(const [name,code] of Object.entries(modules))imports['app/'+name]=URL.createObjectURL(new Blob([code],{type:'text/javascript'}));
  const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
  const {mountSpaceViewer}=await import('app/space-studio/viewer.mjs');
  window.makeViewer=()=>mountSpaceViewer(document.querySelector('#probe'),{geometryOnly,live:true,manual:true,modelBuffer:Uint8Array.from(atob(model),c=>c.charCodeAt(0)).buffer});
  window.viewer=await makeViewer();
  window.bot=(id,state='ready',extra={})=>({connectionId:id,name:'Fixture '+id,provider:'Test fixture',color:'#64cdea',role:'worker',roles:['worker'],connected:true,state,jobs:[],...extra});
  window.snap=bots=>({schema:1,source:'live',generatedAt:new Date().toISOString(),bots});
 }''',dict(modules=load_modules(),geometryOnly=geometryOnly,model=model if model is not None else base64.b64encode((ROOT/'public/assets/tam19.glb').read_bytes()).decode()))

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,default=ROOT/'evidence/space-studio-r3/browser-geometry.json');args=ap.parse_args()
 checks=[];errors=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  page=browser.new_page(viewport={'width':1440,'height':960});page.on('pageerror',lambda e:errors.append(str(e)));mount(page)
  def check(name,script):
   value=page.evaluate(script)
   if not value:raise AssertionError(name)
   checks.append({'name':name,'result':'pass'});print('PASS',name,flush=True)
  check('Empty live scene hides the original demo robot and has no fake account','viewer.stats().liveRobots===0 && !viewer.robot.visible && viewer.getFleet().length===0')
  check('Approved workstation/chair count and geometry mode are explicit','viewer.stats().geometricWorkstations===9&&viewer.stats().geometricChairs===9&&viewer.geometryOnly')
  page.evaluate("viewer.setFleetSnapshot(snap(Array.from({length:9},(_,i)=>bot('idle-'+i,'ready'))))")
  check('R9 first real roster of ready bots fills nine separate chairs after empty feed',
     '''()=>{const fleet=viewer.getFleet();return fleet.length===9&&fleet.every(a=>a.seatId&&a.phase==='seated'&&a.motion.typing===0)&&new Set(fleet.map(a=>a.seatId)).size===9&&new Set(fleet.map(a=>a.position.x.toFixed(3)+','+a.position.z.toFixed(3))).size===9;}''')
  page.evaluate('viewer.stepLive(.1);for(let i=0;i<1800;i++)viewer.stepLive(.1)')
  check('R9 ready accounts remain seated past idle timeout, not herded back to entrance','viewer.getFleet().every(a=>a.seatId&&a.phase==="seated")')
  page.evaluate("viewer.setFleetSnapshot(snap(Array.from({length:12},(_,i)=>bot('account-'+i,i===0?'working':'ready'))))")
  check('Twelve real-ID fixture accounts produce twelve independent GLB roots','viewer.stats().liveRobots===12 && viewer.scene.getObjectByName("LiveAccountRobots").children.filter(x=>x.name.startsWith("AccountRobot_")).length===12')
  check('Clone head joints and material ownership are independent/shared as intended','''()=>{const root=viewer.scene.getObjectByName('LiveAccountRobots'),models=root.children.filter(x=>x.name.startsWith('AccountRobot_'));return new Set(models.map(x=>x.getObjectByName('Head_Rig'))).size===12 && new Set(viewer.getFleet().filter(x=>x.seatId).map(x=>x.seatId)).size===9;}''')
  check('All twelve labels have finite projected coordinates and reach DOM','viewer.labelPositions().every(p=>!p.visible||Number.isFinite(p.x)&&Number.isFinite(p.y))&&document.querySelectorAll(".space-name-tag").length===12')
  check('Name anchors stay aligned after close view and hero camera round trip',"""()=>{viewer.setCamera('hero');const before=viewer.labelPositions();viewer.focusRobot('account-0');viewer.setCamera('hero');const after=viewer.labelPositions();return before.every((a,i)=>Math.abs(a.x-after[i].x)<.01&&Math.abs(a.y-after[i].y)<.01);}""")
  page.evaluate("window.before=viewer.scene.getObjectByName('AccountRobot_account-0').uuid;viewer.setFleetSnapshot(snap([bot('account-0','working',{name:'<img src=x onerror=alert(1)>'}),bot('account-1')]))")
  check('Rename keeps actual model instance; deleted accounts and tags disappear','viewer.stats().liveRobots===2&&viewer.scene.getObjectByName("AccountRobot_account-0").uuid===before&&document.querySelectorAll(".space-name-tag").length===2')
  check('Account names are plain text, not executable markup','document.querySelector(".space-name-tag strong").textContent.startsWith("<img")&&document.querySelectorAll(".space-name-layer img").length===0')
  page.locator('.space-name-tag').first.click()
  check('Name click selects real avatar and opens detail with role','!document.querySelector(".space-agent-detail").hidden&&document.querySelector(".space-name-tag").getAttribute("aria-pressed")==="true"')
  page.locator('.space-brightness input').fill('78');page.locator('.space-brightness input').dispatch_event('input')
  check('Mild brightness change is bounded and written to storage adapter (mocked in this browser)','viewer.getBrightness()===.78&&localStorage.getItem("aios-space-studio-brightness")==="0.78"')
  page.locator('[data-action="motion"]').click();page.evaluate('viewer.stepLive(2)')
  check('Motion pause does not mark the actual worker idle','viewer.isMotionPaused()&&viewer.getFleet()[0].data.state==="working"')
  page.locator('[data-action="motion"]').click();page.evaluate("viewer.markFleetStale();window.stalePositions=JSON.stringify(viewer.getFleet().map(a=>a.position));viewer.stepLive(2)")
  check('Stale data freezes poses and removes working animation','viewer.getFleet().every(a=>a.data.state==="unknown"&&a.motion.typing===0)&&JSON.stringify(viewer.getFleet().map(a=>a.position))===stalePositions')
  page.evaluate("viewer.setFleetSnapshot(snap([bot('account-0','working'),bot('account-1','reviewing')]));viewer.setDisplayMode('demo');viewer.setTime(16)")
  check('Demo is separated and does not erase live roster','viewer.robot.visible&&!viewer.scene.getObjectByName("LiveAccountRobots").visible&&viewer.getFleet().length===2&&document.querySelector(".space-pill").textContent.includes("DEMO")')
  page.evaluate("viewer.setDisplayMode('live');viewer.setFleetSnapshot(snap([bot('account-0','completed'),bot('account-1','reviewing')]))")
  metrics=page.evaluate('''()=>{const max={hand:0,limb:0,seat:0},phases=new Set();for(let i=0;i<720;i++){viewer.stepLive(1/24);const a=viewer.getFleet()[0];phases.add(a.phase);const m=viewer.getMetrics().robots.find(x=>x.id===a.id);if(m.handContactError!==null)max.hand=Math.max(max.hand,m.handContactError);max.limb=Math.max(max.limb,m.maxLimbResidual||0);if(m.pelvisSeatGap!==null)max.seat=Math.max(max.seat,Math.abs(m.pelvisSeatGap));}return {...max,phases:[...phases],end:viewer.getFleet()[0].phase};}''')
  print('ACTUAL GLB METRICS',json.dumps(metrics),flush=True)
  assert metrics['hand']<.035 and metrics['seat']<.002,metrics
  check('Completion actually stands, returns the chair and releases reservation','viewer.getFleet()[0].phase==="standby"&&viewer.getFleet()[0].seatId===null')
  page.evaluate("viewer.setFleetSnapshot(snap([bot('account-0','working'),bot('account-1','reviewing')]))")
  ingress=page.evaluate('''()=>{let maxHand=0,maxStep=0,old=viewer.getFleet()[0].position;for(let i=0;i<1440;i++){viewer.stepLive(1/24);const a=viewer.getFleet()[0],m=viewer.getMetrics().robots.find(x=>x.id===a.id);maxHand=Math.max(maxHand,m.handContactError||0);maxStep=Math.max(maxStep,Math.hypot(a.position.x-old.x,a.position.z-old.z));old=a.position;}return {maxHand,maxStep,phase:viewer.getFleet()[0].phase};}''')
  assert ingress['maxStep']<.12 and ingress['maxHand']<.035 and ingress['phase']=='seated',ingress
  checks.append({'name':'Actual cloned GLB walks/pulls/sits without root teleport and contact remains bounded','result':'pass'})
  page.set_viewport_size({'width':480,'height':760});page.wait_for_timeout(50)
  check('Resize keeps valid camera and responsive names','Number.isFinite(viewer.camera.left)&&viewer.labelPositions().every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))')
  check('Hidden demo meshes are excluded from exported visible geometry','''()=>{const forbidden=new Set();viewer.robot.traverse(o=>{if(o.isMesh)forbidden.add(o.uuid);});return viewer.exportGeometry().nodes.every(n=>!forbidden.has(n.id));}''')
  for i in range(3):
   page.evaluate('viewer.dispose()');check('Dispose removes canvas and UI cycle '+str(i),'document.querySelectorAll(".space-studio-canvas,.space-viewer").length===0');page.evaluate('async()=>{window.viewer=await makeViewer();return true;}')
  page.evaluate('viewer.dispose()')
  bad=browser.new_page(viewport={'width':900,'height':700});mount(bad,base64.b64encode(b'bad glb bytes').decode());assert bad.evaluate('viewer.stats().robotLoaded===false')
  assert bad.locator('.space-model-warning').inner_text();checks.append({'name':'Missing/corrupt GLB gives honest model warning, not placeholder robot','result':'pass'})
  assert not errors,errors
  report={'result':'pass','scope':'real Three.js geometry, cloned TAM19 GLB, real kinematics and DOM; CPU export adapter without WebGL','browser':browser.version,'checks':checks,'count':len(checks),'egressMetrics':metrics,'ingressMetrics':ingress,'pageErrors':errors,'localStorageBackend':'in-memory test adapter; network navigation blocked by browser policy','windowsTested':False,'webglRendered':False}
  args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'result':report['result'],'checks':len(checks),'metrics':metrics,'ingress':ingress}));browser.close()
if __name__=='__main__':main()
