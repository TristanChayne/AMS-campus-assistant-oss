const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('work/live-ui.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];new vm.Script(script);
const els={},make=id=>els[id]||(els[id]={id,style:{},value:'',open:false,classList:{add(){},remove(){}},showModal(){this.open=true;},close(){this.open=false;},addEventListener(){},setPointerCapture(){},getBoundingClientRect(){return {left:0,top:0,width:390,height:600}}});
const doc={getElementById:id=>id==='mapViewer'&&!els[id]?null:make(id),createElement(){return make('mapViewer');},body:{appendChild(){}},querySelectorAll(){return []}};
const ctx={document:doc,settingsData:{appearance:'dark',theme:'blue',account:'test'},appearanceNames:{system:'跟随系统',light:'浅色',dark:'深色'},themes:{blue:['校园蓝','#172e61']},escape:x=>x,send(){},render(){},window:{matchMedia:()=>({matches:false})},setTimeout(f){ctx.timer=f;return 1},clearTimeout(){}};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('work/managed-campus-maps.js','utf8').replace('const campusMapImages={};',script.slice(script.indexOf('const campusMapImages='),script.indexOf('\nconst mapUrl='))),ctx);
vm.runInContext(script.slice(script.indexOf('function renderSettings('),script.indexOf('const scrollPositions=')),ctx);
const choices=['system','light','dark'].map(appearance=>({dataset:{appearance}}));const screen={querySelectorAll:selector=>selector==='[data-appearance]'?choices:[]};ctx.renderSettings(screen);assert(!screen.innerHTML.includes('返回课表'));assert(screen.innerHTML.includes('appearanceDropdown'));assert(screen.innerHTML.includes('校园地图'));assert(!screen.innerHTML.includes('appearance-options'));
ctx.openCampusMap('tc');const viewport=make('mapViewport'),image=make('mapImage');viewport.clientWidth=390;viewport.clientHeight=600;image.clientWidth=390;image.clientHeight=294;image.onload();
const pointer=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,pointerType:'touch'});
viewport.onpointerdown(pointer(1,145,300));viewport.onpointerdown(pointer(2,245,300));viewport.onpointermove(pointer(1,45,300));viewport.onpointermove(pointer(2,345,300));assert(image.style.transform.includes('scale(3)'));
viewport.onpointerup(pointer(2,345,300));viewport.onpointermove(pointer(1,95,300));assert(image.style.transform.includes('translate(50px,0px)'));
make('mapZoomIn').onclick();assert(image.style.transform.includes('scale(4.5)'));make('mapReset').onclick();assert.equal(image.style.transform,'translate(0px,0px) scale(1)');make('mapClose').onclick();assert(!els.mapViewer.open);
vm.runInContext(script.slice(script.indexOf('let sheetCloseTimer;'),script.indexOf('function detail(')),ctx);const sheet=make('sheet');sheet.open=true;ctx.closeSheet();assert(sheet.open);const handler=sheet.onanimationend;ctx.closeSheet();assert.equal(sheet.onanimationend,handler);handler({target:sheet,animationName:'appear'});assert(sheet.open);handler({target:sheet,animationName:'sheet-dismiss'});assert(!sheet.open);sheet.open=true;ctx.closeSheet();ctx.timer();assert(!sheet.open);sheet.open=true;ctx.window.matchMedia=()=>({matches:true});ctx.closeSheet();assert(!sheet.open);
for(const [source,asset] of [['D:/Desktop/ADS/TC.jpg','tc.jpg'],['D:/Desktop/ADS/SIP.png','sip.png']])assert(fs.readFileSync(source).equals(fs.readFileSync('outputs/ams-android/app/src/main/assets/maps/'+asset)));
console.log('PASS compact settings, map originals, pinch zoom, drag, zoom/reset/close and animated/reduced-motion sheet dismissal.');

for(const [key,file] of [['tc','tc.jpg'],['sip','sip.png']]){const url=vm.runInContext('mapUrl('+JSON.stringify(key)+')',ctx);assert(url.startsWith('data:image/'));assert(Buffer.from(url.split(',')[1],'base64').equals(fs.readFileSync('outputs/ams-android/app/src/main/assets/maps/'+file)));}
assert(!screen.innerHTML.includes('<select'));console.log('PASS embedded map bytes and inline dropdown without native select.');

let requested;ctx.send=(action,data)=>{requested={action,data};};make('appearanceDropdown').open=true;choices[2].onclick();assert.equal(make('appearanceDropdown').open,false);assert.equal(requested.action,'appearance');assert.equal(requested.data.appearance,'dark');console.log('PASS selecting appearance collapses inline choices and sends persisted native preference.');


assert(!script.includes("send('modalShade'"));const native=fs.readFileSync('outputs/ams-android/app/src/main/java/cn/local/ams/MainActivity.java','utf8');assert(!native.includes('setModalShade'));assert(native.includes('setStatusBarColor(android.graphics.Color.TRANSPARENT)'));assert(native.includes('setNavigationBarColor(android.graphics.Color.TRANSPARENT)'));assert(native.includes('int oldPaper = pageSurface'));assert(fs.readFileSync('outputs/ams-android/app/src/main/assets/ams-modern-ui.js','utf8').includes('window.__amsSetInsets'));console.log('PASS single full-screen web shade, transparent system bars, safe insets and no native modal animation.');

// Sports keep-alive section: hidden unless the Android app announces it; switch and 3/5/7 days send the native preference.
{const box=make('keepAliveSection');const days=[3,5,7].map(n=>({dataset:{keepDays:String(n)}}));box.querySelectorAll=sel=>sel==='[data-keep-days]'?days:[];
 ctx.settingsData.keepAlive={available:false,enabled:false,days:3};ctx.renderKeepAlive();assert.equal(box.hidden,true);assert.equal(box.innerHTML,'');
 let sent=[];ctx.send=(action,data)=>sent.push({action,data});
 ctx.settingsData.keepAlive={available:true,enabled:false,days:3};ctx.renderKeepAlive();assert.equal(box.hidden,false);assert(box.innerHTML.includes('role="switch"')&&box.innerHTML.includes('aria-checked="false"')&&!box.innerHTML.includes('data-keep-days'));
 make('keepAliveSwitch').onclick();assert.equal(JSON.stringify(sent.at(-1)),JSON.stringify({action:'keepAlive',data:{enabled:true,days:3}}));assert(box.innerHTML.includes('aria-checked="true"')&&box.innerHTML.includes('data-keep-days="7"'));
 days[2].onclick();assert.equal(JSON.stringify(sent.at(-1)),JSON.stringify({action:'keepAlive',data:{enabled:true,days:7}}));assert(box.innerHTML.includes('连续 7 天未打开体育馆后自动停止'));
 const installer=fs.readFileSync('outputs/ams-android/app/src/main/assets/ams-modern-ui.js','utf8');assert(installer.includes("case 'keepAlive':if(window.__amsNativeNavigation&&typeof e.data.enabled==='boolean'&&[3,5,7].includes(e.data.days))location.href='ams-local://keepalive?enabled='"));
 assert(native.includes('"keepalive".equals(uri.getHost()) && amsMobilePage()')&&native.includes('days.matches("[357]")'));
 console.log('PASS sports keep-alive settings: hidden without native support, switch and 3/5/7 days send validated preferences.');}
