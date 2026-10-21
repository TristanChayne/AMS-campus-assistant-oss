# iOS 公共配置与模拟分发

客户端入口已启用：AppServiceConfig.enabled=true，使用现有腾讯云域名的 /api/public/ios/config。2026-10-12 服务端路由已部署；读取独立 IOS_PUBLIC_CONFIG 环境变量，未配置时返回空公告 / 空 release，不沿用 Android 的版本号或 APK 地址。此轮不是 APNs 推送部署。

配置 schemaVersion=1。announcement 包含 id/title/message，可选 source/publishedAt/important/url/expiresAt（ISO8601）。有效期截止后不展示；确认 id 后不再展示。普通公告轻量提示，重要公告原生 sheet。应用恢复前台检查配置，学校页面就绪后才能展示；扫码或其他弹窗期间不打断，下次检查再展示。

dailyLines: {version,url,sha256}。url 仅允许与配置服务器同域 HTTPS。句库 JSON 数组，每项 text 非空且最长54字；下载最多8MB，SHA256 完全匹配后保存。失败保留旧缓存。替换仅 dailyLines.cache/version，不动登录和学校 Cookie。今日一句按本地日期保存在网页本地存储，次日使用新库；离线回退内置库。当前内置库与安卓相同，首页课表底部位置相同。

模拟器启动参数 --test-distribution 打开模拟分发界面，仅 DEBUG 编译包含入口。可以编辑公告、切换重要程度、模拟句库更新、恢复内置库、打开主页验收。模拟只影响当前设备，不发送到服务器。模拟公告标明非学校公告；模拟句库是测试缓存，可点恢复按钮清理。

Mac 保留现有 Xcode 项目与手动签名配置，仅同步变动源码/资源。TestFlight 在用户验收后另行配置，不在本次上传。
