/** Screen-only labels: bounded head offsets and deterministic account identity. */
export function placeNameLabels(points,{width,height,top=0,bottom=height}={}){
 const placed=[],result=new Map();
 for(const p of points.filter(p=>p.visible).sort((a,b)=>a.y-b.y||String(a.id).localeCompare(String(b.id)))){
  const w=Math.min(p.width||80,width-8),h=p.height||22,anchorX=p.x,anchorY=p.y;
  // Never clamp an offscreen robot into an unrelated part of the room.
  if(anchorX<4||anchorX>width-4||anchorY<top+h||anchorY>bottom){result.set(p.id,{id:p.id,visible:false});continue;}
  let best=null;
  for(const dy of [0,-h-4,h+4])for(const dx of [0,-w/2-5,w/2+5]){
   const x=anchorX+dx,y=anchorY+dy;
   if(x-w/2<4||x+w/2>width-4||y-h<top||y>bottom)continue;
   const overlaps=placed.reduce((n,q)=>n+(Math.abs(q.x-x)<(q.width+w)/2+4&&Math.abs((q.y-q.height/2)-(y-h/2))<(q.height+h)/2+3?1:0),0);
   const score=overlaps*10000+dx*dx+dy*dy;
   if(!best||score<best.score)best={id:p.id,visible:true,x,y,width:w,height:h,anchorX,anchorY,score};
  }
  if(best){placed.push(best);result.set(p.id,best);}else result.set(p.id,{id:p.id,visible:false});
 }
 return points.map(p=>result.get(p.id)||{id:p.id,visible:false});
}
