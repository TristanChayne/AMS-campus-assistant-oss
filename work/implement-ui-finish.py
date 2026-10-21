from pathlib import Path
import json
p=Path('work/build-live-ui.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace("body=body.replace('<div class=\"date-head\">'", "body=body.replace('</header>', '</header><p id=\"dailyLine\" class=\"daily-line\" hidden></p>')\nbody=body.replace('<div class=\"date-head\">'")
s=s.replace("if(changed){window.scrollTo(0,scrollPositions[route]||0);", "if(changed){requestAnimationFrame(()=>window.scrollTo(0,scrollPositions[route]||0));")
s=s.replace("const remaining=all.filter(x=>!ended.includes(x));const next=remaining.find(x=>times(x.c));", "const remaining=all.filter(x=>!ended.includes(x));const next=remaining.find(x=>times(x.c));")
s=s.replace("remaining.map(x=>card(x.c,x.i)).join('')", "remaining.filter(x=>!(active&&x===next)).map(x=>card(x.c,x.i)).join('')")
# Keep a compact explanation when the ongoing course is already shown in the hero.
s=s.replace("document.getElementById('lessons').innerHTML=remaining.length?", "const following=remaining.filter(x=>!(active&&x===next));document.getElementById('lessons').innerHTML=following.length?")
s=s.replace("all.length?'今天的课都结束了':'当天没有课程'", "active?'当前课程见上方':all.length?'今天的课都结束了':'当天没有课程'")
s=s.replace("all.length?'今天辛苦了。':'学校返回的课表为空。'", "active?'之后没有其他课程了。':all.length?'今天辛苦了。':'享受自由安排的一天。'")
s=s.replace("document.getElementById('listTitle').textContent=selected===0?'接下来的课'", "document.getElementById('listTitle').textContent=selected===0?(active?'之后的课':'接下来的课')")
s=s.replace("document.getElementById('homeScreen').hidden=!home;", "document.getElementById('dailyLine').hidden=!home||!document.getElementById('dailyLine').textContent;document.querySelector('nav').hidden=!['/home','/course','/leave'].includes(route);document.getElementById('settingsBtn').hidden=!['/home','/course','/leave'].includes(route);document.querySelector('.app').classList.toggle('focused-flow',!['/home','/course','/leave'].includes(route));document.getElementById('homeScreen').hidden=!home;")
lines=s.splitlines()
for i,line in enumerate(lines):
 if "else if(route==='/signCodeSuccess')screen.innerHTML" in line:lines[i]=" else if(route==='/signCodeSuccess')renderSignResult(screen,true);"
 if "else if(route==='/signCodeFail')screen.innerHTML" in line:lines[i]=" else if(route==='/signCodeFail')renderSignResult(screen,false);"
s='\n'.join(lines)+'\n'
s=s.replace('提交后由学校验证，以返回结果为准。','核对后提交签到。').replace('输入老师提供的 code','请输入签到码').replace('正在读取学校记录…','正在加载…').replace('学校返回的课程记录为空','暂时没有课程记录').replace('学校 Code 签到页面尚未就绪，请稍后重试','签到页面尚未就绪，请稍后重试').replace('暂未获取到数据，不代表当天没有课。','稍等片刻，课表正在加载。').replace('学校签到处理发生异常，请先查看签到记录，避免重复提交','提交发生异常，请先查看签到记录，避免重复提交')
s=s.replace("let vueRoot=null;", "window.__amsHandleBack=()=>!!(frame&&frame.style.display!=='none'&&frame.contentWindow.__amsHandleBack&&frame.contentWindow.__amsHandleBack());\n let vueRoot=null;")
s=s.replace('0.11.4','0.12.0');p.write_text(s,encoding='utf-8')
p=Path('work/managed-leave-child.js');s=p.read_text(encoding='utf-8-sig').replace('填写申请后由学校审核。','提交申请后等待审核。').replace('课程范围和可选状态由学校提供','可以调整日期后再试').replace('日期范围由学校提供','请选择请假起止日期').replace('提交后以学校审核结果为准。','提交后可在请假记录中查看进度。').replace('学校统计的所有课程综合数据','所有课程的综合统计').replace('正在读取学校综合统计','正在加载综合统计').replace('学校出勤预警','出勤预警');s=s.replace('style="height:${valid?n:0}%"','style="width:${valid?n:0}%"')
s+='''
function renderSignResult(screen,success){const info=page.signInfo||{},scan=page.signMethod==='scan';screen.innerHTML=`<section class="sign-result ${success?'':'failed'}"><div class="result-symbol"><svg viewBox="0 0 40 40" aria-hidden="true">${success?'<path d="M9 19l7 7 15-16"/>':'<path d="M20 10v12m0 6v1"/>'}</svg></div><h2>${success?'签到成功':'签到未完成'}</h2><p class="result-message">${success?'这节课已完成签到。':escape(page.reason||'暂未完成签到，请重试。')}</p>${success?`<section class="result-receipt"><small>${escape(info.moudleCode||info.moduleCode||'')}</small><h3>${escape(info.moudleTitle||info.moduleTitle||'')}</h3><dl>${[['上课时间',info.moduleTime?displayTime(info):''],['教室',info.room],['签到方式',scan?'扫码签到':'Code 签到'],['签到时间',info.signTime]].filter(x=>x[1]).map(([label,value])=>`<div><dt>${label}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl></section>`:''}<div class="result-actions"><button class="form-submit" id="${success?'backHome':'retryCode'}">${success?'返回课表':scan?'重新扫码':'重新输入'}</button>${success?'':'<button class="result-back" id="backHome">返回课表</button>'}</div></section>`;}
window.__amsHandleBack=()=>{const sheet=document.getElementById('sheet');if(sheet.open){sheet.close();return true;}if(settingsOpen){settingsOpen=false;render();return true;}const route=page.route||'/home';if(route==='/home')return false;if(route==='/leaveApplication'){show('<h2>离开请假申请？</h2><p>未提交的内容可能不会保留。</p><button id="discardLeave" class="form-submit">离开申请</button>');document.getElementById('discardLeave').onclick=()=>{sheet.close();navigate('/leave','leave');};return true;}if(route==='/leaveCourse'){send('backLeaveForm');return true;}if(route==='/course/sessions'){navigate('/course','records');return true;}navigate('/home','home');return true;};
let dailyKey='',dailyRows=null;
function updateDailyLine(){const el=document.getElementById('dailyLine');if(!el||!dailyRows)return;const now=new Date(),key=[now.getFullYear(),now.getMonth()+1,now.getDate()].join('-');if(key!==dailyKey){dailyKey=key;const day=Math.floor(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())/86400000);el.textContent=dailyRows[((day*7919)%dailyRows.length+dailyRows.length)%dailyRows.length].text;}el.hidden=page.route!=='/home'||settingsOpen;}
if(typeof fetch==='function')fetch('https://ams.xjtlu.edu.cn/__campus/daily-lines.json').then(r=>{if(!r.ok)throw Error('quotes');return r.json();}).then(rows=>{dailyRows=rows.filter(x=>typeof x.text==='string'&&x.text.length<=54);if(dailyRows.length)updateDailyLine();}).catch(()=>{});
setInterval(updateDailyLine,60000);
''';p.write_text(s,encoding='utf-8')
p=Path('work/managed-ui-polish.css');s=p.read_text(encoding='utf-8-sig');s+='''
.daily-line{font-size:13px;line-height:1.7;color:var(--pencil);margin:-8px 0 24px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.daily-line[hidden],nav[hidden],.settings-button[hidden]{display:none!important}.focused-flow{padding-bottom:28px}.eyebrow{font-size:11px}.attendance-ring small,.attendance-stats span,.course-code,.form-help{font-size:12px}.return,.result-back{min-height:44px}.overall-track{height:5px;width:100%;display:block;align-self:auto}.overall-track i{height:100%;display:block}.attendance-overview{gap:14px}.sign-result{text-align:center;padding-top:24px}.result-symbol{width:82px;height:82px;border-radius:28px;background:#e7f2ec;color:#327b65;display:grid;place-items:center;margin:0 auto 22px}.result-symbol svg{width:36px;height:36px;stroke-width:2.2}.failed .result-symbol{background:#f7ede4;color:#ad673d}.sign-result h2{font-size:25px;font-weight:650;margin:0 0 10px}.result-message{font-size:13px;line-height:1.8;color:var(--pencil);margin:0 auto 27px;max-width:290px;overflow-wrap:anywhere}.result-receipt{text-align:left;border:1px solid var(--line);border-radius:17px;background:#ffffffa6;padding:19px 20px}.result-receipt small{font-size:12px;color:var(--pencil)}.result-receipt h3{font-size:15px;font-weight:550;line-height:1.55;margin:7px 0 18px}.result-receipt dl{border-top:1px solid var(--line);padding-top:12px;margin:0}.result-receipt dl div{display:flex;justify-content:space-between;gap:16px;font-size:13px;margin:9px 0}.result-receipt dt{color:var(--pencil)}.result-receipt dd{margin:0;text-align:right;overflow-wrap:anywhere}.result-actions{margin-top:32px}.result-back{margin:8px auto 0;display:block;background:none;color:var(--pencil);font-size:13px}.result-receipt h3,.result-receipt dd,.daily-line{-webkit-user-select:text;user-select:text;-webkit-touch-callout:default}@media(prefers-reduced-motion:no-preference){.result-symbol path{stroke-dasharray:70;animation:result-check 400ms ease-out}@keyframes result-check{from{stroke-dashoffset:70}to{stroke-dashoffset:0}}}
''';p.write_text(s,encoding='utf-8')
assets=Path('outputs/ams-android/app/src/main/assets');rows=json.loads(Path('outputs/daily-lines/每日一句-20000条草稿.json').read_text(encoding='utf-8'));(assets/'daily-lines.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
p=Path('outputs/ams-android/app/src/main/java/cn/local/ams/MainActivity.java');s=p.read_text(encoding='utf-8');s=s.replace('''            @Override public void onReceivedSslError''','''            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if ("https".equals(uri.getScheme()) && "ams.xjtlu.edu.cn".equals(uri.getHost()) && "/__campus/daily-lines.json".equals(uri.getPath())) {
                    try { return new WebResourceResponse("application/json", "UTF-8", getAssets().open("daily-lines.json")); }
                    catch (IOException e) { return null; }
                }
                return super.shouldInterceptRequest(view, request);
            }
            @Override public void onReceivedSslError''')
s=s.replace('''        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();''','''        if (web == null) { super.onBackPressed(); return; }
        web.evaluateJavascript("Boolean(window.__amsHandleBack && window.__amsHandleBack())", handled -> {
            if (isFinishing() || isDestroyed() || "true".equals(handled)) return;
            if (web.canGoBack()) web.goBack(); else MainActivity.super.onBackPressed();
        });''');p.write_text(s,encoding='utf-8')
for name in ['outputs/ams-android/build-local.ps1','outputs/ams-android/app/build.gradle']:
 p=Path(name);s=p.read_text(encoding='utf-8-sig').replace('0.11.4','0.12.0').replace("'--version-code','23'","'--version-code','24'").replace('versionCode 23','versionCode 24');p.write_text(s,encoding='utf-8-sig' if name.endswith('.ps1') else 'utf-8')
