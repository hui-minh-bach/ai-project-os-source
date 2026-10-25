#!/usr/bin/env python3
"""VTK/Mesa offline renderer for the app's exported Three.js geometry and poses.
This is NOT an installed Windows app recording and not a WebGL render.
No AI images are used as geometry, furniture, or robots.
"""
from __future__ import annotations
import base64,gzip,json,math,io,sys,time
from pathlib import Path
import numpy as np
import vtk
from vtk.util.numpy_support import numpy_to_vtk,numpy_to_vtkIdTypeArray,vtk_to_numpy
from PIL import Image,ImageFilter,ImageChops,ImageEnhance,ImageDraw,ImageFont

def array_of(a):
    dtypes={'Float32Array':np.float32,'Float64Array':np.float64,'Uint32Array':np.uint32,'Uint16Array':np.uint16,'Uint8Array':np.uint8}
    return np.frombuffer(base64.b64decode(a['base64']),dtype=dtypes[a['type']])

def srgb(values):
    a=np.array(values,dtype=float);return np.where(a<=.0031308,a*12.92,1.055*np.maximum(a,0)**(1/2.4)-.055).clip(0,1)

def vtk_image(array):
    h,w=array.shape[:2];im=vtk.vtkImageData();im.SetDimensions(w,h,1)
    channels=1 if array.ndim==2 else array.shape[2]
    scalars=numpy_to_vtk(np.ascontiguousarray(array.reshape(-1,channels)),deep=True);im.GetPointData().SetScalars(scalars);return im

def texture_from_png(data):
    im=Image.open(io.BytesIO(base64.b64decode(data.split(',',1)[1]))).convert('RGBA')
    tex=vtk.vtkTexture();tex.SetInputData(vtk_image(np.asarray(im)[::-1]));tex.InterpolateOn();tex.MipmapOn();tex.UseSRGBColorSpaceOn();return tex

def environment():
    w,h=512,256;yy,xx=np.mgrid[0:h,0:w];u=xx/w;v=yy/h
    env=np.zeros((h,w,3),np.float32)
    env[:]=[.16,.22,.30]
    sky=np.exp(-((v-.30)/.3)**2)[...,None];env+=sky*np.array([.20,.25,.28])
    for a,b,sx,sy,power,color in [( .23,.28,.09,.18,3.6,[1,.89,.72]),(.76,.30,.11,.16,2.2,[.56,.85,1]),(.48,.18,.13,.10,1.7,[1,1,1])]:
        delta=np.minimum(np.abs(u-a),1-np.abs(u-a))
        val=np.exp(-((delta/sx)**8+((v-b)/sy)**8))*power
        env+=val[...,None]*np.array(color)
    tex=vtk.vtkTexture();tex.SetColorModeToDirectScalars();tex.SetInputData(vtk_image(env));tex.InterpolateOn();tex.MipmapOn();return tex

class SourceRenderer:
    def __init__(self,snapshot:dict,width=1600,height=900):
        self.width,self.height=width,height;self.s=snapshot;self.actors={};self.mappers={};self.textures={}
        self.window=vtk.vtkRenderWindow();self.window.SetOffScreenRendering(1);self.window.SetSize(width,height);self.window.SetMultiSamples(0);self.window.SetAlphaBitPlanes(1)
        self.ren=vtk.vtkRenderer();self.ren.SetBackground(0.01,.02,.05);self.ren.SetBackgroundAlpha(0);self.window.AddRenderer(self.ren)
        self.ren.SetUseFXAA(True);self.ren.SetUseDepthPeeling(True);self.ren.SetMaximumNumberOfPeels(30);self.ren.SetOcclusionRatio(.05)
        self.env=environment();self.ren.UseImageBasedLightingOn();self.ren.SetEnvironmentTexture(self.env,False)
        self.ren.AutomaticLightCreationOff()
        for pos,intensity,color in [((-6,15,8),2.2,(1,.92,.80)),((7,8,-7),1.4,(.50,.78,1)),((6,5,8),.65,(.78,.94,1))]:
            light=vtk.vtkLight();light.SetLightTypeToSceneLight();light.SetPosition(*pos);light.SetFocalPoint(0,0,0);light.SetColor(*color);light.SetIntensity(intensity);light.PositionalOff();self.ren.AddLight(light)
        self.ren.UseShadowsOn()
        # Contact occlusion is evaluated on the actual geometry.
        steps=vtk.vtkRenderStepsPass();ssao=vtk.vtkSSAOPass();ssao.SetDelegatePass(steps);ssao.SetRadius(.20);ssao.SetBias(.015);ssao.SetKernelSize(32);ssao.SetBlur(True)
        tone=vtk.vtkToneMappingPass();tone.SetToneMappingType(vtk.vtkToneMappingPass.GenericFilmic);tone.SetGenericFilmicDefaultPresets();tone.SetUseACES(True);tone.SetExposure(1.05);tone.SetDelegatePass(ssao);self.ren.SetPass(tone);self.passes=(steps,ssao,tone)
        for uid,g in snapshot['geometries'].items():
            pos=array_of(g['attributes']['position']).reshape(-1,3);poly=vtk.vtkPolyData();pts=vtk.vtkPoints();pts.SetData(numpy_to_vtk(pos,deep=True));poly.SetPoints(pts)
            idx=array_of(g['index']) if g.get('index') else np.arange(len(pos),dtype=np.int64)
            idx=idx.reshape(-1,3).astype(np.int64);cells=np.column_stack([np.full(len(idx),3,dtype=np.int64),idx]).ravel();ca=vtk.vtkCellArray();ca.SetCells(len(idx),numpy_to_vtkIdTypeArray(cells,deep=True));poly.SetPolys(ca)
            if 'normal' in g['attributes']:
                normals=numpy_to_vtk(array_of(g['attributes']['normal']).reshape(-1,3),deep=True);normals.SetName('Normals');poly.GetPointData().SetNormals(normals)
            if 'uv' in g['attributes']:
                uv=numpy_to_vtk(array_of(g['attributes']['uv']).reshape(-1,2),deep=True);uv.SetName('UV');poly.GetPointData().SetTCoords(uv)
            mapper=vtk.vtkPolyDataMapper();mapper.SetInputData(poly);mapper.ScalarVisibilityOff();self.mappers[uid]=mapper
        for tid,t in snapshot['textures'].items():self.textures[tid]=texture_from_png(t['png'])
        for node in snapshot['nodes']:
            a=vtk.vtkActor();a.SetMapper(self.mappers[node['geometry']]);prop=a.GetProperty();m=snapshot['materials'][node['material']]
            prop.SetInterpolationToPBR();prop.SetColor(*m['color']);prop.SetMetallic(m['metalness']);prop.SetRoughness(max(.14,m['roughness']));prop.SetOpacity(m['opacity']);prop.SetAmbient(.12)
            if m.get('map') in self.textures:prop.SetBaseColorTexture(self.textures[m['map']])
            if m.get('emissiveMap') in self.textures:prop.SetEmissiveTexture(self.textures[m['emissiveMap']])
            e=np.array(m['emissive'])*m['emissiveIntensity']*.6;prop.SetEmissiveFactor(*e)
            if m['unlit']:prop.LightingOff()
            if not m['doubleSided']:prop.BackfaceCullingOn()
            self._matrix(a,node['matrix']);self.ren.AddActor(a);self.actors[node['id']]=a
        self.camera=self.ren.GetActiveCamera();self.camera.ParallelProjectionOn();self.camera.SetViewUp(0,1,0)
        bgid=snapshot.get('background');self.background=Image.open(io.BytesIO(base64.b64decode(snapshot['textures'][bgid]['png'].split(',',1)[1]))).convert('RGB').resize((width,height),Image.Resampling.LANCZOS) if bgid else Image.new('RGB',(width,height),(2,8,25))
        self.capture=vtk.vtkWindowToImageFilter();self.capture.SetInput(self.window);self.capture.SetInputBufferTypeToRGBA();self.capture.ReadFrontBufferOff()
    def _matrix(self,actor,values):
        a=np.asarray(values).reshape(4,4).T;m=vtk.vtkMatrix4x4()
        for i in range(4):
            for j in range(4):m.SetElement(i,j,float(a[i,j]))
        actor.SetUserMatrix(m)
    def apply(self,pose):
        for n in pose['nodes']:
            a=self.actors.get(n['id'])
            if a:self._matrix(a,n['matrix']);a.SetVisibility(n.get('visible',True))
        c=pose['camera'];self.camera.SetPosition(*c['position']);self.camera.SetFocalPoint(*c['target']);self.camera.SetParallelScale(c['height']/2);self.camera.SetViewUp(0,1,0);self.ren.ResetCameraClippingRange()
    def frame(self,pose,bloom=True):
        self.apply(pose);self.window.Render();self.capture.Modified();self.capture.Update()
        arr=vtk_to_numpy(self.capture.GetOutput().GetPointData().GetScalars()).reshape(self.height,self.width,4)[::-1].copy()
        rgba=Image.fromarray(arr,'RGBA');base=self.background.convert('RGBA');base.alpha_composite(rgba);out=base.convert('RGB')
        if bloom:
            f=np.asarray(out,dtype=np.float32);lum=np.max(f,axis=2);bright=np.clip((lum-198)/57,0,1)[...,None];glow=Image.fromarray((f*bright*.28).clip(0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3));out=ImageChops.add(out,glow)
        return out
    def close(self):self.window.Finalize()

def main():
    if len(sys.argv)!=3:raise SystemExit('Usage: python render_offline.py EXPORT_DIRECTORY OUTPUT_DIRECTORY')
    source=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(exist_ok=True,parents=True)
    with gzip.open(source/'geometry.json.gz','rt') as f:s=json.load(f)
    t=time.time();renderer=SourceRenderer(s);print('Renderer ready',time.time()-t,flush=True)
    for name in ['hero_0','close_5.5','close_11.2','close_16','side_16','overview_0']:
        pose=json.loads((source/(name+'.json')).read_text());start=time.time();image=renderer.frame(pose);image.save(out/(name+'.png'));print('Rendered',name,round(time.time()-start,2),flush=True)
    print('BACKEND',renderer.window.GetClassName(),flush=True);renderer.close()
if __name__=='__main__':main()
