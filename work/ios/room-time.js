// Prefer school time values over coordinates measured by a hidden desktop timeline.
function iosRoomMinute(value) {
 const match=String(value).match(/(?:^|[T ])(\d{1,2}):(\d{2})(?::\d{2})?/);
 return match ? Number(match[1])*60+Number(match[2]) : NaN;
}
function iosRoomBlocks(c,a,b) {
 const result=[];
 for(const [raw,pixels,kind,startKey,endKey] of [[c.config.resvInfo,c.errorArr,'busy','startTime','endTime'],[c.config.cls,c.disArr,'closed','start','end']]) {
  const source=Array.isArray(raw)?raw.filter(x=>kind!=='busy'||!(Number(x.resvStatus)&128)):null;
  const times=source?.map(x=>({start:iosRoomMinute(x[startKey]),end:iosRoomMinute(x[endKey]),kind}));
  const blocks=times?.every(x=>Number.isFinite(x.start)&&Number.isFinite(x.end))?times:(pixels||[]).map(x=>({start:Math.round(a+x.start/c.boxWidth*(b-a)),end:Math.round(a+x.end/c.boxWidth*(b-a)),kind}));
  result.push(...blocks.map(x=>({...x,start:Math.max(a,x.start),end:Math.min(b,x.end)})).filter(x=>x.end>x.start));
 }
 return result;
}
