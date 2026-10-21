# iOS 历史开发记录（原工程 README）

2026-10-16 归档。以下保留原文，其中“当前”“最新”、版本、激活、渠道和验证状态仅对应当时，不能用作现行操作指引。当前入口见 [iOS README](../../outputs/ams-ios/README.md)、[开发指南](../development/README.md) 与根目录 TASKS/HANDOFF。

# AMS iOS 开发版 0.1.0

独立 Swift/UIKit/WKWebView 工程，最低 iOS 17。使用当前安卓真实 UI 资源，不含激活码或激活请求。当前是开发版，不是已签名的真机安装包或上架版本。

## 当前验证

- 本轮增加原生加载遮罩和 document-start 就绪检查，AMS/座位/讨论室适配界面未就绪前不露出学校原页面，加载异常显示重试；登录页面正常放行。就绪逻辑回归通过，实际页面过渡仍待用户验收。
- 设置新增 iOS 专用“‹ 返回课表”按钮；主页面背景铺满屏幕，内容按系统安全区域留距，登录页面仍避开系统状态区域。
- 西浦码初始化改到页面显示完成后，已在模拟器实测显示登录方式和图片验证码。`--test-xipu` 仅 DEBUG 可用，不含在正式版本。

- Mac Xcode 27.0 的 iOS 模拟器编译通过，iPhone 17 模拟器安装、启动通过。
- 用户确认学校登录成功，并进入课表。
- 用户发现设置滑动返回学校登录页；已关闭 WKWebView 历史返回，改用 AMS 内部返回。用户再次确认正常返回课表。
- JS 语法、适配资源一致性、Scene 配置、无激活资源检查通过；现有课表跨日/提前结束回归通过。
- 公开服务器配置的空响应、完整响应、错误结构及默认关闭行为检查通过。

## 已接入与待验收

- 课表、出勤、请假、设置、九种主题、深浅色与地图复用安卓实际网页 UI；登录与课表已由用户确认，其他页面与实际业务提交尚待验收。
- 座位/讨论室适配脚本、预约记录和区间车入口已接入。座位/讨论室请求桌面页面以保持已有适配 DOM；Safari/WebKit 下的完整交互与认证兼容性仍待验证。
- 相机扫码使用 AVFoundation，包含取消、对焦、缩放、手电筒和提交去重；需要真机验证二维码畸变识别和真实签到，不保证与安卓识别能力相同。
- 西浦码移植现有 OTP/短信/邮箱协议，令牌存 Keychain，后台停止刷新、清空显示。请求 `mobileSystem=ios`；学校对这一参数及设备校验的实际接受情况尚待验证，不假冒 Android 平台。
- 学校网页登录密码不由应用读取或保存；测试密码不写入任何工程、日志或交接文件。学校退出清理学校 WebKit 会话，西浦码有单独退出按钮。
- 原生西浦码页面保留对应信息层级，精确视觉对齐、正式 App 图标和 iPad 专项验收仍待完成。

## 双机更新

Windows 项目根目录执行：

```powershell
.\work\ios\sync-build.ps1
.\work\ios\sync-build.ps1 -Launch
.\work\ios\sync-build.ps1 -Shutdown
```

分别为同步并编译、编译安装启动、关闭本次 iPhone 17 模拟器。脚本只同步 iOS Sources/Assets/工程/Info.plist，不复制 Android 签名或服务器密钥。Mac 路径为 `~/Developer/AMS-iOS/`；IP 或模拟器变化时使用脚本参数覆盖。开发连接密钥在 Windows 用户 `.ssh/ams_ios_dev`，不随工程交付。

编辑 Swift 源文件后执行更新脚本。网页资产修改应修改既有 UI 来源，生成安卓资产后再运行 `work/ios/prepare.py`；该准备脚本只写 iOS 工程和资源，不运行安卓构建。请勿直接长期修改 iOS Assets 生成文件。

## 服务器预留

`Sources/AppService.swift` 集中设置：默认 `enabled=false`；基地址沿用项目腾讯云域名；路径 `/api/public/ios/config`；appID `cn.local.ams.ios`；platform `ios`；channel `development`；请求超时 8 秒；前台刷新间隔 24 小时；失败后间隔 1 小时再试。新公开接口未部署。

GET 查询只包含 appID/platform/version/build/channel/locale，不含学校账号、密码、Cookie、令牌或设备标识。使用独立 ephemeral URLSession。返回约定：

```json
{
  "schemaVersion": 1,
  "announcement": null,
  "release": null
}
```

公告对象字段 `id/title/message`，更新对象字段 `version/build/url/notes`。公告纯文本，每 ID 提示一次；版本按整数 build 比较，允许稍后，不强制更新，链接只接受 HTTPS 的 App Store/TestFlight 地址。不提供远程停用或脚本执行。

失败、404 或不支持协议时保留有效缓存，不阻断学校业务。启用前需实现服务器接口、验证实际域名及对应渠道更新链接，并补充超时/404/缓存的网络模拟测试。当前默认关闭，不对生产后台进行访问或修改。

## 返回规则

底部四栏负责主页面切换；设置/详情/表单保留网页返回入口；预约与西浦码使用原生返回，扫码使用取消。左边缘右滑调用 AMS 内部返回，首页不返回认证历史。请假有未提交内容时沿用现有放弃确认。

## 发布前

仍需真机扫码、权限、性能、附件上传、学校会话恢复、预约与西浦码验收，以及图标、签名、开发者账号和渠道材料准备。模拟器通过不等于上述验收通过。


固定顶部/内容回弹、顺序预约预加载与设置分组：详见 IOS-INTERACTION-REVIEW.md。新增验证 work/ios/PreloaderChecks.swift；Debug --test-interface 提供事件驱动测试桥与无账户状态文件，普通启动不启用，Release不包含测试桥。预加载不替代学校认证，也不预先保证占用可用；选择地点时读取学校最新状态。
