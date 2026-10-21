"""Build a credential-free, self-contained sports UI review bundle."""
from pathlib import Path
import datetime as dt
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/sports-offline-gpt'
ZIP = ROOT / 'outputs/AMS-体育馆预约-GPT参考包-20261012.zip'

GUIDE = r'''# AMS 体育馆预约：设计、接入和网页逻辑说明

整理日期：2026-10-12。参考版本：Android 0.14.1，build 73。
这是给 GPT 的产品与源码评审资料，不是官方接口文档，也不是新的安装包。

## 1. 阅读顺序与资料性质

先打开 `体育馆预约-离线演示.html`，再阅读本说明；需要了解实现时阅读 sources 和 assets。
HTML 是可直接双击打开的单文件，所有脚本、样式和数据内嵌，断网也能运行；无须安装依赖或启动服务器。ZIP 中 index.html 与中文文件名 HTML 内容相同。

**离线数据全部虚构。** 日期固定为 2026-10-12 至 2026-10-18；价格、库存、订单、票种、票券、包场字段与支付结果均为模拟，不代表学校实际可售情况。模拟登录不接收账号；演示凭证只是不可扫码的文字块，没有有效二维码。离线状态只在页面内存中保存，刷新即恢复。即使网页能点击“生成演示订单”，也不会向学校提交预约。

本资料明确区分四类信息：

| 类别 | 含义 |
|---|---|
| 当前实现 | 当前 Android 源码及 build 73 已包含的呈现或容器行为 |
| 实际观察 | 在体育中心网页或公开前端源码中看到的布局、入口及流程 |
| 离线模拟 | 为评审补齐的数据与状态，不等于官方服务支持同样字段或条件 |
| 待验证 / 候选 | 尚未实机验收或只是讨论中的方向，不能写成已上线功能 |

## 2. 产品背景与用户约束

AMS 是学生独立开发的校园助手，保留非学校官方应用说明。体育馆入口位于预约分类，名称为“体育馆预约”。现有应用还有课表、课堂签到码 / 二维码签到、课程及签到记录、请假、西浦码、图书馆座位 / 讨论室 / 预约记录、慧湖通宿舍码，以及已实现的区间大巴。区间大巴不是待新增功能。

用户要求体育馆完成整体接入，界面要美观、流畅、功能清晰、符合操作逻辑。上一轮测试暴露了筛选栏只显示两项、右侧大块空白、比例失衡、边界和交互欠佳的问题；本轮已返工，但仍需手机实测判断体验是否达标。用户没有授权本次离线导出同时重做整个应用或改动线上业务。

已明确的其他需求：

- Android 与 iOS 的创作者信息加入爱发电外链：https://afdian.com/a/tristanchayne 。
- 两端图书馆地图座位标签只显示数字，例如 XF-024 显示 024；仅地图绘制简化，列表、详情、选择状态和提交仍保留完整编号。
- Android 设置页最底部增加“检查更新”，用户主动向现有服务器获取更新信息；不把设置重新划分三大类。更新展示改为与主题一致的清晰卡片，复用原更新校验链路。
- 慧湖通教程增加 Mac / Windows 切换，Mac 七张脱敏图与步骤；可跳转软件下载官网。App 不保留“下载 PDF 教程”，PDF 是群聊分发材料。
- 上述爱发电 / 座位标签与 Mac 教程有两端源码修改；本轮体育馆接入及手动检查更新针对 Android。不能据此宣称 iOS 已接入体育馆或包含新体育馆测试包。

## 3. 当前采用的接入架构

采用 **独立 Android Activity + 官方 H5 网页 + 受控样式及交互增强**。

原生层负责标题、返回 / 关闭、加载与错误提示、底部三入口、系统栏 / 键盘处理、主题注入、可信导航及支付应用跳转。官方网页继续负责登录、校区 / 项目 / 日期查询、可售场次、价格、协议、订单、优惠及支付状态。AMS 不把体育中心订单重新存入自己的业务数据库，也没有自行构造真实支付参数。

这样可以沿用官方当前业务流程，减少复刻认证和交易规则导致的偏差。代价是前端适配依赖官方 DOM 类名及布局，网站变动时需要复查；最终触摸、字体缩放、键盘和外部支付返回仍必须在 Android WebView 真机验收。现在不是全原生体育馆业务，也不是已把微信小程序源码搬入 AMS。

生产资源来源：

- work/sports-theme.css：布局、控件、状态、主题与响应式样式。
- work/sports-ui.js：语义、原节点键盘点击、说明展开和已选场次滚动入口。
- work/build-live-ui.py：生成 / 同步 Android 资源的上游。
- SportsReservationActivity.java：官方网页容器、主题、导航及支付窗口。
- SportsNavigation.java：URL 与支付跳转范围判断。
- AppTheme.java：统一主题配色与 Web 主题变量。

修改正式功能时应修改上游生成器和输入，不能只改最终 assets。离线包中的源代码副本仅供阅读；离线模拟器独立于官方 Vue 业务，不作为替换官方页面的正式业务实现。

## 4. 信息架构与视觉逻辑

### 4.1 导航层级

应用预约分类 → 体育馆预约 → 原生标题栏 + 官方内容 + 原生底部导航。
底部始终提供场馆预约、我的订单、我的票券。订单详情与支付属于订单流程，保留上下文返回；标题随页面变为预约 / 订单 / 票券 / 支付。

离线版顶部另有“评审工具”，用于主题、暗色、错误 / 空 / 加载状态、演示登录切换及恢复数据。**这不是正式设置栏，不应照搬进 Android。** 离线原生栏是 HTML 模拟，用于评审视觉层级；真机 Insets 与键盘效果无法由它证明。

### 4.2 预约首页的阅读顺序

校区 → 运动项目 → 订场 / 购票 / 活动包场 → 日期 → 场地分类 → 状态图例 → 场次网格 → 订单确认 → 协议 → 提交。

目前 TC 网页观察到 16 个项目：篮球、羽毛球、网球、壁球、乒乓球、健身、足球、武术、桌球、高尔夫、攀岩、击剑、射箭、排球、活动室、划船机。观察到 SIP 与 TC 校区入口。项目及可用模式应以服务端返回为准；不应把“每个项目都有三个模式”写成真实规则。离线版为了评审允许所有项目切换三模式。

### 4.3 返工采用的布局原则

1. 项目网格：手机四列、默认显示前八项，动态显示“展开全部 N 项 / 收起项目”；深层选中项会自动展开，项目总数来自页面 DOM。宽屏仍显示全部项目。
2. 分离筛选层级：预约方式与日期各占一行；手机日期改为 54×60px 横滑按钮，七天和服务端可用状态保持原样。
3. 只有场地网格内部横滑：时间列与价格格统一 44px 行高 / 8px 间距；时间列约 56px，场地列约 80px。外围页面不横向溢出。窄屏通过横滑看更多场地，不把整页缩成桌面小字。
4. 状态不只靠颜色：可选、已选、不可选有图例；已选继续显示官方价格并叠加勾号，禁用有条纹并从键盘顺序中排除。价格只读现有 DOM。
5. 选择后有确认入口：“已选 N 个时段 · 查看确认信息”只在订场矩阵和官方订单确认区同时存在且有选择时显示；只滚动到官方订单区，不替用户勾协议或提交。
6. 控件与内容比例统一：订单卡片、票券、支付方式、确认区、登录 / 协议 / 提示弹窗调整间距、边界和点击区域，避免只换颜色。
7. 色彩由 AMS 主题变量统一：九主题与浅 / 深色；背景、卡片、文字、边线、选中态同步，支持减少动画偏好。

九套主题键为 blue、green、dusk、teal、sage、smoke、graphite、rose、wheat；对应主色 / 强调色 / 浅色底在 demo-data.json 中可查。暗色模式使用深色表面，强调色向白色混合 55%，浅色选中底替换为表面与主色混合 30%。真实逻辑以 AppTheme.java 为准。

### 4.4 交互增强的边界

sports-ui.js 通过官方 DOM 添加 role、tabindex、aria-selected 等语义；键盘触发仍调用原节点 click。通过 MutationObserver 跟随节点和选中样式变化，触摸展开票券说明，更新已选数量与确认滚动入口。它不读取 Vue 内部状态、会话或存储，不自行发送网络请求，不决定价格和交易结果。

特别要保持：取消选择后数量回落；切换项目 / 日期 / 分类后官方清空旧选择；不可选场次不能通过键盘被提交；协议必须由用户主动勾选；确认按钮只在官方条件满足时可提交。

## 5. 官方网页路由和业务顺序

官方站点：https://sportscentre.xipueduinno.cn

| 页面 | 路由 | 用途 |
|---|---|---|
| 场馆预约 | /website/court | 校区、项目、日期、模式、场次 / 票种选择 |
| 我的订单 | /website/order#/ | 订单列表及状态、可用操作 |
| 订单详情 | /website/order#/detail?tradeId=<服务器订单号> | 订单内容、状态、凭证等 |
| 我的票券 | /website/member#/ticket | 可用票券及使用信息 |
| 支付 | /website/pay?tradeId=<服务器订单号> | 金额、优惠及支付方式 |

预约数据流：进入官方页并认证 → 读取校区和项目 → 查询开放日期、规则、协议、分类及可售场次 → 用户选择 → 官方页面核对 / 用户勾协议 → 官方创建订单 → 根据返回订单进入支付 → 查询结果 → 回订单 / 票券。

订场、购票与包场是不同业务分支。场次和票类均有不同创建接口；包场真实字段、社团资格、审批及定价尚未完整确认，离线简化表单不能当作最终合同。价格、可售状态、取消 / 退款资格必须由服务器决定。即使浏览器源码里有接口，也不代表可以绕开官方认证、规则或校方授权直接集成。

学校登录、体育中心登录、慧湖通绑定是不同的认证边界。当前体育中心使用自身官方会话；AMS 的主题偏好或学校 X-Token 不能视为体育中心授权。登录由用户在官方页面完成，导出包不保留 Cookie、Token、账号、密码、OTP 或真实订单号。

## 6. 公开前端源码中识别的接口

以下只是公开脚本中识别的方法 / 路径，不是稳定开放 API 承诺。没有给出可直接复用的请求体、认证协议、字段结构和服务端校验合同；本次没有调用这些接口或创建订单。

| 方法 | 路径 | 前端用途 / 注意 |
|---|---|---|
| GET | /api/website/venue/queryVenueServices | 项目服务 |
| GET | /api/website/venue/findVenueByCenterId | 校区场馆 |
| GET | /api/website/venue/changeVenue | 切换场馆；GET 也可能改变服务端状态 |
| GET | /api/website/court/queryBookDays | 开放日期 |
| GET | /api/website/court/getBookingRules | 预约规则 |
| GET | /api/website/court/getAgreement | 使用协议 |
| GET | /api/website/court/fieldTypes | 场地分类 |
| GET | /api/website/court/fieldList | 场次 / 可售内容 |
| GET | /api/website/ticket/ticketList | 票种 |
| POST | /api/website/ticket/ticketOrder | 票类下单 |
| POST | /api/website/court/fieldTicketOrder | 场次下单 |
| GET | /netUser/ticket/uncheck/times | 未核销次数相关 |
| GET | /pay/queryPayCardList | 支付卡选项 |
| GET | /pay/queryOrderInfo | 支付订单信息 |
| GET | /pay/queryUseCoupons | 可用优惠 |
| POST | /pay/payOrder | 支付处理 |
| POST | /wechat/createQrCode | 微信支付码 |
| POST | /alipay/createQrCode | 支付宝支付码 |
| POST | /alipay/wapPay | 支付宝 H5 跳转 |
| POST | /wechat/wapPay | 微信 H5 跳转 |
| POST | /pay/updateCardUseTime | 支付卡使用相关写入 |
| POST | /pay/queryPayState | 支付状态查询 |
| POST | /api/website/order/getOrders | 订单列表查询 |
| GET | /api/website/order/cancelPay | 取消待支付；有写入效果 |
| GET | /api/website/order/getOrderInfo | 订单详情 |
| POST | /api/website/order/cancelTickets | 退 / 取消票相关 |
| GET | /person/exitVenueSubmitByTicket | 票券离场相关；可能有写入效果 |

不能仅按 HTTP GET / POST 判断是否只读，也不能由函数名称推断精确退费和核销规则。以上接口均不会出现在离线模拟器的执行路径中。

## 7. 支付接入逻辑与剩余风险

用户问能否沿用创建订单、跳转支付并自动打开微信 / 支付宝。当前实现采用官方网页生成订单和支付参数，容器只负责安全保留并打开官方生成的流程。保留手机浏览器环境，避免桌面 UA 导致支付走不适合手机的二维码分支。

当前容器允许限定官方 HTTPS 页面、微信 / 支付宝 H5 支付主机，以及限定的 weixin / alipays 外部应用路径，目标分别为 com.tencent.mm 和 com.eg.android.AlipayGphone。支付弹窗保留真正的新 WebView 和 POST 表单，不把链接拿出来重拼参数；顶层 POST 同样校验目标。拒绝任意 intent://、未知支付主机、URL 用户信息和不合规则端口；TLS 错误不继续。

从支付 App 返回后不自动重载导致重复提交，不把“回到 AMS”判断为支付成功。真实结果应由官方订单 / 支付状态查询给出。离开支付页面有确认；缺少应用、跳转失败、取消支付、查询失败和已支付等需要实机完整验证。

现阶段已核对官方支付页的呈现及源码 / 导航判断，并构建测试包；未进行真实付费、退款、订单创建、二维码核销或闸机测试。因此可说“支付容器接入已实现，待实机交易验收”，不能说“真实微信 / 支付宝付款已成功”。

## 8. 微信小程序与网页版关系

用户最初希望接入“西浦体育中心”微信小程序，后来发现网页版有预约、订单、预约码与支付入口。目前实际采用网页版接入，不依赖小程序运行环境。

没有拿到可核验的小程序源文件，也没有完成小程序缓存包与网页的逐项等价比对。不能断言二者全部功能相同，尤其身份绑定、会员卡、社团包场、核销、微信专属能力等仍有未知项。网页版已见入口可作为接入基础；若将来需要对照，应从用户可见页面、公开资源或授权测试核对，不在 GPT 参考包里放微信缓存、凭证或原始抓包。

## 9. 离线模拟器覆盖哪些状态

- 16 项筛选、两校区、七天日期、两示例分类、六列场地及 11 个时段；状态算法只是为了形成可选 / 不可选混合布局。
- 选中 / 再次点击取消、多场次合计、筛选切换重置、确认区定位、主动勾选、只生成本地虚构订单。
- 三个示例票种、数量 1—5、说明展开；上限是模拟器选择，不是学校购买限制。
- 活动包场示例字段、活动名称及结束晚于开始校验；演示金额固定 80 元，非真实报价。
- 四种订单初始状态：待支付、已支付、已取消、已退款；详情、确认后模拟取消 / 退款。
- 票券可使用 / 已使用 / 已过期筛选；演示凭证明确不可入场，无二维码。
- 支付方式选择、跳转说明、模拟成功、取消返回、查询失败；不打开真实支付应用。
- 未登录、无内容、加载中、连接失败、重试；九主题和浅 / 深色。

为避免混淆，票券库存独立使用固定演示数据，模拟已支付不会自动生成一张新票。订单 / 票券 / 支付状态是评审示例，不代表官方数据联动已经完整复制。日期切换和校区切换在离线版只改变虚构结果，不会联网。

## 10. Stage-2 检查记录与仍需验收

Stage-2 将逐项生成 verification.json 与 visual-verification.json，记录离线 DOM 流程、浏览器视口、九主题 18 组合、无障碍与真实环境阻断项；screenshots/ 中保存浏览器实测截图。报告必须区分 DOM、浏览器模拟、Android 编译和真机证据，不把模拟结果写成 Android 真机通过。

真机待验：Android WebView 的系统栏 / 手势区 / 键盘 Insets；100%、130%、150%系统字体；触摸和双向滚动；Activity / WebView 窗口恢复与覆盖安装；官方登录 Cookie 恢复。真实校区 / 项目边界、购票与包场规则、微信 / 支付宝唤起 / 取消 / 返回 / 服务端结果、有效预约码及入场也需要授权环境。未获得真实交易授权时不创建订单、不付款、不退款。

## 11. 本阶段已实现的布局和待确认事项

Stage-2 将首页项目区改为前八项默认展开入口、日期改为 54×60px 单行横滑、场地已选价格保留并显示勾号、确认入口按真实选择及订单区存在状态更新。票券说明改为可点击的文内展开并在靠近底栏时滚入可视区；错误重试只允许跳到安全功能区，交易和写入请求不重放；WebView 字体缩放跟随 Android 系统设置。主题检查只在体育馆样式内使用 --sports-muted / --sports-accent 调整局部文字对比，不修改 AppTheme 色板。

仍需在真实官方网页确认响应式 DOM、官方订单卡片与票券实际内容；在 Android 设备确认系统 Insets、文字缩放、窗口生命周期和支付 App 路由。设计没有引入自建交易 UI / API、身份模拟、自动勾协议或自动付款。

## 12. 调查问卷与候选功能边界

另讨论了“下一个最想体验的功能”问卷：每项功能一道需求程度 / 期待值的拖动评分题，最后“其他建议”填空，计划用问卷星文本批量导入。具体比重题的导入格式和题型支持尚需在问卷星实际确认。

可讨论的校园需求包括截止任务 / 考试安排 / 成绩、馆藏及借阅、打印、校园地图 / 找教室、活动讲座、学校通知、一站式证明、报修 / IT、校历、就业信息、邮件 / 校园卡 / 网络、BOX 社团、学生支持、海外交流与 SURF 等。这里只是候选需求范围，没有逐项确认全都属于现有 XJTLU App，也没有决定全都接入 AMS。已实现区间大巴应从“新功能”题中排除；体育馆已进入当前接入工作，不宜继续作为完全未做的新功能描述。

## 13. 请 GPT 输出什么

请结合离线页、源码和实际边界，给出：当前信息架构评价；具体可复现的布局 / 交互问题；按影响排序的最小修改方案；320—430px 手机和暗色下的设计；预约 / 订单 / 票券 / 支付的状态流；需真实网页与真机核验的清单。用明确的像素 / 层级 / 状态建议替代空泛美学描述。

所有设计建议须保留官方业务节点与用户确认，不能推断真实价格或付款结果。示例编号均为 DEMO，不应替换为真实用户订单或扫码载荷。
'''

FLOW = '''flowchart TD
  A[AMS 预约分类] --> B[体育馆预约：独立 Android WebView]
  B --> C[官方登录与服务端会话]
  C --> D[校区 / 项目 / 日期 / 分类]
  D --> E{官方可用模式}
  E --> F[订场：选择场次]
  E --> G[购票：票种与数量]
  E --> H[活动包场：资格与表单待核对]
  F --> I[官方订单确认与用户主动勾协议]
  G --> I
  H --> I
  I --> J[官方服务器创建订单]
  J --> K[官方支付页：优惠与金额]
  K --> L[官方 H5 支付窗口 / 保留 POST]
  L --> M[限定微信 / 支付宝应用跳转]
  M --> N[用户返回：不重建订单，不推断成功]
  N --> O{官方查询订单结果}
  O --> P[已支付：官方凭证 / 票券]
  O --> Q[待支付：查看或再次主动支付]
  O --> R[查询失败：保留订单，允许重查]
  B --> S[我的订单：列表 / 详情 / 条件操作]
  B --> T[我的票券：使用信息 / 官方凭证]
  U[本包离线 HTML] --> V[虚构 JSON + 内存模拟器]
  V --> W[生产 CSS / 辅助 JS 的布局评审]
  W --> X[演示订单、假状态、不可入场文字凭证]
  U -. 无网络连接 / 不唤起支付 .-> X
'''


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    names = ['篮球', '羽毛球', '网球', '壁球', '乒乓球', '健身', '足球', '武术', '桌球', '高尔夫', '攀岩', '击剑', '射箭', '排球', '活动室', '划船机']
    palettes = [('校园蓝','172E61','254E9B','EAF0FA'),('松绿','205C52','327E70','E8F3EF'),('暮蓝','405D7A','405D7A','EAF0F6'),('青绿','356B68','356B68','E9F2F0'),('鼠尾草','526B58','526B58','EDF2ED'),('烟紫','655F7C','655F7C','F0EDF5'),('石墨','555E6A','555E6A','EDF0F3'),('雾玫瑰','956174','805064','F5EBEF'),('麦色','806A28','756020','F5F0DF')]
    start = dt.date(2026, 10, 12)
    data = {
        'metadata': {'synthetic': True, 'network': False, 'reference': 'Android 0.14.1 build 73', 'dateRangeIsFixedDemo': True},
        'projects': [{'name': n, 'price': 25 + i % 4 * 5} for i, n in enumerate(names)],
        'palettes': [dict(zip(['name','primary','accent','wash'],p)) for p in palettes],
        'days': [{'full':str(start+dt.timedelta(days=i)), 'short':(start+dt.timedelta(days=i)).strftime('%m/%d'), 'week':'周'+'一二三四五六日'[i]} for i in range(7)],
        'times': [f'{i:02}:00' for i in range(10,21)],
        'ticketProducts': [{'name':'健身单次票','price':15,'period':'演示：当日使用','description':'仅用于展示单次票布局'}, {'name':'健身次数票','price':90,'period':'演示：固定有效期','description':'仅用于展示次数票布局'}, {'name':'活动体验票','price':25,'period':'演示：指定活动使用','description':'仅用于展示活动票说明'}],
        'orders': [{'id':f'DEMO-100{i+1}', 'project':names[i], 'date':'2026-10-12', 'location':'TC' if i%2==0 else 'SIP','description':f'演示 {i+1}号场 · 18:00—19:00', 'total':25+i*5,'status':status} for i,status in enumerate(['待支付','已支付','已取消','已退款'])],
        'tickets': [{'id':f'DEMO-T00{i+1}','name':n,'status':s,'period':p,'venue':'TC · 虚构票券'} for i,(n,s,p) in enumerate([('健身单次票','可使用','演示有效期：10/12—10/18'),('活动体验票','已使用','演示使用日期：10/10'),('健身次数票','已过期','演示到期日期：10/01')])],
    }
    assets = OUT / 'assets'
    sources = OUT / 'sources'
    assets.mkdir(exist_ok=True)
    sources.mkdir(exist_ok=True)
    replacements = {
        '@@BASE@@': (ROOT/'work/sports-offline.css').read_text(encoding='utf-8'),
        '@@SPORTS_CSS@@': (ROOT/'work/sports-theme.css').read_text(encoding='utf-8'),
        '@@APP@@': (ROOT/'work/sports-offline.js').read_text(encoding='utf-8'),
        '@@SPORTS_UI@@': (ROOT/'work/sports-ui.js').read_text(encoding='utf-8'),
        '@@DATA@@': json.dumps(data,ensure_ascii=False).replace('</','<\\/'),
    }
    html = (ROOT/'work/sports-offline.html').read_text(encoding='utf-8')
    for key,value in replacements.items():
        html = html.replace(key,value)
    assert '@@' not in html
    assert 'connect-src \'none\'' in html
    for name in ['index.html','体育馆预约-离线演示.html']:
        (OUT/name).write_text(html,encoding='utf-8')
    for name in ['sports-theme.css','sports-ui.js','sports-offline.css','sports-offline.js']:
        shutil.copyfile(ROOT/'work'/name,assets/name)
    for name in ['SportsReservationActivity.java','SportsNavigation.java','AppTheme.java']:
        shutil.copyfile(ROOT/'outputs/ams-android/app/src/main/java/cn/local/ams'/name,sources/name)
    (OUT/'demo-data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'给GPT的设计与接入说明.md').write_text(GUIDE,encoding='utf-8')
    (OUT/'网页流程.mmd').write_text(FLOW,encoding='utf-8')
    (OUT/'给GPT的提示词.txt').write_text('请评审附件中的 AMS 体育馆预约界面。先阅读给GPT的设计与接入说明.md，再查看单文件 HTML、demo-data.json 和 sources / assets。\n请详细分析信息架构、手机布局、筛选层级、场次网格、订单确认、票券和支付状态；指出具体问题，给出按影响排序的最小修改建议，覆盖 320—430px 与暗色。\n注意：数据全部虚构，离线业务是模拟器；正式版本使用官方 H5 + Android 容器。不要把模拟支付成功当作真实付款，不推断接口合同或小程序完全等价。保留官方交易、协议主动勾选与现有导航，不擅自新增功能。其他两端改动和候选问卷功能已在说明中区分。\n请把建议写成可执行的 UI / 交互改动及验证标准，并注明还需要哪些真实网页和手机证据。',encoding='utf-8')
    (OUT/'README.txt').write_text('AMS 体育馆预约离线评审包\n\n1. 解压后双击 体育馆预约-离线演示.html 或 index.html；也可以单独发送其中一个 HTML。\n2. 页面全部资源内嵌，断网可用；刷新会还原示例数据。\n3. 用顶部评审工具切换九主题、浅深色、异常与登录状态。\n4. 试用预约、票种、包场、订单、票券和演示支付。\n5. 所有金额、日期、库存、记录、凭证与支付结果都是虚构，不连接学校，不付款。\n6. visual-verification.json 记录浏览器尺寸、主题对比度及边界；screenshots/ 保存浏览器实测 UI 截图。离线模拟不证明 Android 真机布局或真实交易。\n7. 把 ZIP 与 给GPT的提示词.txt 发给 GPT，可同时审阅说明、流程和样式来源。若上传工具不解析 ZIP，请解压后上传说明、HTML、JSON及需要的源文件。\n8. 本包不含账号、会话、真实二维码、小程序缓存、安装包或群聊 PDF。sources 是用于理解当前实现的白名单代码快照；修改应回到项目生成源。\n',encoding='utf-8')
    package()
    print(f'Built: {OUT}\nZIP: {ZIP}\nHTML bytes: {len(html.encode("utf-8"))}')


def package():
    # Explicit whitelist: never collect unrelated outputs, captures or private data.
    files = [OUT/n for n in ['index.html','体育馆预约-离线演示.html','demo-data.json','给GPT的设计与接入说明.md','网页流程.mmd','给GPT的提示词.txt','README.txt']]
    files += [OUT/'assets'/n for n in ['sports-theme.css','sports-ui.js','sports-offline.css','sports-offline.js']]
    files += [OUT/'sources'/n for n in ['SportsReservationActivity.java','SportsNavigation.java','AppTheme.java']]
    for optional in ['verification.json','visual-verification.json','offline-booking-preview.png']:
        if (OUT/optional).exists():
            files.append(OUT/optional)
    screenshot_names = [
        'booking-320.png','booking-390.png','projects-expanded-390.png','dates-scrolled-390.png',
        'slot-selected-390.png','orders-390.png','tickets-390.png','ticket-purchase-390.png','payment-demo-390.png',
        'dark-390.png','empty-390.png','loading-390.png','error-390.png','focused-390.png',
    ]
    screenshot_names += [f'theme-{theme}-{mode}.png' for theme in
        ['blue','green','dusk','teal','sage','smoke','graphite','rose','wheat'] for mode in ['light','dark']]
    screenshot_dir = OUT/'screenshots'
    files += [screenshot_dir/n for n in screenshot_names if (screenshot_dir/n).exists()]
    manifest = {'reference':'android-v0.14.1-build73','syntheticDataOnly':True,'offline':True,'files':{str(p.relative_to(OUT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}}
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED) as z:
        for p in files+[OUT/'manifest.json']:
            z.write(p,'AMS-体育馆预约-GPT参考包/'+str(p.relative_to(OUT)).replace('\\','/'))
    assert zipfile.ZipFile(ZIP).testzip() is None


if __name__ == '__main__':
    import argparse
    import sys
    parser = argparse.ArgumentParser(description='Build the offline sports review bundle.')
    parser.add_argument('--output-dir', type=Path, default=Path('outputs/sports-offline-gpt'))
    parser.add_argument('--zip-path', type=Path, default=Path('outputs/AMS-体育馆预约-GPT参考包-20261012.zip'))
    args = parser.parse_args([value for value in sys.argv[1:] if value != '--package-only'])
    OUT = args.output_dir if args.output_dir.is_absolute() else ROOT / args.output_dir
    ZIP = args.zip_path if args.zip_path.is_absolute() else ROOT / args.zip_path
    package() if '--package-only' in sys.argv else build()
