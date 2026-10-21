// Independent iOS metadata: never reuse the Android APK version/download settings.
export function iosPublicConfig(raw) {
 const empty={schemaVersion:1,announcement:null,release:null};
 if(!raw)return empty;
 if(typeof raw!=='string'||raw.length>16384)throw Error('Invalid iOS public configuration');
 const input=JSON.parse(raw);
 if(input.schemaVersion!==1)throw Error('Invalid iOS configuration schema');
 const text=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
 const https=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url:null;}catch{return null;}};
 if(input.release!=null){
  const r=input.release,url=https(r.url);
  if(!text(r.version,40)||!Number.isInteger(r.build)||r.build<1||r.build>2147483647||!url||!['apps.apple.com','testflight.apple.com'].includes(url.hostname)||typeof r.notes!=='string'||r.notes.length>2000)throw Error('Invalid iOS release');
  empty.release={version:r.version,build:r.build,url:url.href,notes:r.notes};
 }
 if(input.announcement!=null){
  const a=input.announcement;
  if(!text(a.id,100)||!text(a.title,120)||!text(a.message,4000))throw Error('Invalid iOS announcement');
  empty.announcement={id:a.id,title:a.title,message:a.message};
  if(a.important!==undefined){if(typeof a.important!=='boolean')throw Error('Invalid importance');empty.announcement.important=a.important;}
  for(const key of ['source','publishedAt'])if(a[key]!==undefined){if(!text(a[key],120))throw Error('Invalid announcement metadata');empty.announcement[key]=a[key];}
  if(a.expiresAt!==undefined){if(!text(a.expiresAt,40)||!Number.isFinite(Date.parse(a.expiresAt)))throw Error('Invalid expiry');empty.announcement.expiresAt=a.expiresAt;}
  if(a.url!==undefined){const url=https(a.url);if(!url)throw Error('Invalid announcement URL');empty.announcement.url=url.href;}
 }
 return empty;
}
