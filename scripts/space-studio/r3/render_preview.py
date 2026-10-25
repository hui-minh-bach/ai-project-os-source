#!/usr/bin/env python3
"""Render current app geometry with VTK and composite actual source DOM overlays.
All six accounts are explicit test fixtures. No screenshots of Windows are claimed.
"""
from pathlib import Path
import argparse,gzip,json,sys,time,subprocess
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT/'scripts/space-studio'));from render_offline import SourceRenderer

def label(image,text):
 image=image.convert('RGBA');d=ImageDraw.Draw(image);d.rounded_rectangle((18,image.height-26,image.width-18,image.height-6),radius=5,fill=(3,18,31,240))
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11);d.text((28,image.height-24),text,font=font,fill=(175,215,225));return image.convert('RGB')
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--out',type=Path,default=ROOT/'evidence/space-studio-r3');ap.add_argument('--video',action='store_true');args=ap.parse_args();out=args.out;out.mkdir(parents=True,exist_ok=True)
 with gzip.open(args.source/'geometry.json.gz','rt') as f:snapshot=json.load(f)
 w,h=960,600;renderer=SourceRenderer(snapshot,w,h);renderer.passes[-1].SetExposure(1.05*.85)
 caption='R3 / 6 TEST ACCOUNTS / SOURCE GEOMETRY + DOM / OFFLINE VTK - NOT WINDOWS'
 results=[]
 for name,posefile,overlay in [('hero','hero-pose.json','overlay-hero.png'),('robot-close','close-pose.json','overlay-close.png')]:
  start=time.time();pose=json.loads((args.source/posefile).read_text());raw=renderer.frame(pose);img=raw.convert('RGBA');ui=Image.open(args.source/overlay).convert('RGBA').resize((w,h),Image.Resampling.LANCZOS);img.alpha_composite(ui);label(img,caption).save(out/(name+'.png'));results.append({'view':name,'seconds':round(time.time()-start,2)});print('RENDER',name,results[-1]['seconds'],flush=True)
 if args.video:
  with gzip.open(args.source/'poses.json.gz','rt') as f:poses=json.load(f)
  meta=json.loads((args.source/'metadata.json').read_text());fps=meta['fps'];dest=out/'Space_Studio_Team_R3_Fixture_Demo.mp4'
  ff=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24','-s',f'{w}x{h}','-r',str(fps),'-i','-','-an','-c:v','libx264','-crf','21','-preset','fast','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],stdin=subprocess.PIPE)
  for i,pose in enumerate(poses):
   image=renderer.frame(pose).convert('RGBA');ui=Image.open(args.source/f'overlay-{i:04d}.png').convert('RGBA').resize((w,h),Image.Resampling.LANCZOS);image.alpha_composite(ui);image=label(image,caption);ff.stdin.write(np.asarray(image).tobytes())
   if i in [0,24,60,96,144,192]:image.save(out/f'video-sample-{i:03d}.jpg',quality=88)
   if i%24==0:print('VIDEO',i,'/',len(poses),flush=True)
  ff.stdin.close();code=ff.wait();assert code==0;results.append({'video':dest.name,'frames':len(poses),'fps':fps,'width':w,'height':h,'duration':len(poses)/fps})
 report={'backend':renderer.window.GetClassName(),'graphics':'offline VTK/Mesa, not WebGL/Windows','inputs':'R3 unchanged room geometry, cloned TAM19, actual R3 controller and actual DOM labels, six synthetic test accounts','results':results};(out/'render-manifest.json').write_text(json.dumps(report,indent=2)+'\n');renderer.close();print('DONE',flush=True)
if __name__=='__main__':main()
