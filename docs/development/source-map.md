# 源码、生成和部署地图

核对日期：2026-10-16。这是当前源码关系；迁移目标见 migration.md。任务提交和包身份仍查根目录 TASKS/项目进度及相关PR，不在这里重复“最新版本”。

机器可检查入口：[source-map.json](../../tools/repo/source-map.json)。运行 `python -B tools/repo/manage.py map` 查看，不会执行生成器。清单是关键依赖入口，不是每个输入文件的完整枚举。

## 先判断该改哪里

| 范围 | 手写入口 / 必要输入 | 生成输出或下一步 |
|---|---|---|
| Android 原生 | outputs/ams-android/app/src/main/java、Manifest、res 中手写资源 | 正式 build-local.ps1 需要本机工具和受控签名 |
| 首页/课表/请假/设置共享网页 | outputs/timetable-preview/index.html、work/managed-*.js/css 等，组装逻辑 work/build-live-ui.py | work/live-ui.html、Android assets/ams-modern-ui.js 等 |
| 座位/讨论室/预约记录 | Android assets/library-seat-ui.js、library-room-ui.js、reservation-records-ui.js、reservation-reset-ui.js、reservation-theme.css | 这些是现行手写入口；iOS prepare 适配副本 |
| 体育馆网页 | work/sports-ui.js、sports-theme.css | build-live-ui.py 写 Android assets，iOS prepare 再适配 |
| 宿舍码/教程 | work/build-hht-product.py、hht-product.js、hht-*-preview.html、hht-mac-tutorial-content.html、outputs/hht-entry-preview/assets | Android assets/hht、res/raw；原图/PDF制作另有外部依赖 |
| iOS 原生 | outputs/ams-ios/Sources 与工程中 Widget target 的源码 | 需 Mac/Xcode；不要求每次改 Swift 都重生成网页 |
| iOS 网页/工程 | work/ios/*.js/css、prepare.py、Android assets | iOS Assets、AMS.xcodeproj；默认还写后端审核页面，--ios-only 才限定这一额外输出 |
| 小程序 | work/build-miniprogram-product.py；四份接口验证基线源 | outputs/ams-miniprogram；四份输入不在 Git，是已知重生成阻塞 |
| 管理网页 | outputs/ams-admin/src、API-CONTRACT.md、test | Vite dist 是构建产物，不直接改 |
| 统一服务 | outputs/ams-notify/src；复用 activation-tencent/src 四个模块和 schema.sql | 部署脚本组装同一个容器；不得按目录名拆成独立服务 |
| 宣传制作 | work/brand-film-v2、work/phone-opening-proof | 视频/音乐/模型原档本地保存，不能由源码 Git 备份推断素材已备份 |

## 当前存在的中转

```text
共享页面与手写输入
  → build-live-ui.py → Android assets
                         → work/ios/prepare.py → iOS Assets + 工程
                                              → 后端审核页面（默认）
小程序历史接口验证源（四份未入 Git）
  → build-miniprogram-product.py → 小程序生成工程
ams-notify + activation-tencent 四个模块/schema
  → deploy-ams-service.ps1 组装 → 单个 Docker 服务
```

iOS 共享页面脱离 Android 中转是后续目标，本阶段尚未改造。后台审核资产写入也必须纳入生成认领。部署脚本会操作真实服务器，不是本地“打包命令”；不要在开发环境验证时执行。

## 生成文件约定

- 手写源码、生成器、经审查的必要输入应在 Git；即使现在位于 outputs 也一样。
- 现有已纳管生成资源暂时保留，用于追踪平台同步。不要在没有稳定生成链时批量移出 Git。
- 改生成器/输入后，由同一负责人生成相关输出并检查差异；不要手改输出后让下次生成覆盖。
- 先区分预期版本/路径变动与非预期字节变动，再核对资源集合、平台专用修改及最终包内容。签名包不要求跨环境逐字节相同。
- 密钥、学校会话、真实抓包、数据库、私有审核种子不作为缺失输入补入仓库。

## 小程序已知输入缺口

以下源文件由生成器直接读取，现行 .gitignore 没有放行；生成工程存在不表示能重建：

- outputs/miniprogram-interface-probe/utils/ams-login.js
- outputs/miniprogram-interface-probe/utils/portal-sso.js
- outputs/miniprogram-interface-probe/utils/diagnostics.js
- outputs/miniprogram-interface-probe/pages/probe/index.js

下一步应仅提取运行必需且经审查的非敏感方法，迁入正式源码输入，再更新生成器与回归。不能通过提交整份探针、历史捕获或私有缓存解决。

## 文档入口

README 指路；开发指南说明实际运行条件；CONTRIBUTING 说明协作和交付流程。TASKS/项目进度/DECISIONS 由协调方维护；个人工具规则和详细接手资料仅本地保存，不是仓库依赖。旧工程 README 已放入 docs/history，原文保留但不再作为“当前已实现/当前部署”的依据。
