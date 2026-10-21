# AMS iOS 工程

Swift/UIKit/WKWebView，含课程实时活动扩展。版本、正式/开发 Bundle ID 和签名配置以实际工程、Info.plist 与包核验为准；不从历史 README 推断当前渠道状态。

- 手写原生源码：`Sources/`，扩展源码通过工程中的 Widget target 定位。
- 平台适配与生成：`../../work/ios/`；`prepare.py` 从 Android assets 复制并适配共享网页，生成 `Assets/` 和工程配置。
- 只需生成 iOS 时使用 `python work/ios/prepare.py --ios-only`（在仓库根目录）。此命令仍会写工程/资源；先确认共享资源归属与输入齐备，备份 Mac 手动签名差异。无参数还会写后端审核页面，不应作为新人检查命令。
- 无凭证逻辑检查：根目录 `python -B tools/repo/manage.py check --profile smoke`，包含扫码解析与资源对照；不执行 Swift/Xcode 编译。
- 原生编译需要 macOS/Xcode、正确目标及设备配置。`sync-build.ps1` 会同步并操作远端工程，含本机默认值；先核对目标，不机械使用 `-Launch`，正式与旧开发 Bundle ID 可能共存。

学校账户、绑定、激活、云端提醒与真实业务验收以根目录 DECISIONS/TASKS/项目进度最新条目为准。现有 IPA 与后续源码阶段并非同一内容；顶栏恢复等待验事项仍保留。

环境与依赖见 [开发指南](../../docs/development/README.md)、[源码地图](../../docs/development/source-map.md)。[历史开发记录](../../docs/history/ios-development-notes.md) 保留早期“开发版”原文，不代表当前功能或发布状态。
