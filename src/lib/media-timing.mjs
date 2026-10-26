export function validateVideoTimeline(timeline,sourceSeconds,outputSeconds){
 if(!Array.isArray(timeline)||!timeline.length||timeline.length>201)throw new Error('Timeline lồng tiếng không hợp lệ.');let input=0,output=0;
 for(const p of timeline){if(![p.sourceStart,p.sourceEnd,p.outputStart,p.outputEnd].every(Number.isFinite)||Math.abs(p.sourceStart-input)>.02||Math.abs(p.outputStart-output)>.02||p.sourceEnd<=p.sourceStart||p.outputEnd<=p.outputStart||(p.outputEnd-p.outputStart)/(p.sourceEnd-p.sourceStart)>3.01)throw new Error('Timeline thiếu/chồng đoạn hoặc giãn hình quá mức.');input=p.sourceEnd;output=p.outputEnd;}
 if(Math.abs(input-sourceSeconds)>.06||Math.abs(output-outputSeconds)>.1)throw new Error('Timeline không giữ đủ hình/tiếng.');return timeline;
}
export function mapSourceTime(timeline,time){if(!timeline?.length)return time;const p=timeline.find(p=>time>=p.sourceStart-.0001&&time<=p.sourceEnd+.0001)||timeline.at(-1);return p.outputStart+(time-p.sourceStart)*(p.outputEnd-p.outputStart)/(p.sourceEnd-p.sourceStart);}
