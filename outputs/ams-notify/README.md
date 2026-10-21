# ams-notify

开发入口（2026-10-16）：这是当前统一服务，复用相邻 ams-activation-tencent 的激活模块，不是单独的提醒微服务。新人先看 [开发指南](../../docs/development/README.md) 和 [源码地图](../../docs/development/source-map.md)。在仓库根运行 `python -B tools/repo/manage.py check --profile service`，使用合成数据/临时存储/本机回环，不部署。Dockerfile 还需要组装的 activation 源码及 schema，直接在本目录 docker build 并不完整。下文迁移与部署为受控运维操作，不是开发环境初始化步骤。

D-023：Android 普通消息改为打开/回前台取得，不接厂商/聚合SDK。`/api/client/check` 携带已读标识并在签名文本末尾追加 `AMS-INBOX-1` 与JSON数组，返回签名messages（每次最多10条）。新版安装报告收件能力后才计作目标，发布时固定设备与all/test范围；已读只确认本安装。Android状态为available_in_app，offeredCount仅说明在校验回复中提供内容，readCount为签名已读确认；不依赖APNs、不生成Apple推送记录。新增installations.inbox_supported列为默认0的幂等迁移，旧客户端/iOS签名协议保留。具体约束见 `outputs/ams-admin/API-CONTRACT.md` 第9节。

## ADMIN-BE-001：统一 AMS 服务（激活、设备、管理接口）

同一容器同时承载课程提醒推送（下文 REMIND-001）、原腾讯云激活服务（`outputs/ams-activation-tencent/src/worker.mjs` 原样运行，经 node:sqlite 的 D1 适配）、设备登记与管理后台接口。全部数据在同一个 SQLite 文件，每日备份同下。

| 路径 | 说明 |
|---|---|
| `/api/activate`、`/api/check`、`/api/demo/*`、`/api/public/ios/config` | 原激活协议不变；`/api/check` 的签名 `enabled` 现为“激活码启用且本设备启用”并按指纹懒认领设备；已停用设备再激活返回 403 `DEVICE_DISABLED`（不占额度） |
| `POST /api/client/check` | 每次打开 / 回前台校验（协议 2）：`{grant,nonce,platform,account:{name,revision},publicKey,proof,appVersion,model,bundleId}`，proof 签 `AMS-CHECK-2\n grant\n nonce\n platform\n revision\n name\n bundleId\n appVersion\n model`；返回 `{status}`，签名载荷（v=2）含 installationId、enabled / codeEnabled / deviceEnabled、account{name,revision}、release{android,ios}、announcements（≤3）。账户名变化时服务端在同一事务清除旧账户的云端课表、待发提醒和活动状态 |
| `/api/admin/{login,profile,logout,codes,update,settings,credentials}` | 原管理接口不变 |
| `GET /api/admin/overview` | 激活、设备（启用 / 停用 / 待关联 / 今日通讯）、待发送、Apple 接收、服务状态 |
| `GET /api/admin/devices[?q,platform,state,codeId,cursor,limit]`、`GET/PATCH/DELETE /api/admin/devices/:id` | 每台安装一条（服务端生成 `AMSD-XXXX-XXXX-XXXX`），PATCH `{enabled,confirmed:true}` 单独停用 / `{test}` 测试设备；DELETE 幂等，只删上传的课表 / 提醒 / token，保留安装身份与停用。activatedAt 只记本服务见到的激活时间，迁移预建的为 null |
| `/api/admin/announcements`（GET/POST）、`/:id`（PATCH/DELETE）、`/:id/publish`、`/:id/withdraw` | POST 按 `clientRequestId` 防重复草稿；已发布 / 排期中禁止 PATCH，须先下架；publish / withdraw 需 `confirmed:true` 与 `idempotencyKey`；每次发布递增 revision（客户端公告 id = `id.revision`，重新发布会再次显示）；`push:true` 需 `audience`、正文 ≤500 字且非仅 Android |
| `/api/admin/messages`（GET/POST）、`/:id`（GET/PATCH）、`/:id/submit`、`/:id/retry` | iOS普通通知（APNs alert）或Android App内消息（打开后获取），POST 按 `clientRequestId` 防重复，提交 / 重试需 `confirmed:true` 与 `idempotencyKey`；接收记录的 accountName 为发送时快照 |
| `GET /api/admin/apns`、`GET/PUT/POST /api/admin/ios-config` | 推送状态与记录（密钥标识打码）；Apple 版本信息 |

错误统一 `{message, error:{code,message,fields?}}`；激活密钥未配置时激活与管理路由返回 503 `SERVICE_NOT_CONNECTED`。设备 secret、完整推送 token、密码、Cookie 从不返回。

课程提醒登记：新版附安装证明 `link`（proof 签 `AMS-LINK-1\n grant\n deviceId\n nonce`）关联安装；不带 link 的登记（ADMIN-BE-001 之前的构建）兼容保留为待关联记录，已关联记录省略 link 不会降级。停用安装不能登记、写入或被推送（403 `DEVICE_DISABLED`，撤回 `DELETE /device` 仍可用）。`PUT /timetable` 带 `accountRevision`：已关联安装只接受当前账户代次且账户非空的上传，迟到的旧账户上传返回 409 `STALE_ACCOUNT`；不带 accountRevision 的旧构建不能覆盖已采用协议 2 的安装。

过渡风险：待关联（无证明）的旧登记无法单独停用或防换 UUID，只能由后台删除其上传数据；新版构建全部带证明。

### 迁移与切换（依次执行，切换前须用户确认）

1. 本机 `tcb env list` 刷新登录后 `node work/export-activation-tencent.mjs`（只读，写入仓库外私有目录，仅打印条数与摘要）。
2. 把导出文件传到服务器，容器内 `node src/import-activation.mjs <export.json>`（目标非空会拒绝），核对摘要与导出一致。
3. `/etc/ams-notify/ams-notify.env` 写入原 `SIGNING_KEY`、`CODE_PEPPER`、`SESSION_SECRET`（不得重新生成）及新的 `AMS_PROXY_KEY`，重启；`node src/verify-activation.mjs --public-key <App 内置公钥>` 全部通过。
4. 腾讯云函数 `ams-activation` 改为部署 `outputs/ams-activation-tencent/proxy/index.js`（环境变量 `AMS_TARGET`、`AMS_PROXY_KEY`），旧域名的已装 App 继续可用，`/admin` 跳转新后台。
5. 再导出一次并 `--delta` 导入，补上切换窗口内的变动。

REMIND-001 课程提醒推送服务：根据用户授权上传的 3 天课表，按时通过 APNs 启动、更新、结束 iOS 实时活动（灵动岛 / 锁屏）。Android 不经过本服务。

- 运行：Node 24（内置 `node:sqlite`、`http2`、`crypto`，无第三方依赖），SQLite 单文件。
- 入口：`https://ams.tristanchayne.com/api/notify/*`，宿主机 nginx 反代至 `127.0.0.1:18640`。
- 数据：设备 ID、设备密钥哈希、push token、课表（日期 / 时间 / 课程名 / 代码 / 教室 / 地点）、提醒偏好；按 D-019/D-020，统一安装登记还关联当前学校登录用户名。学校密码、Cookie、学校令牌不上传。课表/提醒按现行清理规则处理；撤回课表上传与删除安装身份有不同语义，不能把旧提醒服务的 `DELETE /device` 描述理解为删除整个安装登记。字段和协议以当前 API-CONTRACT、源码与根目录决定为准。

## 接口

除 `register` 外都需要请求头 `X-AMS-Device: <deviceId>` 和 `Authorization: Bearer <secret>`。

| 方法 路径 | 请求体 | 说明 |
|---|---|---|
| GET /health | — | 健康检查 |
| POST /register | `{consent:true, deviceId, secret, platform:"ios", bundleId, apnsEnv:"sandbox"\|"production"}` | 必须带用户同意；同一 deviceId 只能用原密钥重注册 |
| PUT /token | `{startToken}` | push-to-start token（hex），`null` 清除 |
| PUT /timetable | `{courses:[{key, date:"YYYY-MM-DD", start:"HH:MM", end:"HH:MM", title, code, room, location}]}` | 整体替换；`end` 为显示下课时间（原时间减 10 分钟）；时间按北京时间 |
| PUT /prefs | `{enabled, leadMin:5\|10\|15\|20\|30, merge, mutedCodes:[], skipKeys:[]}` | 重新排程 |
| PUT /activity | `{chain, updateToken?, local?, ended?}` | 上报活动更新 token、本机已启动 / 预约、用户已结束 |
| DELETE /device | — | 撤回同意，删除全部数据 |

## 排程

`src/schedule.mjs` 为纯函数：课前 `leadMin` 分钟 `start`，上课 `update(during)`，连堂（间隔 ≤ 30 分钟、总时长 ≤ 8 小时）在下课时 `update(before 下一节)`，最后下课 `end`，`dismissal-date` 为下课后 5 分钟；打开时已开课则立即以 `during` 启动。`content-state` 使用纪元秒，与 iOS `CourseActivityAttributes.ContentState` 对应：

```json
{"phase":"before|during|after","title":"","code":"","room":"","location":"","start":0,"end":0,"next":{"title":"","code":"","room":"","start":0,"end":0}}
```

调度器每 15 秒发送到期且未超过 10 分钟的事件，每个事件只发一次；缺 token 记 `no-token`，APNs 410 / BadDeviceToken 清除 token。未配置 APNs 密钥时记 `no-key`，不发送。

## 测试

```bash
npm test
```

## 部署（服务器 /opt/ams-notify）

1. `/etc/ams-notify/ams-notify.env`（chmod 600），参考 `ams-notify.env.example`；APNs `.p8` 放 `/etc/ams-notify/keys/AuthKey.p8`，属主 uid 1000、chmod 400。密钥不进 Git。
2. `data/` 属主 uid 1000（容器内 `node` 用户）。
3. `docker compose up -d --build`；`curl https://ams.tristanchayne.com/api/notify/health`。
4. 备份：服务每天用 `VACUUM INTO` 写 `data/backup/ams-notify-YYYY-MM-DD.sqlite`，保留 7 份。
