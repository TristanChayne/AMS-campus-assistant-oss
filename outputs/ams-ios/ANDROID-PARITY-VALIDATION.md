# iOS 功能对齐与联合验收（2026-10-12）

本阶段是 0.1.0(3) 的后续源码状态，尚未生成新安装包。下一构建需同时包含扫码提交修复、西浦码键盘收起修复及本轮功能。Mac 连接超时，不能将以下待测项写成已通过。

## 已完成的本地检查

- iOS 基础资源 / JavaScript 语法、页面就绪、动画 / 讨论室时段、AMS 会话、预约会话、扫码内容提取、宿舍码生成页面与桥接检查通过。
- 腾讯云激活及独立 iOS 公共配置的隔离测试通过；不会读取或修改线上数据库。
- 宿舍码页面、教程来自 Android 当前资源，四张脱敏教程图逐一字节核对；iOS 新增桥接且只允许本地取码页主框架调用。OpenId / satoken 使用独立 hhtBinding 钥匙串项，HTTPS 请求不共享学校 Cookie、不跟随重定向，网页禁止直接网络请求。
- 版本提示使用独立 /api/public/ios/config；Android 更新配置未改。iOS 比较版本号与构建号，更新目标限定 App Store / TestFlight 域名。后台新增代码未部署，未配置或发布新版本链接。

## Mac 连通后先运行

1. 阅读当前 HANDOFF.md，并先核对 Mac 的源码、现有签名团队和项目变动。同步源码与资源，加入 ActivationCadence、HhtController、HhtService、QRCodeDecoder 编译项；保留 Mac 实际签名设置。不要直接用旧同步脚本覆盖 Mac 项目后就宣称可发布。
2. 将工作目录中的 work/ios/ParityChecks.swift、QRCodeDecoderChecks.swift、run-parity-checks.command 与当前源码一起同步，在完整 checkout 下执行 `zsh work/ios/run-parity-checks.command`。这是模拟请求 / 合成二维码检查，不访问学校真实签到接口，不写真实钥匙串绑定。
3. 执行 Xcode Debug 模拟器构建，确认新增 Swift 文件、Vision、资源打包和旧功能通过。现有 PublicConfigChecks 需与实际 PublicConfig / AppService 定义一起验证，不能拿历史副本代替当前源码。
4. 核对宿舍码本地页面可加载、首页三个入口可点击、教程图片可放大 / 返回、九主题 / 深浅色、键盘与安全区。没有真实绑定时只检查空状态，不使用伪造通行码作为成功证据。演示账号继续隐藏宿舍码。

## 实机联合验收

| 功能 | 必须确认的结果 |
| --- | --- |
| 课堂扫码 | 同一有效课堂码可签到，签到记录确实更新；过期码按学校实际信息失败；无效格式不提交；一次识别只提交一次。不得通过重复真实签到请求做压力测试。 |
| 扫码增强 | 普通、反色、投影拉伸、近远距离、手电筒 / 对焦 / 缩放；进入后台、取消后旧帧不提交；对比识别速度、耗电及画面流畅度。合成图像检查不等于教室相机验收。 |
| 宿舍通行码 | 自己的 OpenId 或 satoken 绑定，姓名核对、8 秒刷新、手动刷新、OpenId 失效仅重新登录重试一次、仅 token 失效需重新导入；切后台 / 返回 / 更换绑定不能显示旧请求二维码。实际闸机通行单独验收。 |
| 本机绑定管理 | 成功绑定后凭据输入清空，重新打开可恢复；清除本机绑定后二维码与保存项均清除；不解除学校账户绑定，不清除 AMS / 西浦码会话。 |
| 激活 | 有效普通授权断网重启可进入；周期到期后台检查、失败一小时内不重试；只接受签名 / nonce / 原授权一致的停用结果；换码后的旧响应不得覆盖新授权。演示启动仍需服务器 bootstrap，不能转成真实学校流程。 |
| 更新提示 | 先在隔离环境验证独立 iOS 配置：更高版本 / 同版本更高 build 提示，旧 / 相同版本不提示；扫码或弹窗期间不打断。配置发布时使用实际可访问的新版本链接，禁止使用 Android 下载地址。 |
| 旧功能 | AMS 登录与预约重启恢复、Code 签到、请假附件与撤回、预约 / 查询、地图、主题、西浦码三个输入框的完成按钮和空白收键盘。 |

## iOS 公共配置发布准备

服务端读取独立环境变量 IOS_PUBLIC_CONFIG（JSON，schemaVersion=1），仅返回允许的公告与 release 字段；未配置时返回空公告 / 空 release，不沿用 Android service_settings。示例字段结构为 release:{version,build,url,notes}，URL 必须是实际 App Store / TestFlight 页面。配置值及后端部署待完成 Mac 检查后处理；本阶段没有改线上环境变量或服务。

实际版本号 / 构建号在封包前从生成来源统一更新，并另作带版本的 Git 备份。标签只证明源码状态；真实账号、闸机、学校签到、后台部署和 TestFlight 上传分别记录结果。

## 2026-10-12 Mac 联合编译与模拟检查
- Mac 已重新连通；同步前保存原源码、工程和签名配置，完整备份位于 Mac ~/Developer/AMS-iOS-backups/parity-20261012/before.tgz。同步当前扫码修复与安卓对齐源码、资源，保留 Debug/Release 原签名团队及手动分发配置。
- Xcode 27 Debug 模拟器构建、安装启动及 Release 模拟器无签名编译通过。运行当前源码的 ParityChecks、QRCodeDecoderChecks、PublicConfigChecks：授权周期/时钟回退、慧湖通两种绑定请求与隔离/重试、普通/反色/拉伸合成二维码、更新配置正常/404/损坏/超时缓存保留均通过；全部采用模拟请求和无业务效力的合成二维码。
- DEBUG 增加隔离宿舍码预览及事件驱动教程切换，预览不读取绑定、不发送请求、不清除钥匙串。模拟器绑定页桥接就绪，教程首屏图片与返回正常，深色页面可见；懒加载图片在 didFinish 时未全部加载，未声称全教程交互或九主题均实测。Release 不包含预览入口。
- 本地 check.py、check-hht、check-scan-payload、check-interaction 通过。截图和 Mac 原配置只保存在忽略的 outputs/ams-ios-audit/mac-parity-20261012，不提交私有配置。
- 仍需 iPhone 真实课堂码签到并核对记录、真实相机识别和后台取消、宿舍码本人绑定/8秒刷新/闸机，以及西浦码三个输入框收键盘与完整主题/页面交互验收。未部署新后台配置、未重新封包上传 TestFlight；源码仍为 0.1.0(3)，本阶段备份标签 stage-4。


## 2026-10-12 0.1.0(4) 审核演示覆盖与正式封包
- 旧备份已覆盖课表、签到记录、带附件请假/详情/撤回、7F座位、3F讨论室和区间车预约/记录/取消、西浦演示码、地图与主题；没有真实身份令牌和有效通行码。补齐演示宿舍码与扫码结果保存，不能把真实学校认证和闸机通行称为备份数据可验收。
- 专用激活仍由服务器签名 demo 授权，无学校账号/密码/OTP；演示宿舍码使用 DEMO，绑定仅驻留内存，不读取/保存/清除真实慧湖通绑定、不调用真实服务。两种绑定方式、8秒刷新、手动刷新、编辑/清除和教程均有独立演示入口。二维码明确带 AMS-DEMO-NOT-VALID 标记。
- 审核扫码可使用演示按钮或演示码；拒绝学校码，演示签到仅写现有演示服务器。修正旧 chrome.css 隐藏宿舍码入口。演示课表投影到当前日期，保留历史演示记录，使排队审核后仍有可用课程；后台已部署，同时独立 iOS 公共配置路由上线，未配置 release/announcement，未改 Android service_settings。
- 10项后台隔离测试、check.py/check-hht/check-scan-payload/check-review-parity通过；Mac Debug模拟器构建安装，特殊码进入真实演示服务器，宿舍演示绑定与二维码、演示签到成功页面、顶部入口已核验。新日期逻辑包含陈旧anchor回归。
- Release 0.1.0(4) 手动分发签名归档/导出成功；team 6F3GZ46T3L、cn.xjtlu.ams.ios、get-task-allow=false、beta-reports-active=true。IPA全部资源逐字节等于当前来源，iPhone配置、隐私清单和无DEBUG参数核验通过。SHA256 e0620a7fb19fa6a8be7cdca1629e1c4cfa08f12d4dc36617a937363cdf97afdb。
- 包位于 outputs/ios-release-0.1.0-4/AMS-0.1.0-4.ipa；审核说明在 App Store Connect 保存，复用私有特殊码并列出逐项操作。Xcode自动上传无付费团队账户，用户已在Transporter交付，目前上传中，尚未确认苹果处理或提交外部审核。真实iPhone签到/相机/闸机验收仍待用户测试。


## 2026-10-12 构建4 TestFlight提交与iPad侧载完成
- 用户Transporter交付后，App Store Connect确认0.1.0(4)接收并处理完成。已保存构建测试重点与复用特殊激活码的完整审核步骤，关联现有外部群组并点击提交以供审核；随后构建列表实际显示“已批准”。自动通知选项关闭，尚未点击“通知测试员”；已批准不等于当前真机业务验收完成。证据 outputs/ios-release-0.1.0-4/apple-approved.png。
- 完成审核提交后，按用户要求将最新源码编译为iPad开发侧载版0.1.0(4)。正式bundle cn.xjtlu.ams.ios没有当前开发profile，沿用iPad原有cn.local.ams.ios开发标识；只通过构建参数覆盖，没有改正式工程签名。Mac登录会话内签名构建成功、devicectl安装和正常启动成功，设备应用列表确认version0.1.0/bundleVersion4。保留原侧载版数据，没有卸载或强制写入特殊激活码。
- 正式TestFlight包和iPad侧载包使用相同源码与资源，签名/标识/Debug配置不同；侧载版用于功能验收，不能替代TestFlight正式包渠道测试。课堂签到/相机和宿舍闸机仍需用户实测。
