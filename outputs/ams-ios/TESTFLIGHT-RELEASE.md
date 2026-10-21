# TestFlight 0.1.0 (1) 发布准备

仅支持 iPhone，iOS17及以上，竖屏。关闭 Designed for iPad Mac/Apple Vision支持。保留团队 RXNBSDXX58 与 bundle cn.local.ams.ios。新增 UserDefaults 本机存储用途隐私声明、标准系统加密出口声明。服务器接口关闭，模拟分发只在 DEBUG。

Mac Release unsigned archive: ~/Developer/AMS-iOS/release/AMS-0.1.0-1-unsigned.xcarchive。这是编译验证归档，未签名，不能直接上传。

SSH签名归档失败 errSecInternalComponent；钥匙串查询显示 User interaction is not allowed。只有 Apple Development identity，未确认付费团队分发配置可用。

本机 Xcode 打开 ~/Developer/AMS-iOS/AMS.xcodeproj，顶部选择 Any iOS Device (arm64)，Product > Archive。钥匙串授权在本机完成，不向助手提供 Mac 密码。归档成功 Organizer > Distribute App > App Store Connect > Upload。

若没有 App Store Connect App记录，先新建 iOS App（AMS 校园助手、简体中文、bundle cn.local.ams.ios、SKU AMS-IOS），并选择已加入 Apple Developer Program 的团队。若bundle冲突需明确决定新ID，不能上传后随意改。首轮版本0.1.0 build1，若已上传同build需递增。

本轮没有上传到苹果，未确认苹果服务端验证及处理。用户通过本机归档后继续验收上传流程。
