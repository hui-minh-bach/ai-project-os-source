'use strict';
const {fs,path,insist,ffprobe,hasAudio,hasVideo,duration}=require('../src/utils.cjs');
const {parseSrt}=require('../src/subtitles.cjs');
async function checkSample(dir){
 const s=path.join(dir,'story_720p.mp4'),e=path.join(dir,'editor_final.mp4'),captions=path.join(dir,'story_captions.srt');
 for(const file of [s,e,captions])insist(fs.existsSync(file),'Missing actual verification file: '+file);
 const sp=await ffprobe(s),ep=await ffprobe(e),segments=parseSrt(fs.readFileSync(captions,'utf8'));
 insist(hasVideo(sp)&&hasAudio(sp)&&hasVideo(ep)&&hasAudio(ep),'Actual MP4 has missing A/V stream');
 const dims=sp.streams.find(x=>x.codec_type==='video');insist(dims.width===1280&&dims.height===720,'Story is not 720p');
 insist(segments.length>=10,'Insufficient timed subtitles');
 const maxEnd=Math.max(...segments.map(x=>x.end)),delta=Math.abs(maxEnd-duration(sp));
 insist(delta<.8,`Segment timing differs from MP4 by ${delta.toFixed(3)} seconds`);
 const report={actualStorySeconds:duration(sp),actualEditorSeconds:duration(ep),captionSegments:segments.length,storyResolution:`${dims.width}x${dims.height}`,lastCaptionToVideoDeltaSeconds:delta,subtitleTimingMethod:'TTS sentences measured with FFprobe; actual words not forced aligned'};
 console.log('VERIFIED_SAMPLES',JSON.stringify(report,null,2));return report;
}
checkSample(path.resolve(__dirname,'..','artifacts','samples')).catch(e=>{console.error(e.stack);process.exitCode=1});
