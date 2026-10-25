import {createSpaceStudio} from './scene.mjs';
import {DURATION} from './design.mjs';
import {hasUnfinishedWork} from './live-motion.mjs';
import {placeNameLabels} from './name-labels.mjs';
import {PHASE_LABELS} from './motion.mjs';
import {STATE_LABELS,ROLE_LABELS} from './fleet-contract.mjs';
const VI={all:'To\u00e0n c\u1ea3nh',close:'C\u1eadn b\u00e0n gh\u1ebf',side:'G\u00f3c b\u00ean',other:'\u0110\u1ed5i g\u00f3c',play:'Ph\u00e1t th\u1eed',pause:'T\u1ea1m d\u1eebng',reset:'T\u1eeb \u0111\u1ea7u',live:'\u0110\u1ed9i AI th\u1eadt',demo:'Xem demo',brightness:'\u0110\u1ed9 s\u00e1ng',names:'T\u00ean robot',motion:'D\u1eebng chuy\u1ec3n \u0111\u1ed9ng',resume:'Ti\u1ebfp t\u1ee5c chuy\u1ec3n \u0111\u1ed9ng',focus:'C\u1eadn c\u1ea3nh robot',dismiss:'\u0110\u00f3ng chi ti\u1ebft',empty:'Ch\u01b0a c\u00f3 t\u00e1c v\u1ee5 \u0111ang ch\u1ea1y',waiting:'Ch\u1edd l\u1ed1i \u0111i / ch\u1edd b\u00e0n'};
const BRIGHTNESS_KEY='aios-space-studio-brightness';
function loadBrightness(){try{const value=localStorage.getItem(BRIGHTNESS_KEY);return value===null ? .85 : Math.min(1.05,Math.max(.6,Number(value)||.85));}catch{return .85;}}
function saveBrightness(v){try{localStorage.setItem(BRIGHTNESS_KEY,String(v));}catch{}}
export async function mountSpaceViewer(host,{manual=false,capture=false,clean=false,quality='high',live=false,geometryOnly=false,modelBuffer=null,brightness=loadBrightness()}={}){
 const ui=document.createElement('div');ui.className='space-viewer'+(capture?' space-capture':'')+(clean?' space-clean':'');
 ui.innerHTML=`<div class="space-stage"></div><div class="space-name-layer"></div><header class="space-head"><div><div class="space-kicker">AI PROJECT OS / SPACE STUDIO</div><h2 class="space-title">IDEA SPACE STUDIO</h2></div><span class="space-pill">REAL 3D / R3</span></header><p class="space-model-warning"></p><div class="space-agent-detail" hidden></div><div class="space-note"></div><div class="space-bottom"><div class="space-buttons"><button type="button" class="space-btn active" data-camera="hero">${VI.all}</button><button type="button" class="space-btn" data-camera="close">${VI.close}</button><button type="button" class="space-btn" data-camera="side">${VI.side}</button><button type="button" class="space-btn" data-camera="overview">${VI.other}</button><button type="button" class="space-btn" data-action="mode">${VI.demo}</button><button type="button" class="space-btn primary" data-action="motion">${VI.motion}</button><button type="button" class="space-btn primary" data-action="play">${VI.play}</button><button type="button" class="space-btn" data-action="reset">${VI.reset}</button></div><div class="space-live-options"><label><input type="checkbox" data-option="names" checked> ${VI.names}</label><label class="space-brightness">${VI.brightness} <input type="range" min="60" max="105" step="1" value="${Math.round(brightness*100)}" aria-label="${VI.brightness}"><output>${Math.round(brightness*100)}%</output></label></div><div class="space-timeline"><span class="space-phase"></span><input class="space-slider" aria-label="Animation time" type="range" min="0" max="30" step="0.01" value="0"><span class="space-time">00.0 / 30.0</span></div></div><div class="space-capture-caption"><div><strong data-caption></strong><small data-subcaption>MODEL + ANIMATION FROM APP SOURCE</small></div><span class="space-time" data-capturetime></span></div><div class="space-error" role="alert" hidden></div>`;
 host.appendChild(ui);let disposed=false,core,selected=null,lastDetail='',showNames=true;
 const error=ui.querySelector('.space-error'),warning=ui.querySelector('.space-model-warning'),labels=ui.querySelector('.space-name-layer'),labelMap=new Map(),lineMap=new Map(),detail=ui.querySelector('.space-agent-detail');
 const links=document.createElementNS('http://www.w3.org/2000/svg','svg');links.classList.add('space-name-links');links.setAttribute('aria-hidden','true');links.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';labels.append(links);
 const play=ui.querySelector('[data-action="play"]'),slider=ui.querySelector('.space-slider'),phase=ui.querySelector('.space-phase'),stamp=ui.querySelector('.space-time'),modeButton=ui.querySelector('[data-action="mode"]');
 function selectAgent(id){selected=id;lastDetail='';core?.selectRobot(id);renderLive();}
 function updateDetail(actors){const a=actors.find(a=>a.id===selected);if(!a){detail.hidden=true;selected=null;lastDetail='';return;}
  const b=a.data,sig=JSON.stringify([b,a.phase,a.waitingReason]);if(sig===lastDetail)return;lastDetail=sig;detail.hidden=false;detail.replaceChildren();
  const name=document.createElement('strong');name.textContent=b.name;const role=document.createElement('small');role.textContent=[b.provider,...b.roles.map(r=>ROLE_LABELS[r])].filter(Boolean).join(' / ');
  const state=document.createElement('p');state.textContent=STATE_LABELS[b.state]||b.state;
  const job=document.createElement('p');job.textContent=b.jobs.length?b.jobs.map(j=>[j.projectName,j.title,j.phase].filter(Boolean).join(' - ')).join('\n'):VI.empty;
  const origin=document.createElement('small');origin.textContent=b.source==='provider'?'Ngu\u1ed3n: l\u1eddi g\u1ecdi AI th\u1eadt':'Ngu\u1ed3n: tr\u1ea1ng th\u00e1i t\u00e1c v\u1ee5 / k\u1ebft n\u1ed1i';
  detail.append(name,role,state,job,origin);
  if(a.waitingReason){const wait=document.createElement('p');wait.textContent=(a.waitingReason==='no-standing-space'?'Ch\u01b0a c\u00f2n v\u1ecb tr\u00ed tr\u1ed1ng trong ph\u00f2ng':VI.waiting)+' (ch\u1ec9 ho\u1ea1t c\u1ea3nh; t\u00e1c v\u1ee5 kh\u00f4ng b\u1ecb d\u1eebng).';detail.append(wait);}
  const focus=document.createElement('button');focus.type='button';focus.className='space-btn';focus.textContent=VI.focus;focus.addEventListener('click',()=>core?.focusRobot(a.id));
  const close=document.createElement('button');close.type='button';close.className='space-btn';close.textContent=VI.dismiss;close.addEventListener('click',()=>{selected=null;lastDetail='';core?.selectRobot(null);detail.hidden=true;});detail.append(focus,close);
 }
 function renderLive(){if(!core||disposed)return;const isLive=core.getDisplayMode()==='live',actors=core.getFleet();labels.hidden=!isLive||!showNames;
  const ids=new Set(actors.map(a=>a.id));for(const [id,node]of labelMap)if(!ids.has(id)){node.remove();labelMap.delete(id);lineMap.get(id)?.remove();lineMap.delete(id);}
  for(const a of actors){let node=labelMap.get(a.id);if(!node){node=document.createElement('button');node.type='button';node.className='space-name-tag';const name=document.createElement('strong'),state=document.createElement('small');state.hidden=true;node.style.cssText='padding:3px 6px;max-width:124px;min-height:0;line-height:1.2';node.append(name,state);const line=document.createElementNS(links.namespaceURI,'line');line.setAttribute('stroke','#83cddd');line.setAttribute('stroke-width','1');line.setAttribute('opacity','.75');links.append(line);lineMap.set(a.id,line);node.addEventListener('click',()=>selectAgent(a.id));labels.append(node);labelMap.set(a.id,node);}
   node.firstElementChild.textContent=a.data.name;node.lastElementChild.hidden=!hasUnfinishedWork(a.data);node.lastElementChild.textContent=['offline','quota','error'].includes(a.data.state)?(STATE_LABELS[a.data.state]||a.data.state):'Đang làm việc';node.dataset.state=a.data.state;node.style.setProperty('--agent-color',a.data.color);node.title=a.data.name+' - '+(STATE_LABELS[a.data.state]||a.data.state)+' - '+a.data.activityLabel;node.setAttribute('aria-pressed',String(a.id===selected));}
  const points=core.labelPositions();
  const width=labels.clientWidth||ui.clientWidth||850,height=labels.clientHeight||ui.clientHeight||500;
  const top=ui.querySelector('.space-head').getBoundingClientRect().bottom-ui.getBoundingClientRect().top+6;
  const bottom=ui.querySelector('.space-bottom').getBoundingClientRect().top-ui.getBoundingClientRect().top-6;
  const placements=placeNameLabels(points.map(p=>({...p,width:labelMap.get(p.id)?.offsetWidth||80,height:labelMap.get(p.id)?.offsetHeight||22})),{width,height,top,bottom});
  for(const p of placements){const node=labelMap.get(p.id),line=lineMap.get(p.id);if(!node)continue;node.hidden=!p.visible;if(line)line.style.display=p.visible?'':'none';if(!p.visible)continue;
   node.style.left=p.x+'px';node.style.top=p.y+'px';node.dataset.anchorX=p.anchorX;node.dataset.anchorY=p.anchorY;
   line?.setAttribute('x1',p.anchorX);line?.setAttribute('y1',p.anchorY);line?.setAttribute('x2',p.x);line?.setAttribute('y2',p.y);
  }
  if(isLive)updateDetail(actors);else detail.hidden=true;
 }
 function modeUi(){if(!core)return;const isLive=core.getDisplayMode()==='live';ui.dataset.mode=isLive?'live':'demo';
  play.hidden=isLive;ui.querySelector('[data-action="reset"]').hidden=isLive;ui.querySelector('.space-timeline').hidden=isLive;
  ui.querySelector('[data-action="motion"]').hidden=!isLive;ui.querySelector('[data-option="names"]').parentElement.hidden=!isLive;
  modeButton.textContent=isLive?VI.demo:VI.live;
  ui.querySelector('.space-pill').textContent=isLive?'LIVE ACCOUNTS / R3':'DEMO / R2 MOTION';
  ui.querySelector('.space-note').textContent=isLive?'T\u00ean/tr\u1ea1ng th\u00e1i t\u1eeb app. Chuy\u1ec3n \u0111\u1ed9ng ch\u1ec9 di\u1ec5n h\u1ecda; kh\u00f4ng t\u1ef1 g\u1ecdi AI.':'DEMO chuy\u1ec3n \u0111\u1ed9ng - kh\u00f4ng ph\u1ea3i c\u00f4ng vi\u1ec7c AI.';renderLive();}
 try{
  core=await createSpaceStudio(ui.querySelector('.space-stage'),{manual,quality,live,geometryOnly,modelBuffer,brightness,onSelect:selectAgent,onError:message=>{warning.textContent=message;},onFrame:({time,phase:p,mode})=>{
   if(mode==='demo'){if(time>=DURATION)play.textContent=VI.play;slider.value=String(time);phase.textContent=PHASE_LABELS[p]||p;stamp.textContent=`${time.toFixed(1).padStart(4,'0')} / 30.0`;ui.querySelector('[data-caption]').textContent=PHASE_LABELS[p]||p;ui.querySelector('[data-capturetime]').textContent=`${time.toFixed(1).padStart(4,'0')}s`;}
   renderLive();
  }});
  if(disposed){core.dispose();return {dispose(){}};}
 }catch(e){error.hidden=false;error.textContent='Kh\u00f4ng kh\u1edfi t\u1ea1o \u0111\u01b0\u1ee3c WebGL: '+String(e?.message||e)+'. Ph\u00f2ng c\u0169 v\u1eabn \u0111\u01b0\u1ee3c gi\u1eef l\u1ea1i.';ui.remove();throw e;}
 const setView=v=>{core.setCamera(v);ui.querySelectorAll('[data-camera]').forEach(b=>b.classList.toggle('active',b.dataset.camera===v));core.setTime(core.getTime());};
 ui.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.camera)));
 play.addEventListener('click',()=>{if(core.isPlaying()){core.pause();play.textContent=VI.play;}else{core.play();play.textContent=VI.pause;}});
 ui.querySelector('[data-action="reset"]').addEventListener('click',()=>{core.pause();core.setTime(0);play.textContent=VI.play;});
 slider.addEventListener('input',()=>{core.pause();play.textContent=VI.play;core.setTime(Number(slider.value));});
 modeButton.addEventListener('click',()=>{core.setDisplayMode(core.getDisplayMode()==='live'?'demo':'live');modeUi();});
 const motion=ui.querySelector('[data-action="motion"]');motion.title='Ch\u1ec9 d\u1eebng h\u00ecnh \u1ea3nh, kh\u00f4ng d\u1eebng t\u00e1c v\u1ee5 th\u1eadt';motion.addEventListener('click',()=>{core.setMotionPaused(!core.isMotionPaused());motion.textContent=core.isMotionPaused()?VI.resume:VI.motion;motion.setAttribute('aria-pressed',String(core.isMotionPaused()));});
 ui.querySelector('[data-option="names"]').addEventListener('change',event=>{showNames=event.target.checked;renderLive();});
 const brightnessSlider=ui.querySelector('.space-brightness input');brightnessSlider.addEventListener('input',()=>{const value=core.setBrightness(Number(brightnessSlider.value)/100);ui.querySelector('.space-brightness output').textContent=Math.round(value*100)+'%';saveBrightness(value);});
 modeUi();core.setTime(0);
 return {...core,element:ui,setCamera:setView,selectAgent,setDisplayMode(mode){core.setDisplayMode(mode);modeUi();},dispose(){disposed=true;core?.dispose();labelMap.clear();ui.remove();}};
}
export async function standalone(){
 const p=new URLSearchParams(location.search),root=document.getElementById('spaceRoot');
 try{const viewer=await mountSpaceViewer(root,{manual:p.has('capture'),capture:p.has('capture'),clean:p.has('clean'),quality:p.get('quality')==='low'?'low':'high',live:p.get('mode')==='live'});window.__spaceStudio=viewer;viewer.setCamera(p.get('view')||'hero');viewer.setTime(Number(p.get('time'))||0);window.__spaceReady=true;}catch(e){window.__spaceError=String(e?.stack||e);console.error(e);}
}
if(document.getElementById('spaceRoot'))standalone();
