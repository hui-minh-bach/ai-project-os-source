/**
 * Idea Studio / B2 office chair interactive preview.
 * Native WebGL GLB in a transparent canvas over the ORIGINAL illustration.
 * A dedicated chair sprite is cut from the illustration and moves with the bot.
 * Explicitly a user-triggered DEMO, independent from real AI fleet state.
 * Import dynamically; do not start a GPU loop until the user clicks Preview.
 */
import {officeChairAt,OFFICE_CHAIR_CANVAS as D,officeMakeTam19ChairClips} from '/office-chair-choreography.mjs';
import {officeMakeTam19SeatClips} from '/office-motion.mjs';

const addStyle=(element,styles)=>Object.assign(element.style,styles);
const pct=(p,d)=>`${(p/d*100).toFixed(5)}%`;

/** Resolves only after the WebGL model is loadable. Failure leaves 2D unmodified. */
export async function mountOfficeChairPreview(room,{onDone}={}){
 if(!room||!room.classList.contains('office-iso')||room.classList.contains('office-3d-on')){
  throw new Error('Mở chế độ isometric trước khi xem robot kéo ghế.');
 }
 const [THREE,{GLTFLoader}]=await Promise.all([
  import('/vendor/three.module.min.js'),import('/vendor/addons/GLTFLoader.js')
 ]);
 // Load all necessary 3D data before mutating the room/background.
 const loader=new GLTFLoader();
 const gltf=await loader.loadAsync('/assets/tam19.glb');
 const seat=officeMakeTam19SeatClips(THREE,gltf.scene);
 const reaching=officeMakeTam19ChairClips(THREE,gltf.scene);
 if(!seat||!reaching)throw new Error('Model TAM19 không có đủ xương để ngồi và kéo ghế.');
 // A user can switch tabs/modes while the network loads GLB: never mount a stale preview.
 const hostPage=room.closest('.page');
 if(!room.isConnected||!room.classList.contains('office-iso')||room.classList.contains('office-3d-on')||(hostPage&&!hostPage.classList.contains('active')))throw new Error('Đã đổi trang hoặc chế độ phòng trong lúc nạp robot.');
 const animations=[...gltf.animations,...Object.values(seat),...Object.values(reaching)];
 const clips=new Map(animations.map(c=>[c.name,c]));
 for(const key of ['Idle','Walk','Sit_Down','Seated_Idle','Seated_Work','Stand_Up','Reach_Chair','Pull_Chair','Lower_Arms','Push_Chair']){
  if(!clips.has(key))throw new Error(`Model thiếu animation ${key}`);
 }
 let renderer;
 try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,premultipliedAlpha:false});}
 catch(e){throw new Error(`Không tạo được WebGL canvas: ${e.message||e}`);}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.setSize(240,356,false);
 renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.2;
 const scene=new THREE.Scene();
 scene.add(new THREE.HemisphereLight(0xe6f4ff,0x37506a,1.5));
 const key=new THREE.DirectionalLight(0xffffff,2.1);key.position.set(5,10,9);scene.add(key);
 const fill=new THREE.DirectionalLight(0x65d5ff,.7);fill.position.set(-6,4,0);scene.add(fill);
 const root=new THREE.Group();root.add(gltf.scene);scene.add(root);
 const camera=new THREE.OrthographicCamera(-0.95,0.95,1.38,-1.38,.1,40);
 camera.position.set(4.4,3.2,6.8);camera.lookAt(0,1.13,0);
 const mixer=new THREE.AnimationMixer(gltf.scene);
 const actions=new Map(animations.map(c=>[c.name,mixer.clipAction(c)]));

 const layer=document.createElement('div');layer.className='office-chair-demo-layer';layer.setAttribute('aria-label','Minh họa robot kéo ghế bằng mô hình 3D');
 const shadow=document.createElement('div');shadow.className='office-chair-demo-shadow';layer.appendChild(shadow);
 const chair=document.createElement('img');chair.className='office-chair-demo-chair';chair.alt='';chair.src='/assets/chair-demo/chair-original-cutout.png';layer.appendChild(chair);
 const bot=document.createElement('div');bot.className='office-chair-demo-avatar';bot.appendChild(renderer.domElement);layer.appendChild(bot);
 // Exact PM desk-front cut from the same illustration. Overlay ABOVE robot legs.
 const desk=document.createElement('img');desk.className='office-chair-demo-foreground';desk.alt='';desk.src='/assets/office-iso-fg/desk-pm.png';
 addStyle(desk,{left:'32.6%',top:'62.2%',width:'10.1%',height:'8.3%'});layer.appendChild(desk);
 const badge=document.createElement('span');badge.className='office-chair-demo-label';badge.textContent='THỬ CHUYỂN ĐỘNG • KHÔNG PHẢI TÁC VỤ AI';layer.appendChild(badge);
 addStyle(chair,{width:pct(D.chairWidth,D.width),height:pct(D.chairHeight,D.height)});
 addStyle(bot,{width:pct(120,D.width),height:pct(178,D.height)});
 let live=true,frame=0,lastClip=null,start=performance.now();

 const complete=()=>{if(!live)return;live=false;cancelAnimationFrame(frame);
  if(layer.parentNode)layer.remove();room.classList.remove('office-chair-demo-active');
  try{mixer.stopAllAction();mixer.uncacheRoot(gltf.scene);}catch{}
  scene.remove(root);
  // Release dedicated GLB GPU buffers and textures; no shared model is mutated.
  const disposed=new Set();
  gltf.scene.traverse(obj=>{
   if(obj.geometry&&!disposed.has(obj.geometry)){disposed.add(obj.geometry);obj.geometry.dispose?.();}
   const mats=Array.isArray(obj.material)?obj.material:[obj.material];
   for(const mat of mats){
    if(!mat||disposed.has(mat))continue;disposed.add(mat);
    for(const v of Object.values(mat))if(v?.isTexture&&!disposed.has(v)){disposed.add(v);v.dispose?.();}
    mat.dispose?.();
   }
  });
  renderer.dispose();
  try{onDone?.();}catch(e){console.warn('chair preview onDone:',e);}
 };
 // If somebody opens 3D or the app re-renders the room, cleanup is automatic.
 const tick=now=>{
  if(!live)return;
  if(!layer.isConnected||!room.isConnected||!room.classList.contains('office-iso')||room.classList.contains('office-3d-on'))return complete();
  const pose=officeChairAt((now-start)/1000);
  if(pose.time>=D.duration){
   // Draw a final neutral position before the DOM background returns.
   return complete();
  }
  const {robot,chair:shift}=pose;
  addStyle(chair,{left:pct(D.chairLeft+shift.x,D.width),top:pct(D.chairTop+shift.y,D.height)});
  addStyle(shadow,{left:pct(624+shift.x,D.width),top:pct(887+shift.y,D.height)});
  addStyle(bot,{left:pct(robot.x-62,D.width),top:pct(robot.y-160,D.height)});
  root.rotation.y=THREE.MathUtils.degToRad(robot.yaw);
  if(lastClip!==pose.clip){
   const before=lastClip&&actions.get(lastClip);if(before)before.stop();
   const active=actions.get(pose.clip);active.reset();
   if(['Idle','Walk','Seated_Work','Seated_Idle'].includes(pose.clip))active.setLoop(THREE.LoopRepeat,Infinity);
   else{active.setLoop(THREE.LoopOnce,1);active.clampWhenFinished=true;}
   active.enabled=true;active.play();lastClip=pose.clip;
  }
  mixer.setTime(pose.clipTime);
  renderer.render(scene,camera);
  frame=requestAnimationFrame(tick);
 };
 try{
  room.classList.add('office-chair-demo-active');room.appendChild(layer);
  frame=requestAnimationFrame(tick);
 }catch(e){complete();throw e;}
 return {stop:complete, get running(){return live;}, get elapsed(){return Math.max(0,(performance.now()-start)/1000);}};
}
