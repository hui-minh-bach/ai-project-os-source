/** SPACE STUDIO R2: shared world contract. Units: metres; +Y up; desk fronts +Z. */
export const REVISION='space-studio-team-r3.0';
export const PALETTE=Object.freeze({navy:0x10263e,teal:0x246d7a,top:0x55a9b5,cushion:0x269ca7,gold:0xd4ad64,ivory:0xe7edef,cyan:0x42e9ff,floor:0x4a697b});
export const DESK=Object.freeze({width:2.28,depth:.94,height:.714,keyboardY:.750,keyboardZ:.31});
export const CHAIR=Object.freeze({homeZ:1.02,pull:.56,seatY:.39,seatHalfDepth:.245,backZ:.265,gripY:1.035,gripX:.20,pelvisY:.4186,footY:.125706});
export const STATIONS=Object.freeze([
 ['news',-6.35,-1.7,'RESEARCH'],['script',-3.45,-1.7,'SCRIPT'],['image',-.55,-1.7,'DESIGN'],
 ['media',-6.35,1.20,'MEDIA'],['review',-3.45,1.20,'REVIEW'],['publish',-.55,1.20,'PUBLISH'],
 ['agent-7',-6.35,4.1,'ENGINE'],['agent-8',-3.45,4.1,'COUNCIL'],['pm',-.55,4.1,'DIRECTOR']
].map(([id,x,z,label])=>Object.freeze({id,x,z,label})));
export const HERO=Object.freeze({target:[0,.55,0],position:[19,18,24],height:16.0});
export const DURATION=30;
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const mix=(a,b,t)=>a+(b-a)*t;
export const interval=(t,a,b)=>smooth((t-a)/(b-a));
