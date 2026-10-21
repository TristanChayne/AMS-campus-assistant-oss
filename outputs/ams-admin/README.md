# AMS 管理工作台前端

ADMIN-FE-001：用户授权 前端维护方 完成设计、交互与新服务器部署；真实后台由用户交 服务端维护方 接入。

入口：<https://ams.tristanchayne.com/admin/>。默认直接核验同源 HttpOnly 登录会话，有效时自动读取真实业务数据；未登录显示正常登录页，沿用原管理员账户。刷新/深链接恢复有效会话；401 清空私密数据并回登录页，退出不回演示。默认没有“连接管理后台”按钮或示例数据。仅显式 `?preview=1` 可查看虚构交互预览，预览内操作只在内存，不请求业务接口。管理密码和会话令牌不存 localStorage。

## 页面与操作

- 工作台：设备授权、最近通讯、当前生效公告、服务及 Apple 推送状态；不展示个人课表。未知正式指标显示待接入，真实空数据不补演示。
- 激活管理：搜索、状态筛选、创建时间排序、分页；右侧详情、生成、复制、调整额度、补录原码、启用/停用、重置与条件删除。保持现有激活语义，没有添加到期授权或批量写入。
- 设备与账户：搜索当前学校账户、设备编号或激活备注，筛选平台与授权。每台设备独立编号，显示当前账户及更新时间；单设备停用不影响同码其他设备，启用不能绕过整码停用。云端课表在详情按需读取；清除课表与提醒保留身份和授权关联。
- 应用公告：草稿、发布、北京时间定时、结束时间、下架与 App 排版预览；发布默认不推送。额外 Apple 通知需主动选择，默认测试对象；Android 专属公告不可选 Apple 通知。已发布/计划发布的公告先下架再修改；首页只展示当前生效的公告。
- 消息推送：独立 Apple 通知，草稿、锁屏预览、测试/全部对象、北京时间定时、最终确认和失败重试；创建及提交使用固定幂等键，创建响应丢失后改正文会先保存新内容再提交。已提交不等于送达。
- Apple 推送：配置状态、测试/正式环境、灵动岛和普通通知能力、提交结果与原因。密钥仅展示标识，不在网页上传私钥。
- 设置：版本信息、管理员账户修改，保留旧验证间隔字段兼容；新版每次打开/进入前台通讯由客户端和服务实现，网页设置不代表 App 已更新。
- 应用发布：首页一个按钮，鼠标悬停下拉 Android 发布 / Apple 发布，触摸点击和键盘也可打开；直达已核对的应用管理页。

用户补充已纳入 D-020 和 ADMIN-BE-001：服务端用原安装密钥/授权幂等认领稳定 installationId，不额外扣额度或强制重新激活；Android/iOS 当前学校账户随登录/切换/退出同步，每次打开/进入前台合并通讯，保留旧协议兼容。Android 课表仍本机，iOS 上传仍需授权；只上传必要数据。源码和真实验收由 服务端维护方 交付。

## 设计依据

操作者是维护 AMS 的项目负责人：先判断设备授权与通讯，再处理具体设备和公告。界面采用安静的工作区，中文系统字体与等宽数字，浅灰蓝纸面 `#f3f5f8`、工作台白 `#ffffff`、文字 `#273449`、次级文字 `#58677f`、动作蓝 `#2d66df`、状态绿 `#1f734d`；紧凑表格与侧边详情保持上下文。避免装饰性循环动画、无来源增长曲线、相同尺寸卡片堆叠。

参考本地 frontend-design-principles、ui-ux-pro-max、data-table-admin-ui；联网核对 [Anthropic frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)、[Carbon DataTable](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines)、[Motion 动画与可访问性](https://motion.dev/docs/react-accessibility)。UI/UX 数据库的营销/深色推荐与本任务不匹配，按操作场景选取了交互检查项，而未照搬整套风格。

交互动画以 150–240ms transform/opacity 为主，抽屉、页面、选中项与反馈连续过渡。根部 MotionConfig 遵循系统减少动态效果；CSS 亦降级。桌面与手机响应式，原生 dialog 提供键盘焦点约束和恢复；手机关闭的侧栏 inert；可见焦点和跳到主要内容入口。编辑中 Ctrl/⌘K 不替换弹窗，关闭未保存编辑需确认。

## 构建与检查

Node 24；React + TypeScript + Vite + Motion + Lucide。运行时不依赖外部字体、CDN或图片服务。

```powershell
npm ci
npm run build
npm test
npm run dev -- --port 4319 --strictPort
npx playwright test
```

构建输出 `dist/`、node_modules、测试截图与报告不纳 Git；构建可重复由 package-lock 锁定。浏览器测试使用本机 Edge，覆盖桌面/390px 手机、七模块、设备独立停用、公告生命周期、发布菜单、通知预览、北京时间、401/503/HTML 错误、暗色和减少动画。业务请求全部拦截，不产生真实停用、公告或推送。`AMS_ADMIN_BASE_URL` 可指向生产静态部署。前端检查不代表数据库迁移、真实推送或手机验收。

## 接入与部署

[API-CONTRACT.md](API-CONTRACT.md) 是 服务端维护方 对接入口，详细记录现有 API、新接口、账户名、时间单位、会话、危险操作、消息幂等和 APNs 语义。

静态页面部署至新服务器 `/opt/ams-admin/releases/<release-id>`，网站 `/www/wwwroot/ams.tristanchayne.com/admin` 是当前版本符号链接。保留现有 `/api/notify/`、根页、证书与其他站点。部署程序仅管理 nginx 中 `ADMIN-FE-001` 标记块，部署前备份站点配置与旧链接，验证 nginx 后 reload，失败恢复。

```sh
python3 deploy.py <dist.tar.gz> <unique-release-id>
```

前端阶段 `/api/admin/` 明确返回 JSON503。服务端维护方 后端就绪后，只将此占位 location 替换为新服务器已认证 API 的反代，保留静态与安全响应头；不能反代回旧服务器当成完成迁移。API location 位于前端管理标记块之外，后续前端部署会保留 服务端维护方 的 API 配置。管理 Cookie 的 Path=/api/admin，与同源相对 API 配合。

回退：以 `/opt/ams-admin/backups/<release-id>/nginx.conf` 与 `admin-link.txt` 为依据，先确认没有其他维护者的后续配置改动，再恢复该站点配置与旧链接，nginx -t 后 reload；不清理数据库、推送数据或其他项目镜像。

Android/iOS/小程序客户端本阶段均未修改、未重新打包；后台完整迁移、稳定设备编号/账户同步/每次打开通讯、独立公告 App 拉取、普通通知注册、APNs 密钥和真实验收由 ADMIN-BE-001 交付。
