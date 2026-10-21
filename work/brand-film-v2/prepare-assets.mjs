import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const option=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
const ipaPath=option('--ipa')||'E:/Codex/Ams-prototype/outputs/ios-release-0.2.0-6/AMS-0.2.0-6.ipa';
const releaseManifestPath=path.join(path.dirname(ipaPath),'release-source-manifest.json');
const out=path.join(root,'outputs/brand-film-v2'),publicDir=path.join(out,'public'),sourceDir=path.join(out,'source-assets');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const ipa=fs.readFileSync(ipaPath);
if(sha(ipa)!=='a550235cabbab0f9a3c4ab525fb8618e43556e740e9691733d1ff0e577ad63fb')throw Error('Expected verified iOS 0.2.0 Build 6 IPA');
const release=JSON.parse(fs.readFileSync(releaseManifestPath,'utf8'));
if(release.version!=='0.2.0'||release.build!==6)throw Error('Release manifest is not Build 6');
fs.mkdirSync(publicDir,{recursive:true});fs.mkdirSync(sourceDir,{recursive:true});

function zipEntry(wanted){
 let end=ipa.length-22;while(end>=Math.max(0,ipa.length-65557)&&ipa.readUInt32LE(end)!==0x06054b50)end--;
 if(end<0)throw Error('Missing ZIP directory');
 let cursor=ipa.readUInt32LE(end+16);const count=ipa.readUInt16LE(end+10);
 for(let i=0;i<count;i++){
  if(ipa.readUInt32LE(cursor)!==0x02014b50)throw Error('Invalid ZIP directory');
  const method=ipa.readUInt16LE(cursor+10),size=ipa.readUInt32LE(cursor+20),nameLength=ipa.readUInt16LE(cursor+28),extra=ipa.readUInt16LE(cursor+30),comment=ipa.readUInt16LE(cursor+32),offset=ipa.readUInt32LE(cursor+42);
  const name=ipa.subarray(cursor+46,cursor+46+nameLength).toString('utf8');
  if(name===wanted){
   if(ipa.readUInt32LE(offset)!==0x04034b50)throw Error('Invalid ZIP local entry');
   const start=offset+30+ipa.readUInt16LE(offset+26)+ipa.readUInt16LE(offset+28),compressed=ipa.subarray(start,start+size);
   if(method!==0&&method!==8)throw Error('Unsupported ZIP compression');
   return method===8?zlib.inflateRawSync(compressed):compressed;
  }
  cursor+=46+nameLength+extra+comment;
 }
 throw Error('Missing public display asset: '+wanted);
}
const sourceAssets=[];
for(const relative of ['Assets/review-content.html','Assets/hht/hht.html']){
 const bytes=zipEntry('Payload/AMS.app/'+relative),digest=sha(bytes);
 if(digest!==release.files[relative])throw Error('Build 6 packaged display asset hash mismatch: '+relative);
 const destination=path.join(sourceDir,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
 sourceAssets.push({packagedPath:'Payload/AMS.app/'+relative,sha256:digest,localPath:path.relative(out,destination).replaceAll('\\','/')});
}
const iconPath=path.join(root,'work/ios/app-icon.png'),icon=fs.readFileSync(iconPath);
if(sha(icon)!==release.files['AppAssets.xcassets/AppIcon.appiconset/AppIcon.png'])throw Error('iOS icon does not match release manifest');
fs.writeFileSync(path.join(publicDir,'ams-icon.png'),icon);

const require=createRequire(import.meta.url);
const playwrightPath=option('--playwright')||'C:/Users/linla/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const {chromium}=require(playwrightPath);
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
const networkAttempts=[];
await context.route('**/*',route=>{networkAttempts.push(route.request().url().split('?')[0]);return route.abort();});
let page=await context.newPage();
const screenshots=[];
const fixedTime='2026-10-14T09:40:00+08:00';
const course=(id,start,end,dayOffset=0)=>({id,moduleCode:'SOE106TC',moduleTitle:'Programming with C++',moduleTime:start+'-'+end,moduleTypeGroup:'Lecture',room:'DE-2001',location:'演示教室',dayOffset,date:'2026-10-'+String(14+dayOffset),status:0});
const courses=[course('demo-course-1','10:00','11:50'),course('demo-course-2','14:00','15:50'),course('demo-course-3','10:00','11:50',1)];
// Entire seat arrangement and availability are fictional animatic data, never school inventory.
const resources=Array.from({length:126},(_,i)=>({id:'demo-seat-'+(i+1),name:'7F-'+String(i+1).padStart(3,'0'),coordinate:(5+(i%14)*6.9)+','+(5+Math.floor(i/14)*10.8),kind:'seat',minMinutes:60,minPeople:1,maxPeople:1}));
resources.push(...['314','316','318'].map(name=>({id:'demo-room-'+name,name,kind:'room',minMinutes:60,minPeople:2,maxPeople:5})));
const model={seed:{student:'校园同学',notice:'隔离演示数据',resources,leaveTypes:['Illness','Personal','Other'],busTimes:['07:30','08:30']},state:{anchor:'2026-10-14',attendance:[],leaves:[],bookings:[]},courses,today:'2026-10-14'};
const snapshot={route:'/home',days:[0,1,2].map(offset=>({date:'10-'+String(14+offset),fullDate:'2026-10-'+String(14+offset),timetableVoList:courses.filter(c=>c.dayOffset===offset)})),ready:true,loading:false,leave:true,account:'校园同学',theme:'blue',signMethod:'code',demo:model};
const prelude=`<script>window.__amsDailyRows=[{text:'今天也要好好照顾自己。'}];window.fetch=()=>Promise.reject(Error('Offline film fixture blocks all network'));{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['${fixedTime}']))}static now(){return new NativeDate('${fixedTime}').getTime()}}}</script>`;
const ui=fs.readFileSync(path.join(sourceDir,'Assets/review-content.html'),'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i,'');
const commonCss='*{animation:none!important;transition:none!important}.app>.form-notice,.preview-tag,.demo{display:none!important}html,body{background:#f5f6f8!important}.app{min-height:844px}.form-notice{display:none!important}';
await page.setContent(prelude+ui,{waitUntil:'domcontentloaded'});
await page.addStyleTag({content:commonCss});
async function state(data){await page.evaluate(data=>window.postMessage({amsUiData:data},'*'),{...snapshot,...data});await page.waitForTimeout(100);}
async function shot(name,notes=[]){await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});const destination=path.join(publicDir,name+'.png');await page.screenshot({path:destination});screenshots.push({name,file:'public/'+name+'.png',width:1170,height:2532,sha256:sha(fs.readFileSync(destination)),notes});}
try{
 await state({route:'/home'});await page.locator('.hero').waitFor({state:'visible'});
 await shot('home',['Packaged iOS HTML rendered with anonymous fictional timetable. Browser fallback HTML navigation is visible; native UIKit chrome was not captured.']);
 await shot('timetable',['Same genuine packaged timetable layout; all course data fictional.']);
 const cardFile=path.join(publicDir,'course-card.png');await page.locator('.hero').screenshot({path:cardFile});
 screenshots.push({name:'course-card',file:'public/course-card.png',sha256:sha(fs.readFileSync(cardFile)),notes:['Actual packaged course card HTML, cropped from offline rendering.']});
 await state({route:'/course',overallAttendance:96,list:[{...courses[0],courseAttendance:96,classHour:25,signClassHour:24,absences:1,leaveClassHour:0}]});await shot('attendance',['Fictional attendance counts. No real records.']);
 await state({route:'/leaveApplication',minStart:'2026-10-14',maxStart:'2027-01-01',minEnd:'2026-10-14',maxEnd:'2027-01-01',leaveTypes:['Illness','Personal'],leaveDays:1,selectedCount:1,form:{startDate:'2026-10-14',endDate:'2026-10-14',leaveType:'Illness',leaveReason:'因身体不适，申请请假。',fileList:[]}});await shot('leave',['Blank isolated application fixture; not submitted.']);
 await state({route:'/review/seat'});
 await page.addStyleTag({content:'.review-seat-map{height:258px!important;overflow:hidden!important}.review-seat-plan{width:100%!important;height:258px!important}.review-seat{width:17px!important;height:17px!important;min-height:17px!important;padding:0!important;font-size:6px!important;border-radius:3px!important}.review-back{display:none!important}#reviewBook{padding:13px!important}.field{margin-bottom:8px!important}#reviewBook input,#reviewBook select{padding:7px!important;min-height:34px!important}#reviewBook .form-submit{display:none!important}'});
 await shot('seat',['Packaged Build 6 review seat interface. Complete 14 x 9 fictional arrangement composed from manual fixture; does not represent the actual library floor plan. Map CSS reduced to fit every seat in one frame. No school request or reservation.']);
 await page.locator('[data-seat="demo-seat-66"]').evaluate(node=>node.click());await shot('seat-selected',['Selected fictional 7F-066. Existing Build 6 selection handler invoked locally for the animatic; this is not touch acceptance. No submission.']);
 await state({route:'/review/room'});await shot('room',['Packaged Build 6 review form with fictional room availability. This review form is different from authenticated school reservation pages.']);
 await page.locator('select[name="resourceId"]').selectOption('demo-room-316');await page.locator('input[name="start"]').fill('14:00');await page.locator('input[name="end"]').fill('15:00');await shot('room-selected',['Selected fictional room 316 and 14:00-15:00. No submission.']);
 const hht=fs.readFileSync(path.join(sourceDir,'Assets/hht/hht.html'),'utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i,'');
 const nativeStub='<script>window.webkit={messageHandlers:{hht:{postMessage(){}}}};</script>';
 await page.close();page=await context.newPage();
 await page.setContent(prelude+nativeStub+hht,{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=480;const c=canvas.getContext('2d');c.fillStyle='#f5f6f8';c.fillRect(0,0,480,480);c.strokeStyle='#172e61';c.lineWidth=14;for(let i=0;i<6;i++){c.beginPath();c.arc(240,240,36+i*29,.3+i*.15,Math.PI*1.62+i*.15);c.stroke()}c.fillStyle='#69758a';c.font='20px sans-serif';c.textAlign='center';c.fillText('AMS · 无效演示图形',240,451);window.hhtResult({kind:'code',name:'校园同学',image:canvas.toDataURL('image/png').split(',')[1],updated:Date.now()});});
 await shot('dorm',['Packaged iOS HHT HTML. The center image is a deliberately non-QR arc graphic, cannot grant passage. Native UIKit title bar is absent from the web capture. Refresh can be animated in the composition; this is not a device recording.']);
 if(networkAttempts.length)throw Error('Unexpected blocked network attempts during capture: '+networkAttempts.length);
 const manifest={stage:'Animatic only',app:{version:'0.2.0',build:6,sourceCommit:release.sourceCommit,ipaFile:path.basename(ipaPath),ipaSha256:sha(ipa)},sourceAssets,brand:{source:'work/ios/app-icon.png',sha256:sha(icon),file:'public/ams-icon.png',type:'1024 x 1024 raster app icon verified against release manifest; no vector logo supplied'},capture:{viewport:{width:390,height:844},deviceScaleFactor:3,renderer:'Headless Edge / Playwright, offline HTML rendering',notPhysicalDeviceRecording:true,fixedClock:fixedTime,networkRequests:0},fixture:{course:{moduleCode:'SOE106TC',moduleTitle:'Programming with C++',room:'DE-2001'},account:'校园同学',resources:'Manual fictional 126-seat layout and room choices; no school inventory or private seed imported',transactionsExecuted:0},domPresentationChanges:['Removed demo environment banner and placeholder preview labels for composition; fixture remains documented here.','Removed packaged file-only CSP in the in-memory capture copy; fetch disabled and all browser routes blocked. Exact original packaged sources preserved under source-assets.','Used built-in browser fallback header and navigation for review screens; native UIKit bars unavailable. Browser date/time controls and font fallback differ from iPhone WebKit.','Reduced review seat map geometry to show complete fictional layout; hid submit control in captures.','HHT native bridge replaced with a no-op only in the capture process; code image replaced at source with non-decodable arcs.'],missingForProduction:['Authentic Build 6 Dynamic Island compact-to-expanded recording','Authentic Build 6 scanner recording','Actual authorized iOS library floor layout and room-selection footage','Photographed or licensed high-quality iPhone and real hand footage','Native UIKit navigation screenshots'],screenshots};
 fs.writeFileSync(path.join(out,'asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 console.log('Prepared '+screenshots.length+' offline Build 6 display PNGs and verified iOS logo. Network requests: 0.');
}finally{await browser.close();}
