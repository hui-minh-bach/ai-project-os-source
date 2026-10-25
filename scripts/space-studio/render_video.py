#!/usr/bin/env python3
"""Render MP4 frames from export_scene.py output with the documented VTK backend.
No generated room photograph is used. Video is an offline source render.
"""
from __future__ import annotations
import argparse,gzip,json,os,subprocess,sys,time
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from render_offline import SourceRenderer
ROOT=Path(__file__).resolve().parents[2]
LABELS={
 'approach':'\u0110i \u0111\u1ebfn tr\u1ea1m l\u00e0m vi\u1ec7c',
 'reach':'\u0110\u01b0a tay ch\u1ea1m l\u01b0ng gh\u1ebf',
 'pull':'K\u00e9o gh\u1ebf 3D ra kh\u1ecfi b\u00e0n',
 'align':'\u0110i v\u00f2ng v\u00e0o tr\u01b0\u1edbc m\u1eb7t gh\u1ebf',
 'sit':'H\u1ea1 ng\u01b0\u1eddi xu\u1ed1ng m\u1eb7t gh\u1ebf',
 'scoot-in':'Gh\u1ebf v\u00e0 robot c\u00f9ng d\u1ecbch v\u00e0o b\u00e0n',
 'work':'Ng\u1ed3i l\u00e0m vi\u1ec7c t\u1ea1i b\u00e0n ph\u00edm',
 'scoot-out':'L\u00f9i gh\u1ebf tr\u01b0\u1edbc khi \u0111\u1ee9ng l\u00ean',
 'stand':'\u0110\u1ee9ng d\u1eady, ch\u00e2n ti\u1ebfp x\u00fac s\u00e0n',
 'return-approach':'\u0110i v\u00f2ng ra b\u00ean gh\u1ebf',
 'return':'Tay \u0111\u1ea9y gh\u1ebf v\u1ec1 v\u1ecb tr\u00ed ban \u0111\u1ea7u',
 'leave':'R\u1eddi tr\u1ea1m l\u00e0m vi\u1ec7c'}
def font(size,bold=False):
 candidates=[Path('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf'),Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/('segoeuib.ttf' if bold else 'segoeui.ttf')]
 for f in candidates:
  if f.is_file():return ImageFont.truetype(str(f),size)
 return ImageFont.load_default(size=size)
def caption(im,pose,width,height):
 overlay=Image.new('RGBA',im.size,(0,0,0,0));d=ImageDraw.Draw(overlay);scale=width/1280
 def f(n,b=False):return font(round(n*scale),b)
 x,y=round(28*scale),round(23*scale)
 d.rounded_rectangle((x-10,y-9,x+300*scale,y+45*scale),radius=10*scale,fill=(4,19,37,208))
 d.text((x,y),'IDEA STUDIO  /  REAL 3D R2',font=f(17,True),fill=(223,246,248));d.text((x,y+25*scale),'SOURCE GEOMETRY + CONTACT ANIMATION',font=f(9),fill=(126,211,220))
 t=pose['videoTime'];phase=pose.get('metrics',{}).get('phase','approach')
 title='To\u00e0n c\u1ea3nh m\u00f4 h\u00ecnh 3D' if t<3 else 'C\u00f9ng m\u1ed9t c\u1ea3nh, c\u00f9ng m\u1ed9t source' if t>=33 else LABELS.get(phase,phase)
 y=height-round(89*scale);d.rounded_rectangle((x-10,y-10,width-x+10,height-18*scale),radius=10*scale,fill=(4,18,34,220));d.line((x-10,y-7,x-10,height-28*scale),fill=(101,235,216),width=3)
 d.text((x+7,y),title,font=f(21),fill=(235,250,250));subtitle='D\u1ef1ng ngo\u1ea1i tuy\u1ebfn t\u1eeb source \u00b7 Kh\u00f4ng ph\u1ea3i b\u1ea3n quay \u1ee9ng d\u1ee5ng Windows'
 d.text((x+8,y+33*scale),subtitle,font=f(12),fill=(160,202,217));d.text((width-x-88*scale,y+3*scale),f"{t:04.1f} / 36s",font=f(13),fill=(160,224,229))
 return Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--input',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--start',type=int,default=0);p.add_argument('--end',type=int,default=-1);p.add_argument('--width',type=int,default=1280);p.add_argument('--height',type=int,default=720);p.add_argument('--samples',type=Path);args=p.parse_args()
 manifest=json.loads((args.input/'manifest.json').read_text());fps=manifest['videoFPS'];count=int(manifest['videoDuration']*fps);end=args.end if args.end>=0 else count
 if not 0<=args.start<end<=count:p.error('Invalid frame interval')
 args.output.parent.mkdir(parents=True,exist_ok=True)
 with gzip.open(args.input/'geometry.json.gz','rt') as f:scene=json.load(f)
 renderer=SourceRenderer(scene,args.width,args.height)
 cmd=['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{args.width}x{args.height}','-r',str(fps),'-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','19','-threads','1','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-movflags','+faststart',str(args.output)]
 ff=subprocess.Popen(cmd,stdin=subprocess.PIPE);started=time.time();written=0
 sample_times={0,3,6,8,10,12,14,16,19,22,24,26,29,31,34}
 try:
  with gzip.open(args.input/'video-poses.jsonl.gz','rt') as stream:
   for i,line in enumerate(stream):
    if i<args.start:continue
    if i>=end:break
    pose=json.loads(line);im=caption(renderer.frame(pose),pose,args.width,args.height);ff.stdin.write(im.tobytes());written+=1
    if args.samples and i%fps==0 and i//fps in sample_times:
     args.samples.mkdir(parents=True,exist_ok=True);im.save(args.samples/f'video_{i//fps:02d}s.jpg',quality=94)
    if written%(fps*3)==0:print(json.dumps({'frame':i,'segmentFrames':written,'seconds':round(time.time()-started,1)}),flush=True)
  ff.stdin.close();rc=ff.wait(timeout=30)
  if rc:raise RuntimeError(f'ffmpeg exited {rc}')
 finally:
  renderer.close()
  if ff.poll() is None:ff.terminate();ff.wait(timeout=10)
 print(json.dumps({'output':str(args.output),'frames':written,'fps':fps,'duration':written/fps,'backend':'VTK EGL/Mesa, not WebGL','seconds':round(time.time()-started,2)}),flush=True)
if __name__=='__main__':main()
