#!/usr/bin/env python3
"""Export actual R3 geometry, rig poses and DOM name overlays using six explicit fixtures."""
from pathlib import Path
import argparse,json,gzip,sys,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(Path(__file__).parent));from verify_browser import mount

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--out',type=Path,required=True);ap.add_argument('--frames',type=int,default=193);ap.add_argument('--fps',type=int,default=12);a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1280,'height':800});mount(page)
  page.evaluate('''()=>{
   window.fixtureBots=[
    bot('fixture-lead','planning',{name:'AI 01 / Planner',role:'founder',roles:['founder'],color:'#65d2ce'}),
    bot('fixture-builder','working',{name:'AI 02 / Builder',role:'worker',roles:['worker'],color:'#83b9f1'}),
    bot('fixture-review','reviewing',{name:'AI 03 / Reviewer',role:'reviewer',roles:['reviewer'],color:'#d5a9ed'}),
    bot('fixture-research','planning',{name:'AI 04 / Research',role:'council',roles:['council'],color:'#e6c479'}),
    bot('fixture-media','rendering',{name:'AI 05 / Media',role:'worker',roles:['worker'],color:'#e2a47a'}),
    bot('fixture-ready','ready',{name:'AI 06 / Ready',role:'worker',roles:['worker'],color:'#8ccea5'})
   ];viewer.setFleetSnapshot(snap(fixtureBots));viewer.stepLive(1);viewer.setCamera('hero');
  }''')
  page.evaluate('window.snapshotText=JSON.stringify(viewer.exportGeometry());true');length=page.evaluate('snapshotText.length');print('GEOMETRY_BYTES',length,flush=True)
  chunks=[page.evaluate('(off)=>snapshotText.slice(off,off+500000)',off) for off in range(0,length,500000)];geometry=json.loads(''.join(chunks));del chunks
  page.evaluate('window.snapshotText=null;true');print('GEOMETRY',len(geometry['nodes']),len(geometry['geometries']),flush=True)
  with gzip.open(a.out/'geometry.json.gz','wt') as f:json.dump(geometry,f,separators=(',',':'))
  del geometry
  initial=json.loads(page.evaluate('JSON.stringify(viewer.exportPose())'));(a.out/'hero-pose.json').write_text(json.dumps(initial))
  page.add_style_tag(content='html,body,.space-viewer{background:transparent!important}.space-stage{visibility:hidden!important}.space-note{bottom:135px!important}')
  page.screenshot(path=str(a.out/'overlay-hero.png'),omit_background=True)
  page.evaluate("viewer.focusRobot('fixture-lead')");(a.out/'close-pose.json').write_text(json.dumps(json.loads(page.evaluate('JSON.stringify(viewer.exportPose())'))))
  page.screenshot(path=str(a.out/'overlay-close.png'),omit_background=True);page.evaluate("viewer.setCamera('hero')")
  # Existing real controller consumes changed input state. No provider call or invented progress.
  poses=[];phases=[]
  for i in range(a.frames):
   t=i/a.fps
   if i==a.fps*2:page.evaluate("fixtureBots[0].state='completed';viewer.setFleetSnapshot(snap(fixtureBots))")
   if i:page.evaluate('dt=>{viewer.stepLive(dt);return true;}',1/a.fps)
   pose=json.loads(page.evaluate('JSON.stringify(viewer.exportPose())'));pose['fixtureTime']=t;poses.append(pose)
   if i%a.fps==0:
    info=page.evaluate('viewer.getFleet().map(a=>({id:a.id,phase:a.phase,state:a.data.state,position:a.position}))');phases.append({'at':t,'bots':info})
   if i%1==0:page.screenshot(path=str(a.out/f'overlay-{i:04d}.png'),omit_background=True)
   if i%36==0:print('FRAME',i,flush=True)
  with gzip.open(a.out/'poses.json.gz','wt') as f:json.dump(poses,f,separators=(',',':'))
  (a.out/'metadata.json').write_text(json.dumps({'width':1280,'height':800,'fps':a.fps,'frames':a.frames,'accounts':'six test fixture accounts, not user accounts','backend':'Three.js CPU geometry and real R3 controller; VTK renders exported transforms','phases':phases},indent=2))
  viewer_stats=page.evaluate('viewer.stats()');(a.out/'scene-stats.json').write_text(json.dumps(viewer_stats,indent=2));page.evaluate('viewer.dispose()');browser.close();print('EXPORTED',a.frames,flush=True)
if __name__=='__main__':main()
