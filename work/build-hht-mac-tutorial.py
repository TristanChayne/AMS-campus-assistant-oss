from pathlib import Path
import html
import sys
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
import fitz

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'outputs/hht-mac-tutorial'
OUT.mkdir(parents=True, exist_ok=True)
ASSETS = OUT / 'assets'
ASSETS.mkdir(exist_ok=True)
SOURCE = Path(sys.argv[1])  # Original screenshot directory, kept outside Git.
FILES = ['826e931a30461ad5162abb50af0e2a6e','1ee406c770584e04e39cc7a9fa66068e','387256935e3784971e3a91b8e231aba1','e03e215b54e581dcfa7341610ab6c3d7','46158a39033b5c5695124f8b63ff9a0e','92a840b873df24e7ecf52c4969b4ea71','8aa88c1ea134c1dd589f4ddf2ed5dd41']
STEPS = [
('跳过代理助手安装', ['从 proxyman.com 下载并打开 Proxyman，登录 Mac 微信。','出现此弹窗时，点击左上角 × 关闭。代理助手不是必需步骤。']),
('关闭欢迎窗口', ['不需要选择 iOS Device 或模拟器。','点击底部“关闭（ESC）”，进入主界面。']),
('打开慧湖通并筛选请求', ['在 Mac 微信中打开慧湖通，进入“我的”及通行码。','点击底部“过滤器”，设置 URL → 包含 → api.215123.cn。']),
('仅解密慧湖通域名', ['选中 api.215123.cn 的请求，点击右侧蓝色“仅启用此域”。','CONNECT 仅表示连接已捕获；还不能查看 OpenId 或令牌。']),
('安装并信任 HTTPS 证书', ['在“自动”页点击“安装并信任”，按系统提示输入 Mac 管理员密码。','此证书是查看 HTTPS 内容所必需的，与第一步代理助手不同。']),
('找到登录请求并复制 OpenId', ['关闭并重新打开慧湖通；必要时完全退出微信后重新打开。','选中 URL 含 certificateLogin 的请求，在下方查看完整地址。','复制 openId= 后、下一个 & 前的值，不带 openId= 或 unionId。','也可点 Request 的“查询”查看参数；回 AMS 粘贴 OpenId 并验证绑定。']),
('备用：复制 satoken', ['在 Request →“头部”向下滚动，找到 satoken。','复制右侧完整值，不带 satoken 字段名，不要遗漏换行显示的部分。','回 AMS →“其他绑定方式”→“改用登录令牌”，粘贴后验证。','OpenId 与 satoken 二选一；令牌失效后需要重新获取。'])]
STEPS[0][1][:] = ['打开 https://proxyman.com/，下载 macOS 版，安装并打开 Proxyman。', '打开 Mac 微信，登录自己的账号；关闭无关网页和应用，减少无关请求。', '出现“安装代理助手工具”弹窗时，点击左上角 × 关闭即可。', '助手仅帮助设置和恢复系统代理；本教程先跳过，遇到代理设置问题再安装。']
STEPS[2][1].extend(['过滤栏选择“URL”，条件选择“包含”，输入 api.215123.cn，并保持左侧勾选。', '截图此时尚未打开过滤栏：红框标出底部入口，下一张展示填写后的结果。'])
STEPS[3][1].append('不要选择“启用来自微信的所有域”，只启用 api.215123.cn 即可。')
STEPS[4][1].extend(['确认这是自己安装的 Proxyman 发出的证书提示，再授权；密码不需要发给任何人。', '若未弹出设置指南，可从 Certificate 菜单打开 Install Certificate on this Mac。'])
STEPS[5][1].extend(['示例：certificateLogin?openId=你的值&unionId=其他值，只复制“你的值”。', '不要复制整条链接，也不要把 getOpenId 请求中的 code 当作 OpenId。'])
STEPS[6][1].append('satoken 是慧湖通令牌，不能用 AMS 的令牌或其他 ACCESS-TOKEN 替代。')
ANNOTATIONS = {
1: [((.31,.265,.327,.287),(.36,.21),'点击 ×，跳过助手安装')],
2: [((.465,.80,.53,.851),(.37,.72),'直接关闭，不选设备')],
3: [((.191,.965,.243,.995),(.28,.90),'点击“过滤器”')],
4: [((.157,.101,.432,.135),(.37,.36),'URL → 包含 → 输入域名'),((.748,.837,.833,.866),(.59,.74),'点击“仅启用此域”')],
5: [((.46,.188,.50,.214),(.32,.46),'选择“自动”'),((.418,.296,.585,.326),(.46,.53),'点击安装并信任证书')],
6: [((.185,.495,.425,.524),(.24,.57),'选中 certificateLogin'),((.246,.653,.99,.688),(.51,.60),'复制 openId= 后、& 前的值'),((.201,.695,.22,.717),(.20,.77),'也可点“查询”查看参数')],
7: [((.142,.819,.559,.897),(.32,.70),'复制 satoken 右侧完整值')]
}

# Flatten opaque masks into new pixels; never embed original screenshots.
for i, name in enumerate(FILES, 1):
    im = Image.open(SOURCE / (name + '.jpg')).convert('RGB')
    w,h = im.size
    d = ImageDraw.Draw(im)
    boxes = [(0.555,0.009,0.652,0.045)]
    if i <= 3:
        boxes += [(0.008,0.198,0.13,0.93)]
    if i <= 2:
        boxes += [(0.145,0.12,0.298,0.96),(0.70,0.12,0.995,0.96)]
        if i == 1:
            boxes += [(0.298,0.12,0.70,0.245),(0.298,0.75,0.70,0.96)]
    if i == 3:
        boxes += [(0.182,0.125,0.423,0.58),(0.246,0.584,0.57,0.619),(0.25,0.687,0.55,0.79)]
    if i >= 6:
        boxes += [(0.515,0.655,0.99,0.688),(0.382,0.47,0.425,0.493),(0.394,0.498,0.425,0.525)]
    if i == 7:
        boxes += [(0.249,0.822,0.558,0.893)]
    for x1,y1,x2,y2 in boxes:
        d.rectangle((int(x1*w),int(y1*h),int(x2*w),int(y2*h)), fill='#343940')
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',int(w*.015))
    for box,pos,label in ANNOTATIONS[i]:
        x1,y1,x2,y2=[int(v*(w if k%2==0 else h)) for k,v in enumerate(box)]
        d.rectangle((x1,y1,x2,y2),outline='#ff3b30',width=max(4,int(w*.0025)))
        tx,ty=int(pos[0]*w),int(pos[1]*h)
        bounds=d.textbbox((tx,ty),label,font=font)
        d.rectangle((bounds[0]-10,bounds[1]-7,bounds[2]+10,bounds[3]+7),fill='#fff3ed')
        d.text((tx,ty),label,font=font,fill='#d82018')
    im.save(ASSETS / f'p{i}.png')

intro = '使用 Mac 微信获取自己的慧湖通绑定凭证。截图中的隐私信息已遮盖；请勿分享自己的凭证或完整抓包记录。'
end = ['获取后点击左上角暂停按钮停止抓包，并退出 Proxyman。','不再使用时，在钥匙串访问中移除本工具的 Proxyman CA 证书。','若退出后网络异常，检查系统网络代理是否恢复原设置。','找不到请求：确认正在捕获、域名过滤正确，并重新打开慧湖通。','只有 CONNECT：确认已信任证书、开启此域 SSL 解密，再产生新请求。','绑定失败：检查是否只复制参数值、是否复制完整，令牌失效时重新获取。','截图显示已捕获并解密登录请求；不代表 AMS 绑定或宿舍闸机已验收。','AMS 为学生独立开发的非学校官方应用。']
parts = ['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>慧湖通 Mac 绑定教程</title><style>body{margin:0;background:#f5f6f8;color:#18233a;font:16px/1.85 system-ui,"Microsoft YaHei",sans-serif}main{max-width:860px;margin:auto;padding:28px 22px}h1{font-size:28px}h2{font-size:22px}section{background:white;border:1px solid #e1e6ed;border-radius:16px;padding:22px;margin:22px 0}img{width:100%;height:auto;border-radius:8px}a{color:#172e61}p{margin:8px 0}.note{color:#69758a;font-size:14px}</style><main><h1>慧湖通 · Mac 绑定教程</h1><p>'+intro+'</p><p><a href="https://proxyman.com/">Proxyman 官方下载</a></p>']
for i,(title,lines) in enumerate(STEPS,1):
    parts.append(f'<section><h2>{i}. {title}</h2>'+''.join('<p>'+html.escape(t)+'</p>' for t in lines)+f'<a href="assets/p{i}.png" target="_blank"><img src="assets/p{i}.png" alt="步骤{i}：{title}"></a><p class="note">点击截图可放大查看。深灰色区域为隐私遮盖。</p></section>')
parts.append('<section><h2>完成后</h2>'+''.join('<p>'+t+'</p>' for t in end)+'</section></main></html>')
(OUT/'index.html').write_text(''.join(parts),encoding='utf-8')
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as PdfImage, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
PDF = OUT / '慧湖通-Mac绑定教程.pdf'
styles = {
    'title': ParagraphStyle('title',fontName='STSong-Light',fontSize=23,leading=32,textColor='#18233a',spaceAfter=16),
    'body': ParagraphStyle('body',fontName='STSong-Light',fontSize=12,leading=21,textColor='#39465b',spaceAfter=9),
    'note': ParagraphStyle('note',fontName='STSong-Light',fontSize=10,leading=17,textColor='#69758a',spaceAfter=8),
    'label': ParagraphStyle('label',fontName='STSong-Light',fontSize=13,leading=21,textColor='#172e61',spaceAfter=9)
}
flow=[]
def paragraph(text,style='body'):
    return Paragraph(html.escape(text),styles[style])
def download():
    return Paragraph('软件下载：<a href="https://proxyman.com/" color="#2054a0">https://proxyman.com/</a>（点击打开，选择 macOS 版）',styles['body'])
def picture(path,width=511):
    iw,ih=Image.open(path).size
    return PdfImage(str(path),width=width,height=width*ih/iw)
# Each step has identical explanatory text to the HTML, with enlarged detail below.
crops={1:(.30,.25,.70,.745),2:(.30,.08,.70,.9),4:(.70,.72,.90,.94),5:(.28,.06,.72,.45),6:(.14,.64,.995,.735),7:(.14,.76,.57,.94)}
for i,(title,lines) in enumerate(STEPS,1):
    flow.append(paragraph(f'{i:02d}  {title}','title'))
    if i==1:
        flow.append(paragraph(intro,'note'));flow.append(download())
    for t in lines:flow.append(paragraph(t))
    flow.append(Spacer(1,7));flow.append(picture(ASSETS/f'p{i}.png'))
    flow.append(Spacer(1,7));flow.append(paragraph('红框标出操作位置，红字说明操作；深灰区域为隐私遮盖。','note'))
    if i in crops:
        im=Image.open(ASSETS/f'p{i}.png');iw,ih=im.size
        b=crops[i];detail=im.crop((int(b[0]*iw),int(b[1]*ih),int(b[2]*iw),int(b[3]*ih)))
        detail.thumbnail((1600,600))
        target=OUT/f'detail-{i}.png';detail.save(target)
        flow.append(paragraph('关键位置放大','label'))
        detail_height = 115 if i == 1 else 185
        pw=min(511,detail_height*detail.width/detail.height)
        flow.append(picture(target,pw))
    flow.append(PageBreak())
flow.append(paragraph('完成绑定与收尾','title'))
for t in end:flow.append(paragraph(t))
flow.append(Spacer(1,18));flow.append(download())
def footer(c,doc):
    c.setStrokeColorRGB(.88,.90,.93);c.line(42,39,553,39)
    c.setFont('STSong-Light',9);c.setFillColorRGB(.4,.45,.52)
    c.drawString(42,24,'慧湖通 · Mac 绑定教程 | 仅使用自己的凭证')
    c.drawRightString(553,24,str(doc.page))
SimpleDocTemplate(str(PDF),pagesize=(595.28,841.89),rightMargin=42,leftMargin=42,topMargin=38,bottomMargin=52,title='慧湖通 Mac 绑定教程').build(flow,onFirstPage=footer,onLaterPages=footer)
doc=fitz.open(PDF)
# Verify all shared explanatory paragraphs survived PDF layout.
normalize=lambda t: ''.join(t.split())
text=normalize(''.join(p.get_text() for p in doc))
for t in [intro]+[t for _,lines in STEPS for t in lines]+end:
    assert normalize(t) in text, 'PDF explanation missing'
assert all(p.rect.height>p.rect.width for p in doc)
assert any(l.get('uri')=='https://proxyman.com/' for p in doc for l in p.get_links())
thumbs=[]
for page in doc:
    pix=page.get_pixmap(matrix=fitz.Matrix(1,1))
    thumbs.append(Image.frombytes('RGB',[pix.width,pix.height],pix.samples).resize((298,421)))
sheet=Image.new('RGB',(298*2,421*((len(thumbs)+1)//2)),'white')
for k,im in enumerate(thumbs):sheet.paste(im,((k%2)*298,(k//2)*421))
sheet.save(OUT/'pdf-review.png')
print(f'Created and verified {len(doc)} portrait PDF pages with all HTML explanations and download links.')
