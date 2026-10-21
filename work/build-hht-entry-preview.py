from pathlib import Path

source = Path('work/live-ui.html').read_text(encoding='utf-8')
out = Path('outputs/hht-entry-preview')
out.mkdir(parents=True, exist_ok=True)
style = '''<style>
.app{max-width:430px!important;margin:0 auto!important}header{margin-bottom:16px!important}nav{max-width:390px!important}body{background:#e7ebf1!important}.hht-entry{width:100%;display:flex;align-items:center;gap:13px;text-align:left;background:var(--lecture-wash);border:1px solid var(--line);border-radius:16px;padding:11px 14px;margin-bottom:14px;min-height:64px}
.hht-symbol{display:grid;place-items:center;width:43px;height:43px;border-radius:12px;background:var(--campus-blue);color:white;flex-shrink:0}.hht-symbol svg{width:25px;height:25px}
.hht-label{flex:1}.hht-label b{display:block;font-size:16px;font-weight:650}.hht-label small{display:block;margin-top:5px;color:var(--pencil);font-size:12px}.hht-go{font-size:12px;color:var(--room-blue);display:flex;align-items:center;gap:7px}
.hht-preview-note{text-align:center;font-size:11px;color:var(--pencil);margin:0 0 14px}.hht-setup{border:1px dashed var(--line);border-radius:15px;padding:24px 14px;text-align:center;margin:20px 0}.hht-setup svg{width:44px;height:44px;color:var(--room-blue)}.hht-setup h3{font-size:17px;margin:12px 0 7px}.hht-setup p{margin:0;font-size:13px}
</style>'''
entry = '''<button class="hht-entry" id="hhtEntry" aria-label="打开宿舍通行码，慧湖通"><span class="hht-symbol"><svg viewBox="0 0 24 24"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg></span><span class="hht-label"><b>宿舍通行码</b><small>慧湖通 · 日常进出宿舍</small></span><span class="hht-go">打开<span aria-hidden="true">›</span></span></button>'''
style += '''<style>
#xjCodeBtn{display:none!important}.campus-code-tools{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 19px}.code-tool{display:flex;align-items:center;justify-content:center;gap:10px;min-height:50px;padding:12px;border:1px solid var(--line);border-radius:13px;background:#fafbfd;font-size:14px;font-weight:650;color:var(--ink)}.code-tool svg{width:22px;height:22px;color:var(--room-blue)}
</style>'''
qr_icon = '<svg viewBox="0 0 24 24"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg>'
entry = '<div class="campus-code-tools" role="group" aria-label="校园通行码"><button class="code-tool" id="xjTool">'+qr_icon+'西浦码</button><button class="code-tool" id="hhtEntry">'+qr_icon+'宿舍码</button></div>'
source = source.replace('</style>', '</style>'+style, 1)
assert '<div id="homeScreen">' in source
source = source.replace('<button id="settingsBtn"', entry+'<button id="settingsBtn"', 1)
source = source.replace('</style>', '''</style><style>
header{position:relative;padding-right:144px;min-height:65px;margin-bottom:19px!important}header h1{font-size:27px}.eyebrow{font-size:9px;letter-spacing:1.25px}.campus-code-tools{position:absolute;right:34px;top:13px;display:flex;gap:0;margin:0}.code-tool{flex-direction:column;gap:5px;min-height:48px;width:44px;padding:5px 0;border:0;border-radius:9px;background:transparent;font-size:10px;font-weight:550;color:var(--pencil)}.code-tool svg{width:22px;height:22px;color:var(--campus-blue)}#settingsBtn{position:absolute!important;right:0!important;top:15px!important;width:34px;height:40px}
</style>''', 1)
script = '''<script>
document.getElementById('hhtEntry').onclick=()=>show(`<h2>宿舍通行码</h2><p>慧湖通</p><div class="hht-setup"><svg viewBox="0 0 24 24"><path d="M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6"/><path d="M7 7h3v3H7zM14 7h3v3h-3zM7 14h3v3H7zM14 14h3v3h-3z"/></svg><h3>首次使用，绑定你的慧湖通</h3><p>绑定后可在这里打开自己的通行码。</p></div><button class="form-submit" id="hhtBindPreview">绑定慧湖通</button><p style="font-size:11px;text-align:center">仅为界面预览，尚未接入取码服务</p>`);
document.addEventListener('click',e=>{if(e.target.id==='hhtBindPreview')e.target.textContent='绑定流程待确认';});
document.getElementById('xjTool').onclick=()=>show('<h2>西浦码</h2><p>此处预览西浦码入口，实际取码功能未接入。</p>');
const demoDays=Array.from({length:3},(_,i)=>{const d=new Date();d.setDate(d.getDate()+i);return {date:String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),timetableVoList:[{moduleCode:'CSE101TC',moduleTitle:'计算机科学导论',moduleTime:'18:00-19:00',room:'FB 231',moduleTypeGroup:'Lecture'},{moduleCode:'MTH101TC',moduleTitle:'数学基础',moduleTime:'20:00-21:00',room:'MA 204',moduleTypeGroup:'Tutorial'}]};});
window.postMessage({amsUiData:{route:'/home',days:demoDays,ready:true,account:'预览账号',theme:'blue'}},'*');
</script>'''
source = source.replace("if(e.source!==parent||!e.data||!e.data.amsUiData)return", "if((e.source!==parent&&e.source!==window)||!e.data||!e.data.amsUiData)return")
source += '<style>.campus-code-tools{position:absolute;right:34px;top:13px;display:flex;gap:0;margin:0}.code-tool{flex-direction:column;gap:5px;min-height:48px;width:44px;padding:5px 0;border:0;border-radius:9px;background:transparent;font-size:10px;font-weight:550;color:var(--pencil)}.code-tool svg{width:22px;height:22px;color:var(--campus-blue)}</style>'
source += script
source += '<script>document.getElementById("hhtEntry").onclick=()=>location.href="hht.html?v=tutorial6";</script>'
(out/'hht.html').write_text(Path('work/hht-pages-preview.html').read_text(encoding='utf-8-sig'), encoding='utf-8')
(out/'tutorial.html').write_text(Path('work/hht-tutorial-preview.html').read_text(encoding='utf-8-sig'), encoding='utf-8')
(out/'app.html').write_text(source, encoding='utf-8')
(out/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mate 70 Pro+ 首页预览</title><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#e7ebf1}#phone{position:absolute;left:50%;top:50%;width:412px;height:886.614px;transform-origin:center center;box-shadow:0 8px 32px #18233a22}iframe{display:block;width:100%;height:100%;border:0}</style><div id="phone"><iframe src="app.html?v=tutorial6" title="Mate 70 Pro+ 比例首页"></iframe></div><script>function fit(){const s=Math.min((innerWidth-24)/412,(innerHeight-24)/(412*2832/1316));document.getElementById('phone').style.transform='translate(-50%,-50%) scale('+s+')'}addEventListener('resize',fit);fit();</script></html>''', encoding='utf-8')
print(out/'index.html')









