# AMS 任务与分工

维护日期：2026-10-21。当前协作仓库为 AMS-campus-assistant，本地集成目录 E:/Codex/AMS-campus-assistant。协调方统一维护本页、项目进度和产品约定；参与者通过任务分支与 PR 交付。

## REPO-INIT-001 新协作仓库初始化

- 范围：从已整理的主线导入纳管源码，建立独立 Git 历史；更新开发入口与仓库记录，不复制旧分支/标签/提交、个人工具资料、签名、会话或数据库。
- 负责人：项目维护者；初始分支 main，工作区 E:/Codex/AMS-campus-assistant。
- 验收：新仓库私有且不是 fork；仅一个无父提交、main 分支和新建 repo-stage-1 标签；来源源码与输入逐文件核对（仅当前项目说明允许调整），离线检查和新仓库云端检查通过；旧库身份/历史保留。
- 平台：Android/iOS/小程序与服务端业务源、生成资源均不改，不新封包或部署；迁移仓库不能代替平台构建/设备验收。
- 本地结果：563项纳管文件完整保留，556项Git内容逐字节不变，仅7份当前项目说明/忽略策略调整；19个入口文档本地链接有效。smoke（既有课表/扫码及5项管理模型）、37项service和10项仓库工具回归通过。GitHub首轮检查在初始推送后运行，以Actions实况和本地完成核对为准。

## 待开展的目录整理

| 范围 | 下一步 | 验收要求 |
|---|---|---|
| 小程序生成输入 | 安全提取四份未纳 Git 的必要源，迁入正式输入 | 干净下载可重新生成；不得提交原始探针/私人缓存 |
| Android 开发构建 | 分离开发构建与正式签名，整理 SDK/Java/依赖 | 不使用维护者正式密钥构建约定的开发包 |
| 共享网页 | 消除 iOS 从 Android assets 中转的依赖 | 保留平台专用行为，核对输出和对应构建 |
| 工程目录 | 按 docs/development/migration.md 分批迁移 | 认领不冲突，路径/脚本/文档与检查同步 |

## 现有验收限制

- iOS 顶栏恢复已在当前源码中，原生编译和手机后台返回复测仍待目标环境；现有包不自动包含后续源码修复。
- iOS 预约会话恢复、体育馆真实认证/交易及各端既有业务验收保持独立，不因仓库初始化标为完成。
- 尚未集成的工作留在原工作区，由维护者按具体文件/补丁审阅迁入；不将旧分支历史直接 merge 或 push 到新库。
- 新任务先明确负责人、精确输入/输出、依赖、检查和三端影响；PR 提供证据，再由协调方更新本页。

## RES-IOS-001 预约参与人、FB 入口与 iOS 会话/前台时钟

- 授权/负责人：2026-10-21 用户反馈并要求此次更新，随后明确要求“进行审核验收”；Codex 实施/协调，按该授权完成第二轮源码审核与检查，公共记录由同一协调方维护。
- 状态：第二轮源码审核验收通过，未发现阻断源码合入的问题；本 PR 合入构成本轮源码阶段集成，原生/真机/学校业务仍待验；[PR #1](https://github.com/TristanChayne/AMS-campus-assistant/pull/1)。实施提交 `65269e1ddc7e4cf3deedcd151a8e754b1e00049c`，分支 `codex/reservation-ios-lifecycle`，工作区 `E:/Codex/AMS-campus-assistant-worktrees/reservation-ios-lifecycle`。完成提交以 PR 的合并提交为准；合入并同步干净 main 后，使用已核对未占用的 android-v0.15.0-build77-stage-1 / ios-v0.2.0-build6-stage-1 创建源码阶段备份，不递增 App 版本或称为新安装包。
- 改动：讨论室学校弹窗与 autocomplete/select 候选原节点移到 body，避开隐藏时间轴和滚动容器，保留原搜索/选择/提交逻辑；增加 SIP FB 独立 gsrb 入口与学校静音仓操作提示；iOS 每次保存/清空会话后更新捕获令牌的恢复脚本；前台强制刷新课程时间、恢复单计时器，详情打开期间不提前记录刷新分钟。既有顶栏独立恢复补丁保留并回归，不以重载正文恢复顶栏。
- 手写范围：Android library-room-ui.js、MainActivity.java、ReservationActivity.java、新 FbReservationActivity.java/Manifest；work/build-live-ui.py；iOS CampusController.swift、work/ios/session.js、新 foreground-clock.js、prepare.py；相关专项检查，以及审核新增的 work/check-room-element-browser.cjs。共享生成器和输入/输出由同一负责人处理。
- 输出：work/live-ui.html、两端 ams-modern-ui.js/讨论室资源，iOS 会话、预览、内置审核页面同步；`prepare.py --ios-only` 未写服务端审核资源。两次生成关键输出字节一致。没有新 APK/IPA；应用版本/build 未递增。

| 平台 | 影响/同步 | 检查与验收 |
|---|---|---|
| Android | 参与人弹窗、课程分钟刷新时机、FB 入口；资源已生成；FB 独立 Activity 保留状态 | 全部 Java 源以 android-36、Java 8 目标编译通过（既有弃用/目标版本警告）；390/430px 合成候选选择通过；未封 APK、未设备/学校真实预约验收 |
| iOS | 同步预约/FB，修复会话脚本更新、前台时钟；既有顶栏补丁保留 | 合成浏览器/时钟/会话/顶栏 JS 与接线/资源检查通过；Swift 原生执行在 Windows 明确 SKIP；Xcode 构建、同设备长后台/顶栏、跨 1–2 天真实会话待验 |
| 小程序 | 不涉及：本任务只授权 Android/iOS；无静默移植 | 源/资源不改不生成；既有四项输入缺口保持独立 |
| 服务端 | 不涉及：校方认证/接口不改，AMS 后端不改 | 不部署、不推送消息、不提交真实预约 |

- 已过检查：`tools/repo/manage.py check --profile smoke`；room interval/timeline、iOS interaction/session/reservation-session/readiness/UI parity、timetable-clock、foreground-clock、FB 路由、顶栏恢复、学校会话恢复接线、iOS check.py、native-navigation、review-parity；两端顶层资产 JS 语法和 diff --check。
- 浏览器：`check-room-participants-browser.cjs` 分别运行 Android/iOS 资源，390/430px、两类候选、三名参与人、原事件保留且零提交；旧源码相同隐藏容器场景无法输入。`work/ios/check-foreground-browser.cjs` 运行完整生成页面，40→20→15 分钟、详情关闭、跨两天、单计时器和 FB dispatch 通过。仅合成数据，未连接学校。
- 当前限制：外部只读访问预约站点跳转校方统一认证；不能由合成布局测试证明实际账号搜索/三人加入或 FB 预约已通过。会话修复解决旧脚本重放旧令牌，不承诺延长学校服务端期限。Mac 执行 `check-school-session-recovery.py` / `check-header-recovery.py` 并构建后，进行上述真机验收；本轮源码合入不关闭这些产品/设备待验项。

- 第二轮审核补充（2026-10-21）：逐项审阅完整 PR 源码/路由/生成输出和会话清空边界。使用 npm registry 的 vue@2.7.16、element-ui@2.15.14 公共归档，先校验完整性再在隔离浏览器运行真实控件；两端资源的多选与自动补全均通过“选两人→关闭/重开→候选定位→键盘加入第三人→销毁清理”，无异常/孤立弹窗。测试输入全为 synthetic，页面流量全部拦截，不使用或保存学校会话。补充脚本已入 PR，库/浏览器产物留临时目录，不纳入产品。
- 复验：Android 全源 javac 再次通过；smoke、iOS check.py、三人合成选人、完整 iOS 时钟/FB 浏览器、会话/时钟/FB/顶栏专项复跑通过；四个顶栏恢复核心方法与基线逐字相同。当前 Mac SSH 端口实测超时；Swift/Xcode/真机明确未执行，不能将本次源码审核当作完整设备验收。

## RELEASE-021 Android 0.15.1（78）与 iOS 0.2.0（7）

- 授权：2026-10-21 用户要求 Android 补丁版本 +1、iOS 保持版本递增 build 并上传；封包前已展示旧库未合入改动，用户明确选择只迁入讨论室日期修复、保留当前灵动岛样式。Mac 连接地址已由用户更新并记录在本地交接。
- 单一负责人/协调：Codex；任务分支 codex/release-0151-ios7，工作区 E:/Codex/AMS-campus-assistant-worktrees/release-0151-ios7，基线 a6c592d。
- 范围：按文件审阅迁入旧库 ROOM-DATE-001（029496a / 042e5bc）实现及检查，不 merge 旧分支/历史；Android build.gradle、build-local.ps1、共享页面版本入口；iOS prepare.py 的 App/扩展 build 及生成资源。已封包 Android 0.15.1 build78、iOS 0.2.0 build7。
- 验证：讨论室日期/选人、时钟/会话/顶栏回归，两端生成与差异；Android 正式签名/包内容/证书；Mac Swift harness、Debug/Release archive、IPA 版本/扩展/签名，再上传并核对 Apple 接收/处理状态。原生/模拟器/真实账号业务与 TestFlight 可用分开记录。
- 发布边界：用户授权 iOS 上传；不自动提交外部审核、修改测试组、后台发布提示或 Android 分发。签名/会话/审核种子/Apple 凭据不进 Git，保留 Mac 既有工程/签名配置后再同步。
- 平台：Android/iOS 共同纳入日期修复，小程序不改不生成，AMS 服务端不改不部署。
- 实施提交：68f17e13696f4ee7f48e13e48dc7f4286643dbfb，[PR #2](https://github.com/TristanChayne/AMS-campus-assistant/pull/2)；日期选择优先调用学校日期标签，确认前要求页面日期与每个房间 selectDay 一致，切换失败/超时保持禁止确认。保留现有选人修复与灵动岛样式。专项检查、两端实际 Element 控件/前台时钟浏览器、smoke、iOS check.py 及生成一致性通过；实施提交云端 Repository checks run39584744249 success。
- Android 包：campus-day-0.15.1-build78.apk，27,455,177 字节，SHA256 3c1aee873d585f351c5712ca5ebce4b487a64bfcb74caa9b356d692b650da1c7；正式 v2/v3 签名、zipalign、包名/版本、与上一版相同签名证书、31 项资源与源码字节一致检查通过。已整理 APK/说明/校验值 ZIP，本地交付，未分发上传。
- iOS 包：AMS-0.2.0-build7.ipa，18,897,025 字节，SHA256 1ed892a1f10ccd772034dcbbd1b0e8928f898bd9c56f51863ef3206c4f8dcc7a；主 App/扩展均 0.2.0（7），41 项资源与源码字节一致，实际 IPA 主 App/扩展 strict 签名核验通过，与 build6 同一发行证书，production APS。Mac 独立目录核对 145 项输入，实际 Swift 顶栏/学校会话 harness、原生模型检查及 Debug 编译通过；Release Archive/导出通过，未启动模拟器或安装手机。
- 上传接收已核对：本机终端解决 SSH 钥匙串会话限制后签名成功，Xcode 上传返回 Failed to Use Accounts（exit70）；用户改用 Transporter 交付。2026-10-21 Apple 网页实查已收到 0.2.0（7），构建 ID 07f0ad19-c6a8-4f7f-9718-c00bc21cf19c，上传列表状态“正在处理”，创建日期 Oct 21, 2026 3:41 AM。截图/报告本地保存；这是用户交付后经 Codex 核验的接收结果，不称为 Xcode 上传成功、测试可用或审核通过。
- 剩余验收：同一实机的跨 1–2 天登录、长后台顶栏/课程时间、真实账号第三人候选、讨论室日期及 FB 静音仓业务仍待验；离线/编译/签名通过不代替真实业务或设备验收。合入最终 main 后创建不覆盖的 android-v0.15.1-build78 / ios-v0.2.0-build7 源码标签并核对远端。

## BROADCAST-021 两端新版本应用内广播

- 授权/负责人：2026-10-21 用户要求在 Android/iOS 后台广播本次新版本，Codex 协调执行；记录分支 codex/release021-broadcast，复用干净的 release-0151-ios7 工作区。版本与安装包保持 RELEASE-021，不改应用或服务器源码、不重新部署。
- 发布前核对：用户完成 Android 上传后，蒲公英实际页面显示 0.15.1（平台上传序号 Build10，与 APK versionCode78 分别记录）；iOS build7 在 Apple 页面显示已批准，关联原内测/公测群组。Codex 没有修改 Apple 群组或发送 TestFlight 通知。
- Android：正式后台版本提示从 0.15.0/77 更新为 0.15.1/78，下载链接使用已核对的 https://www.pgyer.com/4bfc85fde7c16c49d79fcad0de858ef0，更新说明覆盖讨论室选人/日期与 FB 入口，保留合法旧校验周期 2 天。另发布 Android 定向应用公告 ann-gHzejz8REkQ2（revision2，published）。
- iOS：独立 release 从 null 更新为 0.2.0/build7，跳转现有 https://testflight.apple.com/join/QHnX9VUZ，说明覆盖会话恢复、前台课程时间、顶部栏、讨论室与 FB，保留当前灵动岛样式。后台 UI 尚无 iOS 版本编辑入口，使用服务器现有 admin ios-config 处理器及原校验器保存；三项运行文件与仓库 SHA256 相同，变更前配置备份已保存。另发布 Apple 定向应用公告 ann-QEb0cn4txgQ_（revision2，published）。
- 验证：后台显示两条公告已发布；重新读取 Android 设置为 0.15.1/78；只读查询确认两端公告各自定向、生效且没有跨平台混发，iOS 公共 HTTPS 配置与数据库读取一致（release0.2.0/7 + iOS 公告）。截图与不含凭据的核对报告本地保存，未复制用户/设备列表。
- 广播方式：应用内公告及版本提示，客户端下次成功通讯后获取；未勾选额外 Apple 通知，也未新建普通推送消息。配置生效不证明每台手机收到或安装成功；实机与学校业务待验范围保持不变。小程序不受影响。
- 完成备份：公共发布记录经 PR 集成最终 main 后，以 android-v0.15.1-build78-stage-1 / ios-v0.2.0-build7-stage-1 记录本次广播阶段并核对远端，不改变安装包内容。
