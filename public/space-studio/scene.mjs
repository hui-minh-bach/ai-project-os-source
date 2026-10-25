import * as T from '/vendor/three.module.min.js';
import {GLTFLoader} from '/vendor/addons/GLTFLoader.js';
import {RoomEnvironment} from '/vendor/addons/RoomEnvironment.js';
import {mergeGeometries,mergeVertices} from '/vendor/addons/BufferGeometryUtils.js';
import {EffectComposer} from '/vendor/addons/EffectComposer.js';
import {RenderPass} from '/vendor/addons/RenderPass.js';
import {UnrealBloomPass} from '/vendor/addons/UnrealBloomPass.js';
import {OutputPass} from '/vendor/addons/OutputPass.js';
import {PALETTE as C,DESK,CHAIR,STATIONS,HERO,DURATION,REVISION,clamp,mix,interval} from './design.mjs';
import {motionAt,twoBone,gaitFootAt} from './motion.mjs';
import {createLiveFleetController} from './live-motion.mjs';
import {createFleetScene} from './fleet-scene.mjs';
import {clone as cloneRig} from '/vendor/addons/SkeletonUtils.js';

const Y=new T.Vector3(0,1,0),DOWN=new T.Vector3(0,-1,0);
function rng(seed=7281){return ()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
function rectShape(w,h,r){
 r=Math.min(r,w/2,h/2);const x=-w/2,y=-h/2,s=new T.Shape();
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
}
function roundedGeometry(w,h,d,r=.06){
 // Round the broad face, extruding along the thinnest axis. This keeps table
 // tops, platform corners and partition profiles genuinely rounded in 3D.
 let axis='z',ww=w,hh=h,dd=d;
 if(h<=w&&h<=d){axis='y';ww=w;hh=d;dd=h;}
 else if(w<=h&&w<=d){axis='x';ww=d;hh=h;dd=w;}
 const b=Math.max(.001,Math.min(r*.35,dd*.22,hh*.12,ww*.12));
 const shape=rectShape(ww-2*b,hh-2*b,Math.max(.001,r-b));
 let g=new T.ExtrudeGeometry(shape,{depth:dd-2*b,bevelEnabled:true,bevelSegments:4,steps:1,bevelSize:b,bevelThickness:b,curveSegments:8});
 g.translate(0,0,-(dd-2*b)/2);g.deleteAttribute('normal');g.deleteAttribute('uv');const raw=g;g=mergeVertices(g,1e-5);raw.dispose();g.computeVertexNormals();g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
 if(axis==='y')g.rotateX(-Math.PI/2);else if(axis==='x')g.rotateY(Math.PI/2);return g;
}
function canvasTexture(w,h,paint){const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;}
function dashboard(seed=1,title='AI SYSTEMS'){
 const rand=rng(seed);return canvasTexture(1024,512,(c,w,h)=>{
  const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#071d36');bg.addColorStop(1,'#0b4658');c.fillStyle=bg;c.fillRect(0,0,w,h);
  c.strokeStyle='#1b536d';c.lineWidth=1;for(let x=20;x<w;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=32;y<h;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  c.fillStyle='#c2ffff';c.font='600 32px sans-serif';c.fillText(title,34,48);c.font='14px monospace';c.fillStyle='#47c4d7';c.fillText('IDEA STUDIO / SYSTEM OVERVIEW',35,77);
  for(let i=0;i<3;i++){const x=30+i*330;c.fillStyle='#103d52';c.fillRect(x,102,306,92);c.fillStyle='#a7f9ff';c.font='bold 31px sans-serif';c.fillText(['98.4','24 / 7','09'][i],x+17,148);c.fillStyle='#46bdd5';c.font='15px sans-serif';c.fillText(['SYNC INDEX','STUDIO ONLINE','WORKSTATIONS'][i],x+17,178);}
  c.strokeStyle='#69efff';c.lineWidth=4;c.beginPath();for(let i=0;i<25;i++){const x=35+i*23,y=330+Math.sin(i*.7+seed)*24-rand()*76;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();
  for(let i=0;i<15;i++){const bh=26+rand()*110;c.fillStyle=i%3?'#28b6dd':'#92f4ff';c.fillRect(35+i*35,468-bh,20,bh);}
  c.beginPath();c.strokeStyle='#164c6a';c.lineWidth=25;c.arc(771,330,82,0,Math.PI*2);c.stroke();c.beginPath();c.strokeStyle='#7bf4fb';c.arc(771,330,82,-Math.PI/2,Math.PI*1.15);c.stroke();c.fillStyle='#d7ffff';c.font='bold 30px sans-serif';c.fillText('SYNC',729,340);
  c.fillStyle='#57bdcd';c.font='15px monospace';for(let i=0;i<4;i++){c.fillRect(675,438+i*14,200-i*25,3);}c.fillStyle='#e8c58d';c.beginPath();c.arc(971,43,7,0,Math.PI*2);c.fill();
 });
}
function starfield(){return canvasTexture(2048,1152,(c,w,h)=>{
 const rand=rng(26);c.fillStyle='#02091c';c.fillRect(0,0,w,h);
 for(let i=0;i<75;i++){const x=rand()*w,y=h*.52+Math.sin(x/w*7+i*.11)*h*.32+(rand()-.5)*h*.7,r=100+rand()*320;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,i%3?'rgba(19,61,139,.14)':'rgba(79,41,130,.13)');g.addColorStop(.6,'rgba(10,30,92,.05)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
 for(let i=0;i<5000;i++){const x=rand()*w,y=rand()*h,r=rand()<.015?1.7:rand()*.8+.12,a=rand()*.65+.2;c.fillStyle=`rgba(${rand()<.18?'163,202,255':'226,240,255'},${a})`;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();if(r>1.4){const g=c.createRadialGradient(x,y,0,x,y,9);g.addColorStop(0,'rgba(89,159,255,.35)');g.addColorStop(1,'rgba(40,90,255,0)');c.fillStyle=g;c.fillRect(x-9,y-9,18,18);}}
 });}
function glowTexture(){return canvasTexture(128,128,c=>{const g=c.createRadialGradient(64,64,3,64,64,64);g.addColorStop(0,'rgba(67,238,255,.4)');g.addColorStop(.45,'rgba(38,176,231,.13)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,128,128);});}

/** Build one fully geometric room. Camera, screenshot, video and app reuse it. */
export async function createSpaceStudio(host,{quality='high',manual=false,geometryOnly=false,modelBuffer=null,live=false,brightness=.85,onError=()=>{},onFrame=()=>{},onSelect=()=>{}}={}){
 if(!host)throw new TypeError('A host element is required.');
 let disposed=false,frame=0,time=0,playing=false,last=0,active=true,drag=null;
 let displayMode=live?'live':'demo',brightnessLevel=clamp(Number.isFinite(brightness)?brightness:.85,.60,1.05);
 const liveController=createLiveFleetController();
 // geometryOnly is for offline export/testing; it never reports a WebGL render.
 const renderer=geometryOnly?geometryExportAdapter():new T.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(manual?1:Math.min(devicePixelRatio||1,quality==='high'?1.5:1));
 renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.17*brightnessLevel;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
 renderer.domElement.className='space-studio-canvas';renderer.domElement.setAttribute('aria-label','Idea Studio - real 3D scene');renderer.domElement.tabIndex=0;host.appendChild(renderer.domElement);
 const scene=new T.Scene();scene.name='IdeaStudio_Space_R2';scene.background=starfield();
 const modelRoot=new T.Group();modelRoot.name='SpaceStudioGeometry';scene.add(modelRoot);
 const staticRoot=new T.Group();staticRoot.name='StaticArchitecture';modelRoot.add(staticRoot);
 const dynamicRoot=new T.Group();dynamicRoot.name='ArticulatedFurnitureAndRobots';modelRoot.add(dynamicRoot);
 const camera=new T.OrthographicCamera(-16,16,10,-10,.1,180);camera.name='HeroCamera';
 const target=new T.Vector3(...HERO.target),eye=new T.Vector3(...HERO.position);let view='hero',viewHeight=HERO.height,orbitAz=Math.atan2(eye.x-target.x,eye.z-target.z),orbitEl=Math.asin((eye.y-target.y)/eye.distanceTo(target));
 let envTarget=null;
 if(!geometryOnly){const pmrem=new T.PMREMGenerator(renderer),envScene=new RoomEnvironment(renderer);envTarget=pmrem.fromScene(envScene,.04);scene.environment=envTarget.texture;envScene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});pmrem.dispose();}

 scene.add(new T.HemisphereLight(0xb7ecff,0x203845,1.05));
 const key=new T.DirectionalLight(0xffefd7,3.8);key.position.set(-6,15,8);key.castShadow=true;key.shadow.mapSize.set(quality==='high'?2048:1024,quality==='high'?2048:1024);Object.assign(key.shadow.camera,{left:-13,right:13,top:12,bottom:-12,near:1,far:45});key.shadow.normalBias=.035;key.shadow.bias=-.00015;scene.add(key);
 const rim=new T.DirectionalLight(0x77cdff,2.0);rim.position.set(7,8,-7);scene.add(rim);const fill=new T.DirectionalLight(0xd6faff,.95);fill.position.set(6,5,8);scene.add(fill);
 const M={
  navy:new T.MeshStandardMaterial({color:C.navy,metalness:.62,roughness:.3,envMapIntensity:.55}),
  teal:new T.MeshStandardMaterial({color:C.teal,metalness:.28,roughness:.3,envMapIntensity:.7}),
  top:new T.MeshStandardMaterial({color:C.top,metalness:.3,roughness:.24,envMapIntensity:.9}),
  cushion:new T.MeshStandardMaterial({color:C.cushion,metalness:.05,roughness:.43}),
  gold:new T.MeshStandardMaterial({color:C.gold,metalness:.83,roughness:.25,envMapIntensity:1}),
  ivory:new T.MeshStandardMaterial({color:C.ivory,metalness:.18,roughness:.31}),
  dark:new T.MeshStandardMaterial({color:0x0c2330,metalness:.4,roughness:.38}),
  floor:new T.MeshStandardMaterial({color:C.floor,metalness:.3,roughness:.36}),
  floorAlt:new T.MeshStandardMaterial({color:0x527e89,metalness:.32,roughness:.36}),
  glow:new T.MeshStandardMaterial({color:0x93f5ff,emissive:C.cyan,emissiveIntensity:2.6*brightnessLevel,metalness:.15,roughness:.25}),
  warm:new T.MeshStandardMaterial({color:0xf9d991,emissive:0xd99c43,emissiveIntensity:.5,metalness:.45,roughness:.28}),
  glass:new T.MeshStandardMaterial({color:0x59c0d5,metalness:.15,roughness:.18,transparent:true,opacity:.18,side:T.DoubleSide,depthWrite:false}),
  leaf:new T.MeshStandardMaterial({color:0x398e39,roughness:.64}),leafLight:new T.MeshStandardMaterial({color:0x77b951,roughness:.62}),soil:new T.MeshStandardMaterial({color:0x23331d,roughness:1}),
  wood:new T.MeshStandardMaterial({color:0x765231,roughness:.7})
 };
 const geoCache=new Map();
 function round(w,h,d,r=.06){const key=[w,h,d,r].join(':');if(!geoCache.has(key))geoCache.set(key,roundedGeometry(w,h,d,r));return geoCache.get(key);}
 const mesh=(parent,geo,mat,name,pos=[0,0,0],rotation=null)=>{const o=new T.Mesh(geo,mat);o.name=name;o.position.set(...pos);if(rotation)o.rotation.set(...rotation);o.castShadow=!mat.transparent;o.receiveShadow=true;parent.add(o);return o;};
 const box=(p,w,h,d,mat,n,x=0,y=0,z=0,r=.05)=>mesh(p,round(w,h,d,r),mat,n,[x,y,z]);
 const cyl=(p,rt,rb,h,mat,n,x=0,y=0,z=0,seg=24)=>mesh(p,new T.CylinderGeometry(rt,rb,h,seg),mat,n,[x,y,z]);
 const sph=(p,rx,ry,rz,mat,n,x=0,y=0,z=0)=>{const o=mesh(p,new T.SphereGeometry(1,16,12),mat,n,[x,y,z]);o.scale.set(rx,ry,rz);return o;};
 const group=(p,n,x=0,y=0,z=0)=>{const g=new T.Group();g.name=n;g.position.set(x,y,z);p.add(g);return g;};
 const bar=(p,a,b,r,mat,n)=>{const av=new T.Vector3(...a),bv=new T.Vector3(...b),o=mesh(p,new T.CylinderGeometry(r,r,av.distanceTo(bv),10),mat,n,av.clone().add(bv).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(Y,bv.sub(av).normalize());return o;};
 function ring(p,r,t,mat,n,x,y,z,rx=Math.PI/2){return mesh(p,new T.TorusGeometry(r,t,8,40),mat,n,[x,y,z],[rx,0,0]);}
 const textures=[dashboard(7,'IDEA STUDIO'),dashboard(11,'AI COUNCIL'),dashboard(21,'CONTROL SYSTEMS')];
 const screens=textures.map(t=>new T.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xc5eeff,emissiveIntensity:.95,metalness:.15,roughness:.22}));
 function plant(p,x,y,z,s=1,bonsai=false){
  const g=group(p,'LivingPlant',x,y,z);g.scale.setScalar(s);cyl(g,.18,.14,.28,M.gold,'Planter',0,.14,0);cyl(g,.165,.165,.014,M.soil,'Soil',0,.282,0);ring(g,.17,.012,M.warm,'PlanterLip',0,.282,0);
  if(bonsai){bar(g,[0,.25,0],[.05,.68,.02],.035,M.wood,'TreeTrunk');for(let j=0;j<4;j++){const a=j*1.9;bar(g,[.03,.49,0],[Math.cos(a)*.23,.66+j*.035,Math.sin(a)*.17],.013,M.wood,'TreeBranch');for(let k=0;k<9;k++){const q=k*2.399,rr=.10*Math.sqrt(k/9);sph(g,.095,.064,.079,(k+j)%3?M.leaf:M.leafLight,'BonsaiFoliage',Math.cos(a)*.19+Math.cos(q)*rr,.69+j*.045+Math.sin(k*1.9)*.035,Math.sin(a)*.15+Math.sin(q)*rr);}}}
  else{for(let j=0;j<7;j++){const a=j*2.4,o=sph(g,.045,.23+j%3*.03,.021,j%2?M.leaf:M.leafLight,'PlantLeaf',Math.cos(a)*.06,.43,Math.sin(a)*.06);o.rotation.set(Math.cos(a)*.47,a,Math.sin(a)*.52);}}
  return g;
 }
 function monitor(p,x,y,z,scale=1,tex=0){const g=group(p,'Monitor',x,y,z);g.scale.setScalar(scale);box(g,.39,.025,.24,M.gold,'MonitorFoot',0,.015,0,.025);box(g,.045,.23,.045,M.ivory,'MonitorMast',0,.12,-.025,.018);box(g,.98,.58,.062,M.navy,'MonitorHousing',0,.48,-.027,.042);box(g,1.005,.605,.035,M.gold,'MonitorGoldEdge',0,.48,-.038,.045);mesh(g,new T.PlaneGeometry(.905,.505),screens[tex%3],'MonitorDisplay',[0,.48,.008]);box(g,.22,.012,.014,M.glow,'MonitorIndicator',0,.215,.013,.003);return g;}
 function keyboard(p,x,y,z,s=1){const g=group(p,'Keyboard',x,y,z);g.scale.setScalar(s);box(g,.64,.024,.23,M.ivory,'KeyboardBody',0,.012,0,.028);for(let row=0;row<4;row++)for(let col=0;col<12;col++)box(g,.042,.012,.036,row===0&&col<2?M.gold:M.dark,'Key',-.275+col*.05,.03,-.081+row*.052,.005);box(g,.22,.013,.026,M.ivory,'Spacebar',0,.04,.075,.004);sph(p,.047,.025,.068,M.ivory,'Mouse',x+.46*s,y+.025,z);return g;}
 function chair(p,x,z,scale=1,name='Chair'){
  const g=group(p,name,x,0,z);g.scale.setScalar(scale);
  const base=group(g,'RollingBase');cyl(base,.044,.055,.20,M.gold,'GasLift',0,.20,0);cyl(base,.072,.072,.13,M.dark,'HydraulicCover',0,.23,0);
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5,ex=Math.cos(a)*.32,ez=Math.sin(a)*.32;bar(base,[0,.12,0],[ex,.07,ez],.018,M.gold,'ChairSpoke');const wheel=cyl(base,.043,.043,.037,M.dark,'Caster',ex,.048,ez,12);wheel.rotation.z=Math.PI/2;}
  box(g,.55,.07,.52,M.gold,'SeatShell',0,.339,0,.075);box(g,.52,.075,.49,M.cushion,'SeatCushion',0,.3525,0,.075);
  bar(g,[0,.30,.19],[0,.79,.27],.029,M.gold,'BackSupport');
  const back=box(g,.55,.61,.12,M.gold,'BackShell',0,.74,.265,.12);back.rotation.x=-.09;
  const cushion=box(g,.51,.565,.105,M.cushion,'BackCushion',0,.74,.217,.11);cushion.rotation.x=-.09;const rear=box(g,.48,.54,.020,M.teal,'BackRearPanel',0,.74,.334,.095);rear.rotation.x=-.09;
  box(g,.45,.025,.055,M.warm,'BackSeam',0,.744,.158,.01);
  // Keep arms below keyboard and give the leg path an unobstructed front.
  for(const side of [-1,1]){bar(g,[side*.29,.34,.12],[side*.29,.61,.10],.016,M.gold,'ArmUpright');box(g,.075,.045,.30,M.cushion,'ArmRest',side*.29,.63,-.015,.035);}
  g.userData={type:'chair',seatY:CHAIR.seatY,grip:[CHAIR.gripX,CHAIR.gripY,CHAIR.backZ]};return g;
 }
 function desk(p,x,z,{leader=false,id='station',label='STATION',rotation=0}={}){
  const g=group(p,id,x,0,z);g.rotation.y=rotation;const w=leader?3.3:DESK.width,d=leader?1.14:DESK.depth;
  box(g,w,.075,d,M.gold,'DeskGoldRim',0,.78,0,.14);box(g,w-.045,.065,d-.035,M.top,'DeskSurface',0,.817,0,.135);
  box(g,.52,.73,d-.1,M.teal,'DrawerPedestal',-w/2+.31,.375,0,.06);
  for(let j=0;j<3;j++){box(g,.456,.205,.018,M.top,'DrawerFace',-w/2+.31,.18+j*.22,d/2-.033,.02);box(g,.14,.017,.024,M.gold,'DrawerHandle',-w/2+.31,.20+j*.22,d/2-.017,.006);}
  box(g,.075,.76,d-.1,M.gold,'DeskRightLeg',w/2-.09,.38,0,.025);box(g,w-.23,.12,.055,M.navy,'CableTray',0,.67,-d/2+.07,.02);
  if(leader){box(g,w-.56,.60,.065,M.navy,'ExecutiveFront',.20,.44,-d/2+.07,.12);box(g,w-.67,.48,.027,M.gold,'ExecutiveFrontInset',.20,.43,-d/2+.026,.09);box(g,w-.73,.43,.035,M.teal,'ExecutiveFrontPanel',.20,.43,-d/2+.007,.07);}
  monitor(g,.07,.86,-.24,leader?1.08:1,leader?1:STATIONS.findIndex(s=>s.id===id)%3);keyboard(g,.04,.85,.29,leader?1.12:.9);
  plant(g,-w/2+.26,.86,-.26,.56,leader);const mug=cyl(g,.045,.041,.10,M.gold,'PenCup',w/2-.18,.91,-.25,16);for(let j=0;j<4;j++)bar(g,[w/2-.20+j*.012,.94,-.25],[w/2-.205+j*.014,1.09+(j%2)*.02,-.245],.006,j%2?M.gold:M.ivory,'Pen');
  box(g,.18,.012,.26,M.navy,'Notebook',w/2-.22,.859,.20,.016);box(g,.15,.005,.23,M.ivory,'NotebookPaper',w/2-.22,.867,.20,.013);
  if(!leader){
   // Scale the desk structure to TAM19 seated ergonomics; keep monitors and props intact.
   const structural=/^(DeskGoldRim|DeskSurface|DrawerPedestal|DrawerFace|DrawerHandle|DeskRightLeg|CableTray)$/;
   for(const o of [...g.children]){if(structural.test(o.name)){o.position.y*=.84;o.scale.y*=.84;}else{o.position.y-=.136;}}
   box(g,w+.14,1.26,.12,M.gold,'PartitionGold',0,.63,-.64,.13);box(g,w+.07,1.20,.13,M.teal,'PartitionPanel',0,.63,-.63,.11);box(g,w-.16,.025,.018,M.glow,'PartitionLight',0,1.15,-.55,.008);
   for(let i=0;i<6;i++)sph(g,.012,.012,.012,M.glow,'PartitionDiode',w/2-.19-i*.075,1.07,-.55);
   for(const s of [-1,1]){box(g,.075,1.16,1.51,M.gold,'SidePartitionTrim',s*(w/2+.04),.58,.05,.035);box(g,.080,1.09,1.45,M.teal,'SidePartition',s*(w/2+.04),.58,.05,.035);}
  }
  return g;
 }
 function hudWall(p,x,y,z,w,h,ry=0,tex=0){const g=group(p,'GoldFramedHUDWall',x,y,z);g.rotation.y=ry;box(g,w,h,.16,M.gold,'WallGoldFrame',0,0,0,.28);box(g,w-.13,h-.14,.025,M.teal,'WallRearFinish',0,0,-.09,.24);box(g,w-.11,h-.12,.17,M.glow,'WallLightInset',0,0,.015,.24);box(g,w-.17,h-.19,.18,M.teal,'WallInnerFrame',0,0,.025,.21);box(g,w-.27,h-.30,.08,M.navy,'WallPanel',0,0,.10,.17);mesh(g,new T.PlaneGeometry(w-.4,h-.42),screens[tex%3],'HolographicWallDisplay',[0,0,.149]);return g;}
 // Deck: layered, beveled 3D body; individual hexagonal surface tiles.
 box(staticRoot,18.0,.57,14.65,M.navy,'FloatingPlatformHull',0,-.37,0,.72);
 box(staticRoot,18.12,.10,14.75,M.gold,'PlatformGoldUpperBand',0,-.13,0,.72);
 box(staticRoot,17.88,.045,14.51,M.glow,'PlatformCyanSeam',0,-.22,0,.69);
 box(staticRoot,17.63,.10,14.26,M.floor,'DeckFoundation',0,-.055,0,.61);
 const hexGeo=new T.CylinderGeometry(.455,.455,.025,6);hexGeo.rotateY(Math.PI/6);const rand=rng(71);
 for(let row=-9;row<=9;row++)for(let col=-12;col<=12;col++){const x=col*.6975,z=row*.805404+(col%2? .402702:0);if(Math.abs(x)>8.60||Math.abs(z)>6.98)continue;if(Math.abs(x)>8.1&&Math.abs(z)>6.5)continue;mesh(staticRoot,hexGeo,rand()>.82?M.floorAlt:M.floor,'HexFloorTile',[x,.008,z]);}
 for(const side of [-1,1])for(let i=-7;i<=7;i+=2){box(staticRoot,1.25,.20,.07,M.teal,'HullSidePanel',i,-.38,side*7.31,.05);box(staticRoot,.64,.026,.018,M.glow,'HullRunningLight',i,-.35,side*7.36,.008);box(staticRoot,.12,.18,.03,M.gold,'HullLatch',i+.46,-.38,side*7.37,.012);}
 for(const x of [-8.8,8.8])for(let z=-5.5;z<6;z+=2.1){box(staticRoot,.09,.22,1.34,M.teal,'SideHullPanel',x,-.37,z,.04);box(staticRoot,.023,.028,.68,M.glow,'SideHullLight',x*1.004,-.34,z,.006);}
 for(const z of [-2.9,.07,3.0,6.05])box(staticRoot,9.1,.018,.025,M.glow,'WorkstationFloorGuide',-3.4,.039,z,.008);
 box(staticRoot,.025,.02,11.2,M.glow,'CentralAisleGuide',1.3,.04,0,.006);
 box(staticRoot,6.2,.02,.025,M.glow,'PodAisleGuide',4.2,.04,-3.9,.006);
 if(geometryOnly)console.log('GEOMETRY: platform built');
 // Workstation kit.
 const chairs=new Map();
 for(const st of STATIONS){desk(staticRoot,st.x,st.z,{id:st.id,label:st.label});const c=chair(dynamicRoot,st.x,st.z+CHAIR.homeZ,1,'Chair_'+st.id);chairs.set(st.id,c);}
 // Raised manager's office with two real walls and steps.
 box(staticRoot,5.75,.30,3.85,M.gold,'ExecutivePodium',-4.8,.14,-4.9,.34);box(staticRoot,5.62,.08,3.72,M.navy,'ExecutivePodiumSurface',-4.8,.32,-4.9,.30);box(staticRoot,5.69,.024,3.79,M.glow,'ExecutivePodiumLight',-4.8,.265,-4.9,.31);
 const exec=group(staticRoot,'ExecutiveOffice',0,.37,0);hudWall(exec,-4.8,1.64,-6.74,5.65,3.16,0,1);hudWall(exec,-7.53,1.64,-5.05,3.39,3.16,Math.PI/2,0);
 const executiveDesk=desk(exec,-4.7,-4.75,{leader:true,id:'ExecutiveDesk',rotation:Math.PI});const executiveChair=chair(exec,-4.7,-5.82,1.23,'ExecutiveChair');executiveChair.rotation.y=Math.PI;
 box(exec,5.1,.48,.54,M.teal,'ExecutiveLowCabinet',-4.74,.25,-6.35,.08);box(exec,5.1,.035,.56,M.gold,'CabinetTop',-4.74,.505,-6.35,.05);
 plant(exec,-6.8,.52,-6.33,1.1,true);plant(exec,-2.63,.52,-6.35,.75,true);box(exec,.50,.22,.34,M.ivory,'OfficePrinter',-5.83,.63,-6.32,.04);box(exec,.38,.035,.37,M.dark,'PrinterSlot',-5.83,.61,-6.29,.01);
 for(let j=0;j<3;j++){box(staticRoot,2.65,.08, .27,M.teal,'ExecutiveStep',-3.1,.04+j*.10,-2.74-j*.23,.06);box(staticRoot,2.63,.018,.024,M.gold,'StepNosing',-3.1,.085+j*.10,-2.59-j*.23,.007);}
 // Charging pods: actual glass shells, caps, frames and lit floors.
 for(let i=0;i<4;i++){
  const g=group(staticRoot,'ChargePod_'+i,1.15+i*1.38,0,-5.5);
  cyl(g,.57,.57,.14,M.gold,'PodBase',0,.09,0);cyl(g,.53,.51,.22,M.ivory,'PodLowerShell',0,.24,0);cyl(g,.44,.44,.025,M.glow,'PodFloorLight',0,.362,0);
  mesh(g,new T.CylinderGeometry(.49,.49,1.73,32,1,true,.45,Math.PI*2-.9),M.glass,'CyanGlassShell',[0,1.24,0]);
  for(const a of [-.85,.85,Math.PI]){const x=Math.sin(a)*.47,z=Math.cos(a)*.47;box(g,.075,1.83,.075,M.ivory,'PodVerticalFrame',x,1.24,z,.035);box(g,.019,1.38,.024,M.glow,'PodVerticalLight',x,1.25,z+.046,.006);}
  sph(g,.56,.18,.56,M.ivory,'PodDome',0,2.17,0);ring(g,.50,.024,M.gold,'PodUpperRim',0,2.11,0);ring(g,.22,.023,M.glow,'PodCrownLight',0,2.35,0);cyl(g,.17,.17,.022,M.teal,'PodCrown',0,2.35,0);
 }
 // Energy chamber for robots only; stylized, nonfunctional visual prop.
 const energy=group(staticRoot,'RobotEnergyChamber',7,0,-4.7);box(energy,1.86,.20,1.79,M.gold,'EnergyPlinth',0,.10,0,.28);box(energy,1.65,.13,1.59,M.ivory,'EnergyPlatform',0,.25,0,.25);
 function frameGeometry(w,h,depth,thickness,r){const shape=rectShape(w,h,r),hole=rectShape(w-2*thickness,h-2*thickness,Math.max(.03,r-thickness));shape.holes.push(hole);const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:3,bevelThickness:.012,bevelSize:.012,curveSegments:10,steps:1});g.translate(0,0,-depth/2);return g;}
 for(const z of [-.72,.72]){mesh(energy,frameGeometry(1.70,2.67,.13,.115,.32),M.gold,'EnergyFrame',[0,1.65,z]);mesh(energy,frameGeometry(1.48,2.45,.035,.026,.20),M.glow,'EnergyFrameLight',[0,1.65,z+.08]);mesh(energy,new T.PlaneGeometry(1.42,2.37),M.glass,'EnergyWindow',[0,1.65,z]);}
 for(const x of [-.76,.76])box(energy,.13,2.49,1.43,M.glass,'EnergySideGlass',x,1.65,0,.07);
 cyl(energy,.55,.55,.07,M.glow,'EnergyEmitterLower',0,.39,0);cyl(energy,.52,.52,.07,M.glow,'EnergyEmitterUpper',0,2.86,0);
 // Lightning is line geometry, not a screen texture.
 const lightning=group(dynamicRoot,'EnergyArcs',7,0,-4.7);
 for(let j=0;j<5;j++){const points=[];for(let k=0;k<14;k++)points.push(new T.Vector3(Math.sin(k*2.1+j)*.30,.5+k*.17,Math.cos(k*1.7+j)*.27));const curve=new T.CatmullRomCurve3(points);mesh(lightning,new T.TubeGeometry(curve,60,.009,5,false),M.glow,'EnergyArc_'+j);}
 const terminal=group(staticRoot,'EnergyTerminal',8.05,0,-3.72);box(terminal,.61,.85,.53,M.teal,'TerminalHousing',0,.43,0,.07);const term=monitor(terminal,0,.84,0,.55,2);term.rotation.x=-.12;box(staticRoot,.61,.56,.62,M.navy,'ServiceCase',7.35,.30,-3.32,.06);box(staticRoot,.08,.58,.65,M.gold,'ServiceCaseBand',7.35,.30,-3.32,.02);
 // Control nook, offset from workstation circulation.
 const control=group(staticRoot,'ControlNook',5.35,0,-.05);hudWall(control,0,1.60,-1.43,4.50,2.48,0,2);hudWall(control,2.17,1.60,-.1,2.74,2.48,-Math.PI/2,1);
 box(control,3.04,.08,1.42,M.gold,'ControlDeskRim',-.1,.79,.3,.20);box(control,2.98,.065,1.36,M.top,'ControlDeskTop',-.1,.835,.3,.18);
 for(const x of [-1.37,1.16])box(control,.19,.75,1.19,M.teal,'ControlDeskPedestal',x,.39,.3,.07);
 cyl(control,.48,.48,.07,M.gold,'HologramBase',-.05,.90,.28);cyl(control,.43,.43,.04,M.glow,'HologramLens',-.05,.96,.28);
 const holo=group(dynamicRoot,'ControlHologram',5.30,1.12,.23);ring(holo,.36,.009,M.glow,'HologramOrbit1',0,0,0);ring(holo,.26,.008,M.glow,'HologramOrbit2',0,.06,0,.20);sph(holo,.22,.22,.22,M.glass,'HologramGlobe',0,.15,0);ring(holo,.22,.008,M.glow,'HologramMeridian',0,.15,0,0);ring(holo,.22,.008,M.glow,'HologramEquator',0,.15,0);
 keyboard(control,-.85,.88,.68,.60);plant(control,1.03,.88,.05,.62);chair(staticRoot,4.55,1.53,1.05,'ControlChair');plant(staticRoot,7.63,0,1.53,1.5);
 // Lounge: sculpted furniture, glass divider and illuminated arch.
 const lounge=group(staticRoot,'Lounge',4.56,0,4.8);
 box(lounge,5.8,.055,3.8,M.teal,'LoungeInsetDeck',0,.02,0,.22);
 function sofa(p,x,z,w,ry){const g=group(p,'LoungeSofa',x,0,z);g.rotation.y=ry;box(g,w,.20,.92,M.gold,'SofaBase',0,.17,0,.20);box(g,w-.04,.33,.91,M.teal,'SofaBody',0,.35,0,.19);box(g,w,.70,.25,M.teal,'SofaBack',0,.66,-.37,.18);for(let j=0;j<3;j++)box(g,(w-.35)/3-.02,.22,.64,M.cushion,'SofaSeat',-w/2+.20+(j+.5)*(w-.40)/3,.58,.08,.08);for(const s of [-1,1])box(g,.22,.41,.87,M.cushion,'SofaArm',s*(w/2-.11),.59,0,.10);return g;}
 sofa(lounge,-.65,-1.15,2.30,0);sofa(lounge,1.70,.58,1.85,-Math.PI/2);
 const coffee=group(lounge,'CoffeeTable',.02,0,.55);const top=cyl(coffee,.68,.68,.07,M.top,'CoffeeSurface',0,.47,0,48);top.scale.z=.70;const rimc=cyl(coffee,.70,.70,.035,M.gold,'CoffeeGoldEdge',0,.43,0,48);rimc.scale.z=.70;for(const x of [-.4,.4])bar(coffee,[x,.08,-.2],[x,.42,.15],.035,M.gold,'CoffeeLeg');
 plant(lounge,-2.37,0,-1.43,1.32);plant(lounge,2.60,0,1.42,1.15,true);
 // Open real arch, so the scene is not a solid wall hiding the lounge.
 const arch=group(staticRoot,'LoungeArch',2.10,0,4.65);const points=[];const ww=3.16,hh=2.65,rr=.55;
 points.push(new T.Vector3(-ww/2,0,0),new T.Vector3(-ww/2,hh-rr,0));
 for(let i=0;i<=10;i++){const a=Math.PI-i/10*Math.PI/2;points.push(new T.Vector3(-ww/2+rr+Math.cos(a)*rr,hh-rr+Math.sin(a)*rr,0));}
 points.push(new T.Vector3(ww/2-rr,hh,0));for(let i=0;i<=10;i++){const a=Math.PI/2-i/10*Math.PI/2;points.push(new T.Vector3(ww/2-rr+Math.cos(a)*rr,hh-rr+Math.sin(a)*rr,0));}points.push(new T.Vector3(ww/2,0,0));
 arch.rotation.y=Math.PI/2;const archcurve=new T.CatmullRomCurve3(points,false,'centripetal');mesh(arch,new T.TubeGeometry(archcurve,72,.105,10,false),M.gold,'LoungeArchFrame');const glPoints=points.map(p=>new T.Vector3(p.x*.96,p.y*.98,.08));mesh(arch,new T.TubeGeometry(new T.CatmullRomCurve3(glPoints),72,.023,8,false),M.glow,'LoungeArchGlow');box(arch,2.86,2.45,.022,M.glass,'LoungeGlassDivider',0,1.23,0,.28);
 for(const [x,z,s] of [[-8.0,5.9,1.3],[-8.0,-2.1,1.3],[1.72,2.3,1.4],[1.72,-2.35,1.2],[7.9,6.0,1.25],[-1.1,-6.6,.9]])plant(staticRoot,x,0,z,s,true);
 // Make one geometric contact-light plane under each chair, not a painted chair.
 const shadowTex=glowTexture();
 for(const st of STATIONS){const mat=new T.MeshBasicMaterial({map:shadowTex,transparent:true,opacity:.20,depthWrite:false});mesh(staticRoot,new T.PlaneGeometry(1.50,1.50),mat,'SubtleFloorBounce',[st.x,.033,st.z+1.02],[-Math.PI/2,0,0]);}
 if(geometryOnly)console.log('GEOMETRY: objects built');
 // Batch architecture by material. The dynamic chairs/robot remain separate objects.
 staticRoot.updateWorldMatrix(true,true);const batches=new Map(),remove=[];
 staticRoot.traverse(o=>{if(!o.isMesh||Array.isArray(o.material))return;let geometry=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geometry.applyMatrix4(o.matrixWorld);for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);if(!geometry.attributes.uv)geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));const list=batches.get(o.material)||[];list.push(geometry);batches.set(o.material,list);remove.push(o);});
 for(const o of remove)o.removeFromParent();
 for(const [mat,geos] of batches){const merged=mergeGeometries(geos,false);if(merged){const o=mesh(staticRoot,merged,mat,'Batched_'+(mat.name||mat.uuid.slice(0,8)));o.castShadow=!mat.transparent;}for(const g of geos)g.dispose();}
 if(geometryOnly)console.log('GEOMETRY: batching finished');
 // Load the actual supplied TAM19 model; remove its embedded demo workstation.
 let robot,robotRig=null,robotError=null,robotTemplate=null;
 try{
  const gltf=modelBuffer?await new GLTFLoader().parseAsync(modelBuffer,''):await new GLTFLoader().loadAsync('/assets/tam19.glb');
  robot=gltf.scene;robot.name='TAM19_Articulated';robot.getObjectByName('Workstation')?.removeFromParent();robot.getObjectByName('Tablet_mount')?.removeFromParent();
  robot.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}});
  robotTemplate=cloneRig(robot);dynamicRoot.add(robot);robotRig=prepareRig(robot);
 }catch(err){robotError=String(err?.message||err);onError('Model TAM19: '+robotError);}
 if(geometryOnly)console.log('GEOMETRY: robot loaded');
 const station=STATIONS.find(s=>s.id==='pm'),activeChair=chairs.get('pm');
 const fleetScene=createFleetScene({parent:dynamicRoot,template:robotTemplate,prepareRig,poseRobot});
 const composer=!geometryOnly&&quality==='high'?new EffectComposer(renderer):null;
 let bloomPass=null;
 if(composer){composer.addPass(new RenderPass(scene,camera));bloomPass=new UnrealBloomPass(new T.Vector2(960,540),.20*brightnessLevel,.45,1.15);composer.addPass(bloomPass);composer.addPass(new OutputPass());}
 let lastMetrics={};
 function setCamera(mode='hero'){
  view=mode;
  if(mode==='close'){target.set(station.x,.86,station.z+1.12);eye.set(station.x-1.42,2.85,station.z+3.82);viewHeight=2.95;}
  else if(mode==='side'){target.set(station.x,.74,station.z+1.02);eye.set(station.x+1.60,1.65,station.z+2.76);viewHeight=2.50;}
  else if(mode==='overview'){target.set(0,.2,0);eye.set(-19,21,23);viewHeight=16.4;}
  else {target.set(...HERO.target);eye.set(...HERO.position);viewHeight=HERO.height;}
  orbitAz=Math.atan2(eye.x-target.x,eye.z-target.z);orbitEl=Math.asin((eye.y-target.y)/eye.distanceTo(target));updateCamera();return mode;
 }
 function updateCamera(){const rect=host.getBoundingClientRect(),w=Math.max(2,rect.width),h=Math.max(2,rect.height),aspect=w/h;camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.position.copy(eye);camera.lookAt(target);camera.updateProjectionMatrix();}
 function resize(){if(disposed)return;const {width,height}=host.getBoundingClientRect();renderer.setSize(Math.max(2,width),Math.max(2,height),false);composer?.setSize(Math.max(2,width),Math.max(2,height));updateCamera();draw(time);}
 function draw(t=time){
  if(disposed)return;time=clamp(Number.isFinite(t)?t:0,0,DURATION);const m=motionAt(time);
  const isLive=displayMode==='live';if(robot)robot.visible=!isLive;fleetScene.root.visible=isLive;
  for(const st of STATIONS)chairs.get(st.id).position.z=st.z+CHAIR.homeZ;
  let actors=[],phase=m.phase,effectTime=time;
  if(isLive){
   actors=liveController.view();const metrics=fleetScene.update(actors);
   for(const a of actors)if(a.seatId&&['seated','entering','exiting'].includes(a.phase))chairs.get(a.seatId).position.z=a.station.z+a.motion.chairZ;
   lastMetrics={robots:metrics};phase='live';effectTime=liveController.clock();
  }else{
   activeChair.position.z=station.z+m.chairZ;if(robotRig)lastMetrics=poseRobot(robotRig,m,station);
  }
  lightning.rotation.y=Math.sin(effectTime*.75)*.07;lightning.children.forEach((o,i)=>o.visible=manual?true:Math.sin(effectTime*12+i*1.3)>.05);
  holo.rotation.y=effectTime*.32;
  if(composer)composer.render();else renderer.render(scene,camera);
  onFrame({time,phase,metrics:lastMetrics,mode:displayMode,actors});return {...m,metrics:lastMetrics};
 }
 function tick(now){if(disposed)return;const dt=last?Math.min(.08,(now-last)/1000):0;last=now;if(active&&!document.hidden){if(displayMode==='live')liveController.step(dt);else if(playing){time=Math.min(DURATION,time+dt);if(time>=DURATION)playing=false;}draw(time);}frame=requestAnimationFrame(tick);}
 const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
 const onDown=e=>{if(e.button!==0)return;drag={x:e.clientX,y:e.clientY,az:orbitAz,el:orbitEl,dist:eye.distanceTo(target)};renderer.domElement.setPointerCapture?.(e.pointerId);};
 const onMove=e=>{if(!drag)return;orbitAz=drag.az-(e.clientX-drag.x)*.006;orbitEl=clamp(drag.el+(e.clientY-drag.y)*.006,.12,1.38);const r=drag.dist;eye.set(target.x+r*Math.cos(orbitEl)*Math.sin(orbitAz),target.y+r*Math.sin(orbitEl),target.z+r*Math.cos(orbitEl)*Math.cos(orbitAz));updateCamera();draw(time);};
 const onUp=e=>{const click=drag&&e&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5;drag=null;if(click&&displayMode==='live'){const rect=renderer.domElement.getBoundingClientRect(),id=fleetScene.pick(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);if(id)onSelect(id);}};const onWheel=e=>{e.preventDefault();viewHeight=clamp(viewHeight*Math.exp(e.deltaY*.001),1.7,35);updateCamera();draw(time);};
 const onLost=e=>{e.preventDefault();playing=false;active=false;liveController.setPaused(true);onError('WebGL context lost. Reload this 3D view to restore it.');};
 renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointermove',onMove);renderer.domElement.addEventListener('pointerup',onUp);renderer.domElement.addEventListener('pointercancel',onUp);renderer.domElement.addEventListener('wheel',onWheel,{passive:false});renderer.domElement.addEventListener('webglcontextlost',onLost);
 setCamera('hero');resize();if(!manual&&!geometryOnly)frame=requestAnimationFrame(tick);
 return {
  revision:REVISION,scene,modelRoot,renderer,camera,chairs,robot,robotError,geometryOnly,
  exportGeometry(){scene.updateMatrixWorld(true);return geometrySnapshot(scene,modelRoot,camera);},
  exportPose(){scene.updateMatrixWorld(true);const nodes=[];dynamicRoot.traverse(o=>{if(o.isMesh)nodes.push({id:o.uuid,matrix:o.matrixWorld.toArray(),visible:hierarchyVisible(o)});});return {time,metrics:{...lastMetrics},nodes,camera:{position:camera.position.toArray(),target:target.toArray(),height:viewHeight}};},
  setTime(t){return draw(t);},getTime:()=>time,getMetrics:()=>({...lastMetrics}),setCamera,
  setFleetSnapshot(snapshot){liveController.update(snapshot);return draw(time);},
  markFleetStale({clear=false}={}){if(clear)liveController.clear();liveController.markStale();draw(time);},
  setDisplayMode(mode){displayMode=mode==='live'?'live':'demo';playing=false;last=0;draw(time);return displayMode;},
  getDisplayMode:()=>displayMode,getFleet:()=>liveController.view(),fleetStats:()=>liveController.stats(),
  stepLive(seconds){for(let left=clamp(Number(seconds)||0,0,300);left>.000001;left-=.05)liveController.step(Math.min(.05,left));draw(time);return liveController.view();},
  setMotionPaused(value){liveController.setPaused(value);draw(time);},isMotionPaused:()=>liveController.isPaused(),
  setBrightness(value){brightnessLevel=clamp(Number.isFinite(Number(value))?Number(value):.85,.60,1.05);renderer.toneMappingExposure=1.17*brightnessLevel;M.glow.emissiveIntensity=2.6*brightnessLevel;if(bloomPass)bloomPass.strength=.20*brightnessLevel;draw(time);return brightnessLevel;},
  getBrightness:()=>brightnessLevel,
  labelPositions(){const rect=host.getBoundingClientRect();return fleetScene.labels(camera,rect.width,rect.height);},
  selectRobot(id){fleetScene.setSelected(id);draw(time);},
  focusRobot(id){const a=liveController.view().find(a=>a.id===id);if(!a)return false;view='robot';target.set(a.position.x,.78,a.position.z);eye.set(a.position.x+2.4,2.7,a.position.z+3.4);viewHeight=3.3;orbitAz=Math.atan2(eye.x-target.x,eye.z-target.z);orbitEl=Math.asin((eye.y-target.y)/eye.distanceTo(target));updateCamera();draw(time);return true;},

  play(){if(time>=DURATION)time=0;playing=true;last=0;},pause(){playing=false;},isPlaying:()=>playing,
  setActive(value){active=Boolean(value);last=0;},resize,
  screenshot(){draw(time);return renderer.domElement.toDataURL('image/png');},
  stats(){return {revision:REVISION,geometryOnly,geometricWorkstations:STATIONS.length,geometricChairs:chairs.size,robotLoaded:!!robotRig,liveRobots:fleetScene.size(),displayMode,brightness:brightnessLevel,view,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,metrics:{...lastMetrics}};},
  dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);resizeObserver.disconnect();fleetScene.dispose();liveController.clear();const el=renderer.domElement;for(const [n,fn] of [['pointerdown',onDown],['pointermove',onMove],['pointerup',onUp],['pointercancel',onUp],['wheel',onWheel],['webglcontextlost',onLost]])el.removeEventListener(n,fn);const seen=new Set();scene.traverse(o=>{if(o.geometry&&!seen.has(o.geometry)){seen.add(o.geometry);o.geometry.dispose();}for(const mat of (Array.isArray(o.material)?o.material:[o.material]))if(mat&&!seen.has(mat)){seen.add(mat);for(const t of Object.values(mat))if(t?.isTexture&&!seen.has(t)){seen.add(t);t.dispose();}mat.dispose();}});scene.background?.dispose?.();envTarget?.dispose();for(const g of geoCache.values())g.dispose();composer?.passes.forEach(p=>p.dispose?.());composer?.dispose();renderer.dispose();el.remove();}
 };
}

function prepareRig(root){
 const names=['Body','Hip_L','Hip_R','Knee_L','Knee_R','Ankle_L','Ankle_R','Shoulder_L','Shoulder_R','Elbow_L','Elbow_R','Wrist_L','Wrist_R','Head_Rig'];
 const bones=Object.fromEntries(names.map(n=>[n,root.getObjectByName(n)]));if(names.some(n=>!bones[n]))throw new Error('Incomplete TAM19 articulated rig.');
 const body=bones.Body;
 // Rigid apron previously passed through the thighs when sitting. Add a real hinge.
 const apron=new T.Group();apron.name='ArticulatedApronPivot';apron.position.set(0,.765,0);body.add(apron);root.updateMatrixWorld(true);
 const apronNames=['Phu Quoc fitted marine apron','Apron continuous gold piping -1','Apron continuous gold piping 1','P16 main wave gold edge','P16 curling wave','P16 porcelain sea foam','P16 lower ocean current','Ocean tunic hem inlay','Single breaking-wave crest'];
 for(const n of apronNames){const o=root.getObjectByName(n);if(o)apron.attach(o);}
 return {root,bones,apron,basePos:body.position.clone(),rest:new Map(names.map(n=>[n,bones[n].quaternion.clone()])),scale:1.022};
}
function pointWorld(node){return node.getWorldPosition(new T.Vector3());}
function setWorldDirection(node,direction){const world=new T.Quaternion().setFromUnitVectors(DOWN,direction.clone().normalize());const parentQ=node.parent.getWorldQuaternion(new T.Quaternion());node.quaternion.copy(parentQ.invert().multiply(world));node.updateWorldMatrix(false,true);}
function setWorldQuaternion(node,q){const p=node.parent.getWorldQuaternion(new T.Quaternion());node.quaternion.copy(p.invert().multiply(q));node.updateWorldMatrix(false,true);}
function solveLimb(a,b,end,target,pole){
 const start=pointWorld(a),mid=pointWorld(b),tip=pointWorld(end),L1=start.distanceTo(mid),L2=mid.distanceTo(tip);
 const solution=twoBone(start.toArray(),target.toArray(),L1,L2,pole.toArray());const joint=new T.Vector3(...solution.joint),tipSolved=new T.Vector3(...solution.end);
 setWorldDirection(a,joint.sub(start));setWorldDirection(b,tipSolved.sub(pointWorld(b)));return solution.residual;
}
function poseRobot(r,m,station){
 const animationTime=m.animationTime??m.time;
 const {root,bones:b,rest,scale,apron}=r;for(const [n,q] of rest)b[n].quaternion.copy(q);b.Body.position.copy(r.basePos);
 root.position.set(station.x+m.x,0,station.z+m.z);root.rotation.set(0,m.yaw,0);
 b.Body.position.y=(m.robotPelvisY-.692916)/scale;
 apron.rotation.x=-1.15*m.seated;
 b.Head_Rig.rotation.x=.03*m.seated+Math.sin(animationTime*1.3)*.015;
 root.updateMatrixWorld(true);
 const forward=new T.Vector3(Math.sin(m.yaw),0,Math.cos(m.yaw)),right=new T.Vector3(Math.cos(m.yaw),0,-Math.sin(m.yaw));
 const base=new T.Vector3(station.x+m.x,0,station.z+m.z),footTargets={},residuals=[];
 for(const [side,sign] of [['L',-1],['R',1]]){
  let foot=base.clone().addScaledVector(right,sign*.108*scale);foot.y=CHAIR.footY;
  // On the sit/stand transitions, feet stay on the floor while the pelvis travels.
  if(m.seated>0){const seatedZ=m.chairZ-.39,standingZ=1.19;foot.x=station.x-sign*.108*scale;foot.z=station.z+(m.time<12.1||m.time>21?standingZ:seatedZ);}
  let footYaw=m.yaw;if(m.walking&&m.seated<.01){const f=m.footTargets?.[side]||gaitFootAt(m.time,side);foot.set(station.x+f.x,f.y,station.z+f.z);footYaw=f.yaw;}
  const pole=forward.clone().multiplyScalar(1.0).add(new T.Vector3(0,.15,0));
  residuals.push(solveLimb(b['Hip_'+side],b['Knee_'+side],b['Ankle_'+side],foot,pole));
  setWorldQuaternion(b['Ankle_'+side],new T.Quaternion().setFromAxisAngle(Y,footYaw));footTargets[side]=foot;
 }
 // Hand targets: grip contact is an actual chair-space point, not image pixels.
 const grip=new T.Vector3(station.x+CHAIR.gripX,CHAIR.gripY,station.z+m.chairZ+CHAIR.backZ);
 const leftWrist=b.Wrist_L,rightWrist=b.Wrist_R;
 const gripWrist=grip.clone().add(new T.Vector3(0,.067*scale,0));
 let handResidual=0;
 if(m.contact>0){const neutral=pointWorld(leftWrist),target=neutral.lerp(gripWrist,m.contact);handResidual=solveLimb(b.Shoulder_L,b.Elbow_L,leftWrist,target,new T.Vector3(.2,-.8,.5));setWorldQuaternion(leftWrist,new T.Quaternion());}
 if(m.typing>0){
  for(const [side,sign] of [['L',1],['R',-1]]){
   const wrist=b['Wrist_'+side],target=new T.Vector3(station.x+sign*.135,DESK.keyboardY+.050+Math.sin(animationTime*12+sign)*.004,station.z+DESK.keyboardZ+.16);
   const neutral=pointWorld(wrist);neutral.lerp(target,m.typing);residuals.push(solveLimb(b['Shoulder_'+side],b['Elbow_'+side],wrist,neutral,new T.Vector3(sign*.45,-1,.3)));
   setWorldQuaternion(wrist,new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2));
  }
 }else if(m.seated>0){for(const side of ['L','R']){if(side==='L'&&m.contact>0)continue;b['Shoulder_'+side].rotation.x=-.22*m.seated;b['Elbow_'+side].rotation.x=-.4*m.seated;}}
 root.updateMatrixWorld(true);
 const actualGrip=pointWorld(leftWrist).add(new T.Vector3(0,-.067*scale,0));
 const pelvicBottom=(.65*scale)+b.Body.position.y*scale;
 return {phase:m.phase,handContactError:m.contact>.999?actualGrip.distanceTo(grip):null,handReachResidual:handResidual,maxLimbResidual:Math.max(...residuals),pelvisSeatGap:m.seatContact?pelvicBottom-CHAIR.seatY:null,seatContact:m.seatContact,chairZ:m.chairZ,footHeightL:pointWorld(b.Ankle_L).y-CHAIR.footY,footHeightR:pointWorld(b.Ankle_R).y-CHAIR.footY};
}

/** No rendering occurs in this adapter. Only CPU geometry/pose evaluation. */
function geometryExportAdapter(){
 const canvas=document.createElement('canvas');return {geometryOnly:true,domElement:canvas,shadowMap:{},info:{render:{calls:0,triangles:0}},setPixelRatio(){},setSize(w,h){canvas.width=w;canvas.height=h;},render(){},dispose(){}};
}
function hierarchyVisible(object){for(let node=object;node;node=node.parent)if(!node.visible)return false;return true;}
function geometrySnapshot(scene,root,camera){
 const geos={},mats={},tex={},nodes=[];
 const pack=a=>{let out='';const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(let i=0;i<bytes.length;i+=16384)out+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(out);};
 const texture=t=>{if(!t)return null;if(!tex[t.uuid]){const image=t.image;if(image?.toDataURL)tex[t.uuid]={png:image.toDataURL('image/png'),flipY:t.flipY};}return tex[t.uuid]?t.uuid:null;};
 const material=m=>{if(!m)return null;if(!mats[m.uuid])mats[m.uuid]={name:m.name||m.uuid,color:m.color?.toArray()||[1,1,1],emissive:m.emissive?.toArray()||[0,0,0],emissiveIntensity:m.emissiveIntensity||0,metalness:m.metalness||0,roughness:m.roughness??.5,opacity:m.opacity??1,transparent:!!m.transparent,doubleSided:m.side===T.DoubleSide,unlit:!!m.isMeshBasicMaterial,map:texture(m.map),emissiveMap:texture(m.emissiveMap)};return m.uuid;};
 root.traverse(o=>{if(!o.isMesh||!hierarchyVisible(o))return;const g=o.geometry;if(!geos[g.uuid]){const data={attributes:{},index:null};for(const name of ['position','normal','uv'])if(g.attributes[name]){const a=g.attributes[name];data.attributes[name]={itemSize:a.itemSize,type:a.array.constructor.name,base64:pack(a.array)};}if(g.index)data.index={type:g.index.array.constructor.name,base64:pack(g.index.array)};geos[g.uuid]=data;}nodes.push({id:o.uuid,name:o.name,geometry:g.uuid,material:material(Array.isArray(o.material)?o.material[0]:o.material),matrix:o.matrixWorld.toArray()});});
 return {format:'space-studio-geometry-v1',revision:REVISION,units:'metres',axis:'Y_UP',geometries:geos,materials:mats,textures:tex,nodes,background:texture(scene.background),camera:{position:camera.position.toArray(),up:camera.up.toArray(),height:camera.top*2},note:'Geometry and transforms evaluated from app source. Not a WebGL render.'};
}
