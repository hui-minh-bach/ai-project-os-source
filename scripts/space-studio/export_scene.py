#!/usr/bin/env python3
"""Export real application geometry and deterministic poses without using WebGL.
Requires Python playwright and a locally installed Chromium. No network is used.
"""
from __future__ import annotations
import argparse,gzip,hashlib,json,platform,shutil,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from offline_browser import mount,ROOT

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,default=ROOT/'.cache'/'space-scene');p.add_argument('--chromium');p.add_argument('--fps',type=int,default=24);p.add_argument('--video',action='store_true');args=p.parse_args()
 if not 1<=args.fps<=60:p.error('fps must be 1..60')
 out=args.out.resolve();out.mkdir(parents=True,exist_ok=True);errors=[];started=time.time()
 with sync_playwright() as pw:
  executable=args.chromium or shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')
  options={'headless':True,'args':['--disable-dev-shm-usage']}
  if platform.system()=='Linux':options['args'].append('--no-sandbox')
  if executable:options['executable_path']=executable
  browser=pw.chromium.launch(**options);page=browser.new_page(viewport={'width':1600,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  mount(page,geometry_only=True);page.evaluate('window.__spaceSnapshot=window.__spaceStudio.exportGeometry();true')
  snapshot=page.evaluate('()=>{const s=window.__spaceSnapshot;return {...s,geometries:{}};}');gids=page.evaluate('Object.keys(window.__spaceSnapshot.geometries)')
  for i,gid in enumerate(gids):
   g=page.evaluate('(id)=>{const g=window.__spaceSnapshot.geometries[id];return {attributes:Object.fromEntries(Object.entries(g.attributes).map(([k,a])=>[k,{...a,base64:undefined,length:a.base64.length}])),index:g.index?{...g.index,base64:undefined,length:g.index.base64.length}:null};}',gid)
   for name,a in list(g['attributes'].items())+([('index',g['index'])] if g['index'] else []):
    parts=[page.evaluate('([id,n,o])=>{const g=window.__spaceSnapshot.geometries[id];return (n==="index"?g.index:g.attributes[n]).base64.slice(o,o+800000)}',[gid,name,off]) for off in range(0,a.pop('length'),800000)];a['base64']=''.join(parts)
   snapshot['geometries'][gid]=g
   if i%75==0:print('Export geometry',i,'/',len(gids),flush=True)
  with gzip.open(out/'geometry.json.gz','wt',compresslevel=5) as f:json.dump(snapshot,f)
  previews=[('hero',0),('close',5.5),('close',11.2),('close',16),('side',16),('overview',0)]
  for v,t in previews:
   pose=page.evaluate('([v,t])=>{const s=window.__spaceStudio;s.setCamera(v);s.setTime(t);return s.exportPose();}',[v,t]);(out/f'{v}_{t}.json').write_text(json.dumps(pose),encoding='utf-8')
  metrics=page.evaluate('()=>{const rows=[];for(let i=0;i<=600;i++){const t=i/20,m=window.__spaceStudio.setTime(t);rows.push({time:t,...m.metrics,walking:m.walking});}return rows;}')
  (out/'metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
  if args.video:
   count=36*args.fps
   with gzip.open(out/'video-poses.jsonl.gz','wt',compresslevel=5) as f:
    for i in range(count):
     video_t=i/args.fps;scene_t=0 if video_t<3 else min(30,video_t-3);view='hero' if video_t<3 or video_t>=33 else 'close'
     pose=page.evaluate('([v,t])=>{const s=window.__spaceStudio;s.setCamera(v);s.setTime(t);return s.exportPose();}',[view,scene_t]);pose.update(frame=i,videoTime=video_t,view=view);f.write(json.dumps(pose,separators=(',',':'))+'\n')
     if i%(args.fps*6)==0:print('Export video frame',i,'/',count,flush=True)
  manifest={'revision':'space-studio-r2.1','geometryOnly':True,'webglRendered':False,'sourceHashes':{str(x.relative_to(ROOT)):hashlib.sha256(x.read_bytes()).hexdigest() for x in sorted((ROOT/'public'/'space-studio').glob('*.mjs'))},'meshNodes':len(snapshot['nodes']),'geometries':len(gids),'materials':len(snapshot['materials']),'videoFPS':args.fps,'videoDuration':36 if args.video else None,'poseChecks':len(metrics),'browserErrors':errors,'elapsedSeconds':round(time.time()-started,2)}
  (out/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');page.evaluate('window.__spaceStudio.dispose()');browser.close();print(json.dumps(manifest,indent=2))
 if errors:raise RuntimeError('Source evaluation reported browser errors')
if __name__=='__main__':main()
