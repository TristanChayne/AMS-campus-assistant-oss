"""Prepare iOS assets/project; --ios-only also leaves generated backend review assets untouched."""
from pathlib import Path
import base64
import json
import plistlib
import shutil
import sys

IOS_ONLY = '--ios-only' in sys.argv[1:]

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'outputs/ams-ios'
ASSETS = APP / 'Assets'
ANDROID = ROOT / 'outputs/ams-android/app/src/main/assets'
ASSETS.mkdir(parents=True, exist_ok=True)
catalog = APP / 'AppAssets.xcassets'
icons = catalog / 'AppIcon.appiconset'
icons.mkdir(parents=True, exist_ok=True)
(catalog / 'Contents.json').write_text(json.dumps({'info':{'author':'xcode','version':1}}),encoding='utf-8')
shutil.copy2(Path(__file__).with_name('app-icon.png'), icons / 'AppIcon.png')
(icons / 'Contents.json').write_text(json.dumps({'images':[{'filename':'AppIcon.png','idiom':'universal','platform':'ios','size':'1024x1024'}],'info':{'author':'xcode','version':1}}),encoding='utf-8')
shutil.copy2(Path(__file__).with_name('readiness.js'), ASSETS / 'ios-readiness.js')
shutil.copy2(Path(__file__).with_name('loading-diagnostics.js'), ASSETS / 'ios-loading-diagnostics.js')
shutil.copy2(Path(__file__).with_name('auth-theme.js'), ASSETS / 'ios-auth-theme.js')
shutil.copy2(Path(__file__).with_name('auth-recovery.js'), ASSETS / 'ios-auth-recovery.js')
shutil.copy2(ANDROID/'activation-config.json',ASSETS/'activation-config.json')
shutil.copy2(Path(__file__).with_name('app-icon.png'),ASSETS/'activation-icon.png')
shutil.copy2(Path(__file__).with_name('session.js'), ASSETS / 'ios-session.js')
shutil.copy2(Path(__file__).with_name('reservation-session.js'), ASSETS / 'ios-reservation-session.js')
shutil.copy2(Path(__file__).with_name('scan-payload.js'), ASSETS / 'ios-scan-payload.js')
for name in ['sports-theme.css', 'sports-ui.js']:
    shutil.copy2(ROOT / 'work' / name, ASSETS / name)
# Reuse the Android product pages and sanitized tutorial; replace only the native bridge.
shutil.copytree(ANDROID / 'hht', ASSETS / 'hht', dirs_exist_ok=True)
hht_ios_style = Path(__file__).with_name('hht-ios.css').read_text(encoding='utf-8')
hht_page = (ASSETS / 'hht/hht.html').read_text(encoding='utf-8')
hht_page = hht_page.replace('<script>', '<script>' + Path(__file__).with_name('hht-bridge.js').read_text(encoding='utf-8'), 1)
hht_navigation_hook = "el('pageTitle').textContent=pass?'宿舍通行码':'绑定慧湖通';"
assert hht_navigation_hook in hht_page, 'HHT page state hook changed; review the iOS navigation bridge.'
hht_page = hht_page.replace(hht_navigation_hook, hht_navigation_hook + "HhtBridge.navigation(el('pageTitle').textContent,pass&&!el('more').hidden);", 1)
hht_page = hht_page.replace('</style>', hht_ios_style + '</style>', 1)
hht_policy = '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; img-src file: data:; connect-src &#39;none&#39;; form-action &#39;none&#39;">'
hht_page = hht_page.replace('<meta charset', hht_policy + '<meta charset', 1)
(ASSETS / 'hht/hht.html').write_text(hht_page.rstrip() + '\n', encoding='utf-8')
tutorial_path = ASSETS / 'hht/tutorial.html'
tutorial_page = tutorial_path.read_text(encoding='utf-8')
assert '</style>' in tutorial_page, 'HHT tutorial style block changed; review the iOS navigation adapter.'
tutorial_path.write_text(tutorial_page.replace('</style>', hht_ios_style + '</style>', 1).rstrip() + '\n', encoding='utf-8')
for name in ['ams-modern-ui.js', 'ams-scan-entry.js', 'ams-submit-scan.js', 'library-seat-ui.js', 'library-room-ui.js', 'reservation-records-ui.js', 'reservation-reset-ui.js', 'reservation-theme.css']:
    shutil.copy2(ANDROID / name, ASSETS / name)
room = (ASSETS / 'library-room-ui.js').read_text(encoding='utf-8')
room = room.replace('function segments(c){', Path(__file__).with_name('room-time.js').read_text(encoding='utf-8') + '\nfunction segments(c){', 1)
start = room.index(' const blocks=', room.index('function segments(c){'))
end = room.index(' const overlay=', start)
room = room[:start] + ' const blocks=iosRoomBlocks(c,a,b);\n' + room[end:]
room = room.replace('return ![...c.errorArr,...c.disArr].some(block=>x<block.end&&y>block.start);', 'return !iosRoomBlocks(c,a,b).some(block=>start<block.end&&end>block.start);', 1)
room = room.replace('const strip=document.createElement', 'const parts=segments(c);const strip=document.createElement', 1)
room = room.replace('for(const item of segments(c))', 'for(const [index,item] of parts.entries())')
room = room.replace("?label:''", "?String(index+1)+' · '+label:String(index+1)", 1)
room = room.replace("line.textContent=clock(Math.round(item.start))", "line.textContent=String(index+1)+' · '+clock(Math.round(item.start))", 1)
room = room.replace('#campus-room-panel h3{', '#campus-room-panel h3{color:var(--campus-accent,#172e61)!important;')
room = room.replace('refresh();setInterval(refresh,1000);', "refresh();let timer=setInterval(refresh,1000);window.addEventListener('ams-ios-active',e=>{clearInterval(timer);timer=null;if(e.detail){refresh();timer=setInterval(refresh,1000)}});")
seat=(ASSETS/'library-seat-ui.js').read_text(encoding='utf-8')
seat=seat.replace("  window.addEventListener('pagehide'", "  window.addEventListener('ams-ios-active',e=>{clearInterval(timer);timer=null;if(e.detail){refresh();timer=setInterval(refresh,1000)}});\n  window.addEventListener('pagehide'",1)
(ASSETS/'library-seat-ui.js').write_text(seat,encoding='utf-8')
records=(ASSETS/'reservation-records-ui.js').read_text(encoding='utf-8')
records=records.replace('refresh();setInterval(refresh,700);', "refresh();let timer=setInterval(refresh,700);window.addEventListener('ams-ios-active',e=>{clearInterval(timer);timer=null;if(e.detail){refresh();timer=setInterval(refresh,700)}});",1)
(ASSETS/'reservation-records-ui.js').write_text(records,encoding='utf-8')
room = room.replace("segment.disabled=item.kind!=='free'||item.end-item.start<c.config.resvRule.minResvTime;","segment.disabled=false;",1)
click_start=room.index('segment.onclick=()=>{')
click_end=room.index(';strip.append(segment)',click_start)
room=room[:click_start]+"segment.onclick=()=>{chosen=String(c.resInfo.devId);panel.querySelector('.room-select').value=chosen;fill();const start=Math.ceil(item.start/5)*5,end=Math.min(Math.floor(item.end/5)*5,start+Math.max(30,c.config.resvRule.minResvTime));panel.querySelector('.room-start').value=clock(start);panel.querySelector('.room-end').value=clock(end);update();const note=panel.querySelector('.room-feedback');note.textContent=segment.title+'。'+note.textContent;}"+room[click_end:]
room=room.replace('detail.append(line)',"line.setAttribute('role','button');line.tabIndex=0;line.onclick=()=>strip.children[index].click();line.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();line.click()}};detail.append(line)",1)
room=room.replace('font-size:12px;border-radius:6px;padding:4px 6px','font-size:13px;min-height:44px;display:flex;align-items:center;border-radius:6px;padding:6px 8px',1)
room=room.replace('#campus-room-welcome h3{', '#campus-room-welcome h3{color:var(--campus-ink,#17233a)!important;',1)
(ASSETS / 'library-room-ui.js').write_text(room,encoding='utf-8')
theme=(ASSETS/'reservation-theme.css').read_text(encoding='utf-8')
theme+=Path(__file__).with_name('records-layout.css').read_text(encoding='utf-8')
theme+='\n:is(#campus-seat-home,#campus-seat-panel,#campus-room-welcome,#campus-room-panel) h3{color:var(--campus-ink)!important}\n'
(ASSETS/'reservation-theme.css').write_text(theme,encoding='utf-8')

record_style=records.split('style.textContent=`',1)[1].split('`;',1)[0]
record_markup='<section id="campus-records-panel"><div class="record-filter"><div class="record-dates"><label>开始日期<input type="date" value="2026-10-09"></label><label>结束日期<input type="date" value="2026-10-16"></label></div></div></section>'
(ASSETS/'ios-records-preview.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+record_style+theme+'</style><body class="campus-records-managed"><main style="margin:16px"><h3>座位预约</h3>'+record_markup+'<h3>讨论室预约</h3>'+record_markup+'</main></body>',encoding='utf-8')

script = (ASSETS / 'ams-modern-ui.js').read_text(encoding='utf-8')
# Modify the serialized iframe documents, keeping Android's generated asset untouched.
import re
def ios_document(match):
    document = json.loads(match.group(0))
    if 'function renderSettings(screen){' not in document:
        return match.group(0)
    # Shared sports entry now opens the dedicated native iOS container.
    document = document.replace('<button class="settings-row" id="checkUpdateBtn"><span>检查更新</span><span aria-hidden="true">›</span></button>', '')
    document = document.replace("document.getElementById('checkUpdateBtn').onclick=()=>send('checkUpdate');", '')
    # Reuse the original document's CSS, symbols and chrome rather than approximating it in UIKit.
    styles = ''.join(re.findall(r'<style[^>]*>([\s\S]*?)</style>',document))
    header = re.search(r'<header[\s\S]*?</header>',document).group(0)
    symbols = ''.join(re.findall(r'<svg[^>]*>[\s\S]*?<symbol[\s\S]*?</svg>',document))
    chrome = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+Path(__file__).with_name('chrome.css').read_text(encoding='utf-8')+'</style><body>'+symbols+'<div class="app">'+header+'</div><script>'+Path(__file__).with_name('chrome.js').read_text(encoding='utf-8')+'</script></body></html>'
    (ASSETS/'ios-chrome.html').write_text(chrome,encoding='utf-8')
    document = document.replace('function renderSettings(screen){screen.innerHTML=`', 'function renderSettings(screen){screen.innerHTML=`<button class="return" id="iosSettingsBack" aria-label="返回课表">‹ 返回课表</button>', 1)
    document = document.replace("document.getElementById('logoutBtn').onclick", "document.getElementById('iosSettingsBack').onclick=()=>{settingsOpen=false;render();};document.getElementById('logoutBtn').onclick", 1)
    document = document.replace("const ended=isPast?all", "document.getElementById('homeScreen').classList.toggle('ios-empty-day',!!valid&&all.length===0);const ended=isPast?all",1)
    document = document.replace("el.textContent=dailyRows[((day*7919)%dailyRows.length+dailyRows.length)%dailyRows.length].text;", "let saved;try{saved=JSON.parse(localStorage.getItem('ios.dailySelection')||'null')}catch{};el.textContent=saved?.date===key?saved.text:dailyRows[((day*7919)%dailyRows.length+dailyRows.length)%dailyRows.length].text;try{localStorage.setItem('ios.dailySelection',JSON.stringify({date:key,text:el.textContent}))}catch{};")
    document = document.replace("fetch('https://ams.xjtlu.edu.cn/__campus/daily-lines.json')", "Promise.resolve({ok:true,json:()=>Promise.resolve(parent.__amsDailyRows)})")
    document = document.replace('</style>', Path(__file__).with_name('interface.css').read_text(encoding='utf-8') + '</style>', 1)
    assert document.count('setInterval(refreshClock,1000);') == 1, 'Review the shared clock lifecycle hook.'
    document = document.replace('setInterval(refreshClock,1000);', Path(__file__).with_name('foreground-clock.js').read_text(encoding='utf-8'),1)
    document = document.replace('function render(){', Path(__file__).with_name('interface.js').read_text(encoding='utf-8') + '\nfunction render(){', 1)
    document = document.replace(";screen.querySelectorAll('[data-appearance]')", ";iosGroupSettings(screen);screen.querySelectorAll('[data-appearance]')",1)
    document = document.replace('正在读取课表…', '正在加载课表…')
    document = re.sub(r'AMS 校园助手 · 0\.\d+\.\d+', 'AMS 校园助手 · iOS 0.2.0', document)
    document = document.replace('if(home){renderHome();return;}', 'if(home){renderHome();iosUpdateChrome(route);return;}',1)
    document = document.replace("for(const [id,field] of [['groupFilter'", "iosUpdateChrome(route);for(const [id,field] of [['groupFilter'",1)
    document = document.replace('function render(){', Path(__file__).with_name('motion.js').read_text(encoding='utf-8') + '\nfunction render(){', 1)
    document = document.replace('const changed=lastRenderedRoute!==route;', 'const previousRoute=lastRenderedRoute;const changed=lastRenderedRoute!==route;', 1)
    old_motion = "if(changed){requestAnimationFrame(()=>window.scrollTo(0,scrollPositions[route]||0));const panel=document.getElementById(home?'homeScreen':'otherScreen');panel.classList.remove('screen-enter');void panel.offsetWidth;panel.classList.add('screen-enter');panel.onanimationend=()=>panel.classList.remove('screen-enter');}"
    assert old_motion in document, 'Shared navigation motion changed; review the iOS adapter.'
    document = document.replace(old_motion, "if(changed){requestAnimationFrame(()=>{if(lastRenderedRoute!==route)return;window.scrollTo(0,scrollPositions[route]||0);window.__amsIosAnimateRoute(document.getElementById(home?'homeScreen':'otherScreen'),previousRoute,route);});}", 1)
    for map_name, map_mime in [('sip.png','image/png'),('tc.jpg','image/jpeg')]:
        map_data=base64.b64encode((ANDROID/'maps'/map_name).read_bytes()).decode()
        document=document.replace('/__campus/maps/'+map_name,'data:'+map_mime+';base64,'+map_data)
    # Offline, anonymous layout preview; no school requests or real records.
    preview_document=document.replace('</html>','<script>'+Path(__file__).with_name('preview-layout.js').read_text(encoding='utf-8')+'</script></html>')
    (ASSETS/'ios-preview-content.html').write_text(preview_document,encoding='utf-8')
    preview = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden}iframe{position:fixed;inset:0;border:0;width:100%;height:100%}</style><iframe id="ams-managed-ui" src="ios-preview-content.html"></iframe><script src="ios-preview.js"></script>'
    (ASSETS/'ios-preview.js').write_text("""(() => {
      const frame=document.querySelector('iframe');
      const snapshot=route=>({route,list:[],days:[],ready:true,loading:false,leave:true});
      window.addEventListener('message',e=>{if(e.source!==frame.contentWindow)return;if(e.data?.amsIosChrome)window.webkit.messageHandlers.amsChrome.postMessage(e.data.amsIosChrome);if(typeof e.data?.amsIosModal==='boolean')window.webkit.messageHandlers.amsModal.postMessage(e.data.amsIosModal);const route={home:'/home',records:'/course',leave:'/leave'}[e.data?.amsUiAction];if(route)frame.contentWindow.postMessage({amsUiData:snapshot(route)},'*')});
      window.__amsSetInsets=insets=>frame.contentWindow.postMessage({amsUiData:{insets}},'*');
      window.__amsSetAppearance=(appearance,dark)=>frame.contentWindow.postMessage({amsUiData:{appearance,dark}},'*');
      frame.onload=()=>{const n=new Date(),date=String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');frame.contentWindow.postMessage({amsUiData:{route:'/home',days:[{date,timetableVoList:[]}],ready:true,loading:false,leave:true,prefetched:{'/home':snapshot('/home'),'/course':snapshot('/course'),'/leave':snapshot('/leave')}}},'*');setTimeout(()=>frame.contentWindow.postMessage({iosMeasure:true},'*'),500)};
    })();""",encoding='utf-8')
    (ASSETS/'ios-preview.html').write_text(preview,encoding='utf-8')
    review=ROOT/'outputs/ams-activation-tencent/public/review'
    if not IOS_ONLY:
        review.mkdir(parents=True,exist_ok=True)
    # FB uses the real school's separate site; do not advertise it as a review-demo flow.
    review_document=document.replace("['fb','FB 讨论室（SIP）','进入「静音仓」板块选择 FB 座位'],", '', 1)
    review_document=review_document.replace("else if(route==='/settings')", "else if(route.startsWith('/review/'))renderReviewScreen(screen);else if(route==='/settings')",1)
    # The review bridge routes sports into an isolated server-backed demonstration.
    review_document=review_document.replace('page=data;screens[data.route]=data;',"page=data;if(data.route.startsWith('/review/')){reservationsOpen=false;settingsOpen=false;mapsOpen=false;}screens[data.route]=data;",1)
    review_document=review_document.replace("['INPUT','TEXTAREA','SELECT'].includes(focused.tagName)","['INPUT','TEXTAREA'].includes(focused.tagName)&&focused.type!=='file'")
    review_document=review_document.replace('支持 JPG、PNG、PDF、ZIP、RAR，单个文件不超过 10 MB。','演示附件支持 JPG、PNG、PDF，单个文件不超过 900 KB。').replace('请输入签到码','演示签到码：123456')
    review_document=review_document.replace('parent.__amsDailyRows',"[{text:'今天也要好好照顾自己。'}]")
    review_document=review_document.replace("${Number(c.status)===2?'已完成':'待处理'}", "${c.cancelled?'已撤回':Number(c.status)===2?'已完成':'待处理'}")
    review_document=review_document.replace("if(!button)return;","if(!button||button.matches('.review-seat'))return;",1)
    review_document=review_document.replace('<script>','<script>'+Path(__file__).with_name('review-screens.js').read_text(encoding='utf-8')+'\n'+Path(__file__).with_name('review-reminder-screen.js').read_text(encoding='utf-8')+'\n',1)
    review_document=review_document.replace('</header>','</header><p class="form-notice">演示环境 · 数据仅保存在演示服务器</p>',1)
    assert '</style>' in review_document, 'Review styles require an existing style block'
    review_document=review_document.replace('</style>','.review-seat-map{display:block;overflow:auto;height:420px;margin:16px 0;background:var(--paper);border:1px solid var(--line);border-radius:12px}.review-seat-plan{position:relative;width:2670px;height:2004px}.review-seat{position:absolute;transform:translate(-50%,-50%);width:26px;min-height:26px;height:26px;padding:0;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);font-size:10px}.review-seat[aria-pressed=true]{background:var(--campus-blue);color:white}#reviewBook input,#reviewBook select{box-sizing:border-box;min-width:0;max-width:100%}.review-back{display:block!important}</style>',1)
    review_index='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden}iframe{position:absolute;inset:0;border:0;width:100%;height:100%}#error{position:absolute;inset:25%;font:16px system-ui;background:white;padding:20px}</style><iframe id="ams-managed-ui" src="/api/demo/assets/content.html" title="校园助手演示"></iframe><div id="error" hidden><p id="errorText"></p><button id="errorRetry">重新加载演示</button></div><script src="/api/demo/assets/bridge.js"></script></html>'
    if not IOS_ONLY:
        (review/'content.html').write_text(review_document,encoding='utf-8')
        shutil.copy2(Path(__file__).with_name('review-bridge.js'),review/'bridge.js')
        (review/'index.html').write_text(review_index,encoding='utf-8')
    policy='<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src file: &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; img-src file: data: blob:; font-src file: data:; frame-src file:; connect-src &#39;none&#39;; form-action &#39;none&#39;">'
    (ASSETS/'review-content.html').write_text(review_document.replace('<head>','<head>'+policy,1),encoding='utf-8')
    shutil.copy2(Path(__file__).with_name('review-bridge.js'),ASSETS/'review-bridge.js')
    (ASSETS/'review-index.html').write_text(review_index.replace('<meta charset',policy+'<meta charset',1).replace('/api/demo/assets/content.html','review-content.html').replace('/api/demo/assets/bridge.js','review-bridge.js'),encoding='utf-8')
    return json.dumps(document, ensure_ascii=False)
script = re.sub(r'"(?:[^"\\]|\\.)*"', ios_document, script)
# Give the adapted iframe sole ownership of scrolling.
script=script.replace('html.ams-owned body>*:not', 'html.ams-owned,html.ams-owned body{height:100%;overflow:hidden!important}html.ams-owned body>*:not',1)
script=script.replace(' setInterval(refresh,200);refresh();', " let iosRefreshTimer=setInterval(refresh,200);window.addEventListener('ams-ios-active',e=>{clearInterval(iosRefreshTimer);if(e.detail){refresh();iosRefreshTimer=setInterval(refresh,200)}});refresh();",1)
for name, mime in [('sip.png', 'image/png'), ('tc.jpg', 'image/jpeg')]:
    data = base64.b64encode((ANDROID / 'maps' / name).read_bytes()).decode()
    script = script.replace('/__campus/maps/' + name, 'data:' + mime + ';base64,' + data)
(ASSETS / 'ams-modern-ui.js').write_text(script, encoding='utf-8')
daily = json.loads((ANDROID / 'daily-lines.json').read_text(encoding='utf-8'))
bootstrap = """(() => {
 if(location.protocol !== 'https:' || location.hostname !== 'ams.xjtlu.edu.cn') return;
 window.__amsNativeNavigation = true;
 window.addEventListener('message',e=>{const frame=document.getElementById('ams-managed-ui');if(e.source!==frame?.contentWindow)return;if(e.data?.amsIosChrome)window.webkit?.messageHandlers.amsChrome.postMessage(e.data.amsIosChrome);if(typeof e.data?.amsIosModal==='boolean')window.webkit?.messageHandlers.amsModal.postMessage(e.data.amsIosModal);});
 window.__amsInsets = {top:0,bottom:0};
 window.__amsAppearance = {appearance:'system',dark:matchMedia('(prefers-color-scheme: dark)').matches};
 window.__amsDailyRows = window.__amsRemoteDaily || DAILY;
 const originalFetch = window.fetch.bind(window);
 window.fetch = (input, init) => {
   const target = new URL(input instanceof Request ? input.url : String(input), location.href);
   if(target.origin === location.origin && target.pathname === '/__campus/daily-lines.json')
     return Promise.resolve(new Response(JSON.stringify(window.__amsDailyRows),{headers:{'Content-Type':'application/json'}}));
   return originalFetch(input,init);
 };
})();""".replace('DAILY', json.dumps(daily, ensure_ascii=False))
(ASSETS / 'ios-bootstrap.js').write_text(bootstrap, encoding='utf-8')
info = {'CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)', 'CFBundleExecutable':'$(EXECUTABLE_NAME)', 'CFBundleName':'AMS', 'CFBundleDisplayName':'AMS 校园助手', 'CFBundlePackageType':'APPL', 'CFBundleShortVersionString':'0.2.0', 'CFBundleVersion':'7', 'LSRequiresIPhoneOS':True, 'ITSAppUsesNonExemptEncryption':False, 'UILaunchScreen':{}, 'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait'], 'NSCameraUsageDescription':'用于扫描课程签到二维码', 'CFBundleDevelopmentRegion':'zh_CN'}
info['UIApplicationSceneManifest'] = {'UIApplicationSupportsMultipleScenes':False, 'UISceneConfigurations':{'UIWindowSceneSessionRoleApplication':[{'UISceneConfigurationName':'AMS','UISceneDelegateClassName':'$(PRODUCT_MODULE_NAME).SceneDelegate'}]}}
# REMIND-001 course reminder Live Activities (Dynamic Island / lock screen).
info['NSSupportsLiveActivities'] = True
# Live Activity "扫码签到" opens amscampus://scan.
info['CFBundleURLTypes'] = [{'CFBundleURLName':'cn.xjtlu.ams.ios.shortcut','CFBundleURLSchemes':['amscampus']}]
(APP / 'Info.plist').write_bytes(plistlib.dumps(info))
extension_info = {key: info[key] for key in ['CFBundleIdentifier','CFBundleExecutable','CFBundleShortVersionString','CFBundleVersion','CFBundleDevelopmentRegion']}
extension_info.update({'CFBundleName':'AMSLiveActivity','CFBundleDisplayName':'AMS 课程提醒','CFBundlePackageType':'XPC!','NSExtension':{'NSExtensionPointIdentifier':'com.apple.widgetkit-extension'}})
(APP / 'LiveActivity' / 'Info.plist').write_bytes(plistlib.dumps(extension_info))
# Push for Live Activities; Release must use a distribution profile that includes Push Notifications.
for name, environment in [('AMS-Debug.entitlements','development'),('AMS-Release.entitlements','production')]:
    (APP / name).write_bytes(plistlib.dumps({'aps-environment':environment}))
# Local simulator signing identity only; device distribution uses the real team's profile.
(APP / 'Simulator.entitlements').write_bytes(plistlib.dumps({'application-identifier':'cn.xjtlu.ams.ios','keychain-access-groups':['cn.xjtlu.ams.ios']}))
# Stable IDs keep regenerated projects reviewable.
objects = []
counter = 0
def add(kind, contents):
    global counter
    counter += 1
    identifier = f'{counter:024X}'
    objects.append((identifier, f'isa = {kind}; {contents}'))
    return identifier
def sources_in(folder):
    return sorted((APP / folder).glob('*.swift'))
def source_refs(folder):
    return [add('PBXFileReference', f'lastKnownFileType = sourcecode.swift; path = "{folder}/{source.name}"; sourceTree = "<group>";') for source in sources_in(folder)]
files = source_refs('Sources')
builds = [add('PBXBuildFile', f'fileRef = {ref};') for ref in files]
# Shared/ is compiled into both the app and the Live Activity extension.
shared = source_refs('Shared')
builds += [add('PBXBuildFile', f'fileRef = {ref};') for ref in shared]
extension_files = source_refs('LiveActivity')
extension_builds = [add('PBXBuildFile', f'fileRef = {ref};') for ref in extension_files+shared]
resource = add('PBXFileReference', 'lastKnownFileType = folder; path = Assets; sourceTree = "<group>";')
resource_build = add('PBXBuildFile', f'fileRef = {resource};')
icon_resource = add('PBXFileReference', 'lastKnownFileType = folder.assetcatalog; path = AppAssets.xcassets; sourceTree = "<group>";')
icon_build = add('PBXBuildFile', f'fileRef = {icon_resource};')
privacy_ref = add('PBXFileReference', 'lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>";')
privacy_build = add('PBXBuildFile', f'fileRef = {privacy_ref};')
product = add('PBXFileReference', 'explicitFileType = wrapper.application; path = AMS.app; sourceTree = BUILT_PRODUCTS_DIR;')
extension_product = add('PBXFileReference', 'explicitFileType = "wrapper.app-extension"; path = AMSLiveActivity.appex; sourceTree = BUILT_PRODUCTS_DIR;')
embed_build = add('PBXBuildFile', f'fileRef = {extension_product}; settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }};')
products = add('PBXGroup', f'children = ({product},{extension_product},); name = Products; sourceTree = "<group>";')
group = add('PBXGroup', f'children = ({",".join(files+shared+extension_files+[resource, icon_resource, privacy_ref, products])},); sourceTree = "<group>";')
sources = add('PBXSourcesBuildPhase', f'buildActionMask = 2147483647; files = ({",".join(builds)},); runOnlyForDeploymentPostprocessing = 0;')
resources = add('PBXResourcesBuildPhase', f'buildActionMask = 2147483647; files = ({resource_build},{icon_build},{privacy_build},); runOnlyForDeploymentPostprocessing = 0;')
frameworks = add('PBXFrameworksBuildPhase', 'buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
embed = add('PBXCopyFilesBuildPhase', f'buildActionMask = 2147483647; dstPath = ""; dstSubfolderSpec = 13; files = ({embed_build},); name = "Embed Foundation Extensions"; runOnlyForDeploymentPostprocessing = 0;')
extension_sources = add('PBXSourcesBuildPhase', f'buildActionMask = 2147483647; files = ({",".join(extension_builds)},); runOnlyForDeploymentPostprocessing = 0;')
extension_frameworks = add('PBXFrameworksBuildPhase', 'buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
base = 'SDKROOT = iphoneos; ALWAYS_SEARCH_USER_PATHS = NO; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1";'
settings = 'SDKROOT = iphoneos; ALWAYS_SEARCH_USER_PATHS = NO; IPHONEOS_DEPLOYMENT_TARGET = 17.0; SWIFT_VERSION = 5.0; PRODUCT_BUNDLE_IDENTIFIER = cn.xjtlu.ams.ios; PRODUCT_NAME = AMS; INFOPLIST_FILE = Info.plist; TARGETED_DEVICE_FAMILY = "1"; SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD = NO; SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD = NO; CODE_SIGN_STYLE = Automatic; ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_ENTITLEMENTS = "AMS-Debug.entitlements";'
release_settings = settings.replace('CODE_SIGN_STYLE = Automatic;', 'CODE_SIGN_STYLE = Manual; DEVELOPMENT_TEAM = 6F3GZ46T3L; CODE_SIGN_IDENTITY = "Apple Distribution"; PROVISIONING_PROFILE_SPECIFIER = "AMS App Store Distribution";').replace('AMS-Debug.entitlements','AMS-Release.entitlements')
extension_settings = base + ' PRODUCT_BUNDLE_IDENTIFIER = cn.xjtlu.ams.ios.LiveActivity; PRODUCT_NAME = AMSLiveActivity; INFOPLIST_FILE = LiveActivity/Info.plist; SKIP_INSTALL = YES; APPLICATION_EXTENSION_API_ONLY = YES; LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"; CODE_SIGN_STYLE = Automatic;'
extension_release = extension_settings.replace('CODE_SIGN_STYLE = Automatic;', 'CODE_SIGN_STYLE = Manual; DEVELOPMENT_TEAM = 6F3GZ46T3L; CODE_SIGN_IDENTITY = "Apple Distribution"; PROVISIONING_PROFILE_SPECIFIER = "AMS LiveActivity App Store Distribution";')
variants = [('Debug','-Onone','DEBUG'),('Release','-O','')]
def configuration_list(debug, release, extra=''):
    configs = [add('XCBuildConfiguration', f'buildSettings = {{{debug if name == "Debug" else release} SWIFT_ACTIVE_COMPILATION_CONDITIONS = "{(condition+" "+extra).strip()}"; SWIFT_OPTIMIZATION_LEVEL = "{opt}";}}; name = {name};') for name, opt, condition in variants]
    return add('XCConfigurationList', f'buildConfigurations = ({",".join(configs)},); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
configlist = configuration_list(settings, release_settings, 'AMS_APP')
extension_configlist = configuration_list(extension_settings, extension_release)
project_configlist = configuration_list(base, base)
extension_target = add('PBXNativeTarget', f'buildConfigurationList = {extension_configlist}; buildPhases = ({extension_sources},{extension_frameworks},); buildRules = (); dependencies = (); name = AMSLiveActivity; productName = AMSLiveActivity; productReference = {extension_product}; productType = "com.apple.product-type.app-extension";')
project = f'{counter + 4:024X}'  # proxy, dependency and app target come first
proxy = add('PBXContainerItemProxy', f'containerPortal = {project}; proxyType = 1; remoteGlobalIDString = {extension_target}; remoteInfo = AMSLiveActivity;')
dependency = add('PBXTargetDependency', f'target = {extension_target}; targetProxy = {proxy};')
target = add('PBXNativeTarget', f'buildConfigurationList = {configlist}; buildPhases = ({sources},{frameworks},{resources},{embed},); buildRules = (); dependencies = ({dependency},); name = AMS; productName = AMS; productReference = {product}; productType = "com.apple.product-type.application";')
assert add('PBXProject', f'attributes = {{LastUpgradeCheck = 2700;}}; buildConfigurationList = {project_configlist}; compatibilityVersion = "Xcode 14.0"; developmentRegion = zh_CN; hasScannedForEncodings = 0; knownRegions = (zh_CN,en,Base); mainGroup = {group}; productRefGroup = {products}; projectDirPath = ""; projectRoot = ""; targets = ({target},{extension_target},);') == project
directory = APP / 'AMS.xcodeproj'
directory.mkdir(exist_ok=True)
(directory / 'project.pbxproj').write_text('// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n' + '\n'.join(f'{key} = {{ {value} }};' for key,value in objects) + f'\n}}; rootObject = {project}; }}\n', encoding='utf-8')
print('Prepared iOS assets and Xcode project')
