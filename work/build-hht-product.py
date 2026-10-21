"""Create the Android HHT assets from approved preview design, without demo code."""
from pathlib import Path
import re, shutil

out = Path('outputs/ams-android/app/src/main/assets/hht')
out.mkdir(parents=True, exist_ok=True)
page = Path('work/hht-pages-preview.html').read_text(encoding='utf-8-sig')
page = re.sub(r'<aside class="preview-tools".*?</aside>', '', page, flags=re.S)
page = re.sub(r'\.preview-tools.*?(?=</style>)', '', page, flags=re.S)
page = re.sub(r'<script>.*?</script>', lambda _: '<script>' + Path('work/hht-product.js').read_text(encoding='utf-8') + '</script>', page, flags=re.S)
page = page.replace('慧湖通界面预览', '宿舍通行码').replace('当前为交互预览，请勿输入真实凭证。', '绑定信息仅在本机加密保存，不上传至 AMS 服务器。')
page = page.replace('绑定信息应仅保存在本机，解绑时清除。', '清除本机绑定不会解除学校系统中的账号绑定。')
page = page.replace('解除绑定', '清除本机绑定').replace('找到 certificateLogin 请求，复制 openId 参数。', '找到 api.215123.cn 下的 certificateLogin 请求，双击这一行后复制 openId 参数。')
page = page.replace('<b>示例用户</b><small>界面示例 · 未连接通行服务</small>', '<b id="passName">宿舍通行码</b><small>将二维码对准扫码设备</small>')
page = page.replace('<div class="qr-placeholder">', '<img id="qrImage" alt="你的动态宿舍通行二维码" hidden><div class="qr-placeholder" id="qrPlaceholder">')
page = page.replace('二维码展示区域', '正在获取二维码').replace('预览占位 · 不可扫码通行', '请稍候').replace('尚未连接真实取码服务', '尚未获取二维码').replace('这里展示绑定后的页面布局', '正在连接慧湖通')
page = page.replace('</style>', '.page{padding-bottom:32px}#qrImage{width:244px;max-width:100%;height:auto;display:block;margin:auto;image-rendering:pixelated}.notice{margin-bottom:24px}</style>')
page = page.replace('</style>', Path('work/hht-interaction.css').read_text(encoding='utf-8') + '</style>')
(out / 'hht.html').write_text(page, encoding='utf-8')
tutorial = Path('work/hht-tutorial-preview.html').read_text(encoding='utf-8-sig')
tutorial = re.sub(r'<div class="controls">.*?</div>', '', tutorial, flags=re.S)
tutorial = re.sub(r'<script>.*?</script>', '<script>window.hhtTheme=t=>{document.body.classList.toggle("dark",t.dark);for(const [k,v] of Object.entries({accent:t.accent,wash:t.wash,bg:t.bg,surface:t.surface,ink:t.ink,muted:t.muted,line:t.line}))document.body.style.setProperty("--"+k,v);};</script>', tutorial, flags=re.S)
tutorial = tutorial.replace('正式接入后应核对返回的用户信息；当前 HTML 仅演示界面，不会实际验证。', '验证成功后会显示通行码，请核对姓名是否属于自己。')
tutorial = tutorial.replace('</style>', Path('work/hht-interaction.css').read_text(encoding='utf-8') + '</style>')
finish = re.search(r'<a class="finish" id="finish".*?</a>', tutorial).group(0)
tutorial = tutorial.replace(finish, '')
mac = Path('work/hht-mac-tutorial-content.html').read_text(encoding='utf-8')
choice = '<div class="platform-choice" role="group" aria-label="选择电脑系统"><button id="tutorialWindows" aria-pressed="true" aria-controls="windowsTutorial">Windows</button><button id="tutorialMac" aria-pressed="false" aria-controls="macTutorial">Mac</button></div>'
tutorial = tutorial.replace('</header>', '</header>'+choice+'<div id="windowsTutorial">', 1)
tutorial = tutorial.replace('</main>', '</div><div id="macTutorial" hidden>'+mac+'</div>'+finish+'</main>', 1)
tutorial = tutorial.replace('</style>', '.platform-choice{display:flex;gap:6px;background:var(--wash);padding:5px;border-radius:14px;margin:18px 0}.platform-choice button{flex:1;min-height:44px;border:0;border-radius:10px;background:transparent;color:var(--muted);font:inherit;font-weight:600}.platform-choice button[aria-pressed=true]{background:var(--surface);color:var(--accent)}.platform-choice button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}[hidden]{display:none!important}#macTutorial a{overflow-wrap:anywhere}#macTutorial img{display:block;width:100%;height:auto}</style>',1)
tutorial = tutorial.replace('</script>', "window.hhtTutorialPlatform=platform=>{const mac=platform==='mac';document.getElementById('windowsTutorial').hidden=mac;document.getElementById('macTutorial').hidden=!mac;document.getElementById('tutorialWindows').setAttribute('aria-pressed',String(!mac));document.getElementById('tutorialMac').setAttribute('aria-pressed',String(mac));};document.getElementById('tutorialWindows').onclick=()=>window.hhtTutorialPlatform('windows');document.getElementById('tutorialMac').onclick=()=>window.hhtTutorialPlatform('mac');</script>",1)
(out / 'tutorial.html').write_text(tutorial, encoding='utf-8')
shutil.copytree('outputs/hht-entry-preview/assets', out / 'assets', dirs_exist_ok=True)
print(out)

# Compiled raw resources remain readable where compatibility AssetManager cannot open nested assets.
raw = Path('outputs/ams-android/app/src/main/res/raw')
raw.mkdir(parents=True, exist_ok=True)
shutil.copy2(out / 'hht.html', raw / 'hht_page.html')
shutil.copy2(out / 'tutorial.html', raw / 'hht_tutorial.html')
for name in ['options', 'https', 'capture', 'credentials']:
    shutil.copy2(out / 'assets' / (name + '.png'), raw / ('hht_' + name + '.png'))
for i in range(1,8):
    shutil.copy2(out / 'assets' / f'mac_p{i}.png', raw / f'hht_mac_p{i}.png')
