/** Split readable source without cutting a UTF-8 character; concatenation is exact. */
export function splitUtf8(bytes,maxBytes=1_200_000){
 if(!Buffer.isBuffer(bytes)||!Number.isSafeInteger(maxBytes)||maxBytes<4)throw new Error('Invalid text split budget');const parts=[];let pos=0;
 while(pos<bytes.length){let end=Math.min(pos+maxBytes,bytes.length);if(end<bytes.length){const newline=bytes.lastIndexOf(10,end-1);if(newline>=pos)end=newline+1;else while(end>pos&&(bytes[end]&0xc0)===0x80)end--;if(end<=pos)throw new Error('Cannot split UTF-8 safely');}parts.push(bytes.subarray(pos,end));pos=end;}return parts;
}
