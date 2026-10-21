# AMS 统一管理后台接口接入契约

任务：`ADMIN-FE-001` / `ADMIN-BE-001`。修订日期：2026-10-13。依据：main `d721d58` 的 TASKS 补充及 D-020；与旧说明冲突时采用本轮已确认范围。前端目标字段以 `outputs/ams-admin/src/model.ts` 为准，管理 API 同源使用 `/api/admin`。

本文区分已有能力与待接入契约，不代表后端、客户端、迁移或真实推送已经完成。

## 1. 分工与真实状态

- 前端维护方：网页后台、布局与动画、前端 API 适配、静态构建/部署和本契约。首页展示设备授权、最近通讯、当前生效公告；课程在设备详情按需查看，不在首页造个人课表。
- 服务端维护方：ADMIN-BE-001 的激活运行时及数据库完整迁移、管理 API、稳定安装身份、独立停用、账户同步、独立公告、消息任务、APNs及两端App接入。客户端包括 Android Activation.java / MainActivity.java，iOS ActivationController.swift / ActivationCadence.swift / 生命周期与学校账户来源；共享生成器仍按REMIND-001独占协调。
- Android/iOS都登记设备元数据、关联当前学校账户、通讯校验授权；Android课表与课程提醒继续本机。iOS云端课表仍须独立授权，不因设备登记扩大上传范围。小程序本轮不改。
- 静态上线、真实API、旧服务器退出承载、新客户端包、Apple接收和手机收到/展示分别验收。迁移保留SIGNING_KEY / CODE_PEPPER / SESSION_SECRET、授权和额度，不重新生成材料或强迫已有安装重激活。
- 未实现/不可用能力返回 **HTTP 503 JSON**，不回静态HTML、假成功或示例记录。真实空库返回空列表/真实零，未知指标为null。
- 演示只用内存，`demo.student01`、`DEMO-INSTALL-0001`均为虚构。创建/修改/发布/下架/提交/重试/停用/删除不请求真实写接口；正式失败不自动补演示。

## 2. 认证、错误与响应包装

沿用Cookie `ams_admin`：`HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=3600`。前端 `https://ams.tristanchayne.com/admin/` 相对请求 `/api/admin/*`，同源携Cookie，不保存管理密码/令牌到localStorage，不借用设备Bearer secret。

网页默认 GET `/api/admin/profile` 核验 HttpOnly 会话，有效则自动载入真实数据；未登录401正常显示登录页，不误报会话过期。已登录后的任一401清空数据、关闭操作并回登录页。刷新及深链接自动恢复会话，退出不回演示；默认无连接步骤或示例。仅显式 `?preview=1` 启用隔离预览且不读取业务API。

管理非GET请求校验`Origin === Request URL origin`。新服务器按实际新域名构造Request并正确处理可信反代，不能继续写死腾讯云origin。新增管理API均在Cookie Path下，不以跨域CORS或客户端读Cookie绕过。

返回JSON Content-Type和Cache-Control:no-store；不统一套data。旧形状保留，新增包装如下：

| 接口（`/api/admin`前缀） | 成功响应 |
|---|---|
| GET `/overview` | Overview对象 |
| GET `/devices` | `{items:Device[],nextCursor?,total?}` |
| GET `/devices/:id` | `{device:Device,courses:Course[]}` |
| PATCH `/devices/:id` | `{device:Device}`，前端重新读取真实列表/详情 |
| DELETE `/devices/:id` | `{ok:true}`，前端重新读取真实列表/详情 |
| GET `/announcements` | `{items:Announcement[],nextCursor?,total?}` |
| POST/PATCH `/announcements`及publish/withdraw | `{announcement:Announcement}` |
| GET `/messages` | `{items:Message[],nextCursor?,total?}` |
| POST/PATCH `/messages`及submit/retry | `{message:Message}` |
| GET `/apns` | ApnsState对象，含records |

总量未知时total省略/null，不把当前页长度当全量。新增时间ISO8601带时区，按Asia/Shanghai展示；旧激活秒级Unix时间/snake_case保留，notify毫秒由后端转换。

```json
{
  "message": "管理服务尚未接入，请稍后重试。",
  "error": {"code": "SERVICE_NOT_CONNECTED", "message": "管理服务尚未接入，请稍后重试。"}
}
```

错误兼容message/error.message，可附error.fields。401管理会话失效，清私密数据重新登录；403来源/权限/设备明确停用；409 revision/条件冲突；422新增字段或能力不支持；429限流；503未接入/异常，旧400仍兼容。App错误DEVICE_DISABLED与未知登记/凭证失效必须区分，不以生成新UUID恢复被停用设备。

## 3. 旧激活码与设置接口

来源：`outputs/ams-activation-tencent/src/worker.mjs`。方法/路径/形状保留：

| 方法路径（`/api/admin`前缀） | 请求 | 成功 |
|---|---|---|
| POST `/login` | `{username,password}` | `{ok:true}`、Set-Cookie |
| GET `/profile` | — | `{username}` |
| POST `/logout` | `{}` | `{ok:true}`、清Cookie |
| GET `/codes` | — | `{codes:Code[]}` |
| POST `/codes` | `{mode:"normal"或"demo",note,maxUses}` | `{id,code}` |
| POST `/update` | `{id,action,...}` | `{ok:true}` |
| GET `/settings` | — | `{interval_days,version_code,version_name,download_url,release_notes}` |
| POST `/settings` | `{intervalDays,versionCode,versionName,downloadUrl,notes}` | `{ok:true}` |
| POST `/credentials` | `{username,currentPassword,newPassword}` | `{ok:true}`，所有旧会话失效 |

Code：id/note/enabled/created/device/issued/max_uses/used_count/remaining/code/mode；enabled为0/1，device/issued/code可null，created/issued单位秒；code=null表示历史未保存可解密原码。mode=normal|demo。旧codes最近200条，前端本地统计仅已加载范围，完整总量从overview读取。

| update action | 附加 | 保留语义 |
|---|---|---|
| enable | — | 启用码，不解除独立设备停用 |
| disable | — | 停用码影响其全部设备，下次成功通讯获知；离线不是即时停用 |
| reset | — | 清绑定集合/最后指纹/used_count，恢复额度，保留issued；原授权仍可用；不清安装身份或独立停用 |
| quota | maxUses | 1–10000整数且不小于used_count |
| saveCode | code | 补录原哈希一致码，不换码 |
| delete | — | 仅enabled=0、used_count=0、issued=null、device=null；已激活后reset不能删除 |

停用/重置/删除确认显示备注、记录编号与影响；reset说明已有安装仍可使用。重复激活不重复计数，demo沿用审核演示；note≤100字符，码明文仅认证后返回，不进日志/静态资源。

Settings仍校验intervalDays 1–365整数、versionCode 0–2147483647整数、versionName≤40、notes≤2000、downloadUrl无用户名密码HTTPS且≤500字符。**interval_days/intervalDays仅旧协议兼容；新版固定每次打开通讯，不写0到旧字段，不让该值恢复新版几天一次策略。** 新UI不以旧周期控制新版，保存版本保留合法旧周期。配置保存不等于APK/IPA发布。

管理员username 3–80字符、当前密码必验；newPassword空仅改名，填写10–128字符且核对两次；改名也令旧会话失效。Android与iOS版本配置独立。

## 4. 稳定安装身份、认领与独立停用

canonical installationId由服务器生成，管理Device.id为该值；不以账户名、码ID、token或客户端自选UUID替代。它证明同一安装密钥身份，不承诺永久识别物理手机。

原grant.device是RSA公钥SPKI SHA-256，grant.grant是同码设备共用的码记录ID；bound_devices存各指纹，activation_codes.device仅最后激活指纹。原grant为v/app/device/grant/issued及可选mode；两端旧协议app均cn.local.ams，不改成实际iOS bundleId。

服务器指纹唯一映射installationId，activate/check验证原grant/私钥后幂等认领，重复同指纹同编号。升级不重输码、不扣新额度、不重签旧grant；迁移可预建已知指纹，reset后集合已清但仍有有效grant者验证后懒认领，不能用安装表条数重算used_count。

保留`/api/activate`、`/api/check`旧请求grant/publicKey/nonce/proof、AMS-CHECK-1签名域，以及签名status的v/app/device/grant/nonce/enabled/intervalDays/release；新installationId、账户结果、公告/平台版本作为扩展返回并签名保护，旧客户端忽略未知字段。device/grant原义不替换。

授权有效条件为`codeEnabled && installation.deviceEnabled`。旧/check按验证的fingerprint查独立状态，同码另一安装不受影响。activate/claim/register、notify鉴权和发送前均检查canonical停用；换notify UUID、再登记、码reset/enable、再次授权不能解除安装停用。

旧notify deviceId是UUID+secret，无激活指纹关联。合并需证明旧secret与原安装私钥，不能按账户/IP/码猜；客户端installationId文字也不自证。现有已部署iOS的`POST /api/notify/register`不含link：兼容期须明确保留旧请求及现有UUID+secret鉴权，不能在activation配置ready后就将link全面改成必填、拒绝全部老版本。新版登记带安装证明；旧无证明记录保留legacy_pending，不能据此假装已认领、覆盖已关联安装或解除canonical停用，已关联设备不得通过省略link降级成未关联设备。旧无证明注册的独立停用/防换UUID能力有限，服务端维护方须说明过渡范围及风险，不用账户/IP/码猜测补齐授权映射。

Android缺marker会删旧RSA钥匙生成新钥匙；iOSmarker现只清grant，RSA钥匙可能延续重装。保留既有行为并验同指纹同ID；真正新密钥/新手机按新授权额度处理。旧版不/check或离线不能即时停用，旧URL转发/新客户端域名切换分别验收。

## 5. 两端每次打开通讯与当前账户

新Android/iOS每次冷启动、重新进入前台通讯校验，合并同一启动/前台转换并发为一次，不是每次点击联网。新版不受旧几天一次cadence限制；一次响应合并授权、账户同步、应用公告与平台版本。网络超时/503和签名enabled=false区分，不把离线伪装停用。

客户端新增platform/bundleId/appVersion/model/currentAccountName/accountRevision与安装证明/编号，可用兼容扩展对象；由服务端维护方统一两端协议并测试。currentAccountName为正在使用的学校登录用户名，null表示明确退出；旧客户端缺字段代表不支持，不能清空新版关联。元数据/账户payload要与已验证安装和请求内容绑定，可另加域隔离同步签名覆盖nonce及规范化扩展payload，保留原proof兼容；不可只凭ID或accountName写别人设备。

- 登录更新当前账户；切换与退出必须清除旧账户已授权上传的云端课表、提醒任务及关联活动状态，切换后替换账户，退出置null；安装编号/激活授权/独立停用不变。账户是客户端同步信息，不是服务器独立核验的学校身份，不作设备唯一键或权限。
- 服务端以accountRevision/会话代次在事务中接受账户更新并清旧数据，客户端串行、重复幂等。新版`PUT /api/notify/timetable`必须携accountRevision并绑定已验证安装和当前账户；事务中仅接受当前有效revision且currentAccountName非null的上传，旧revision/代次迟到不得覆盖账户、恢复已清课表或重建旧提醒任务。旧客户端缺revision须有明确兼容策略，不能覆盖已采用新版账户代次的安装。
- 认领/重装从服务器取得revision基准/新会话代次，不能客户端计数归零后永久拒绝，也不能改计数接管其他安装。
- 离线退出先清本机，保留待同步清除；后台显示最后同步账户及时间。下次通讯先同步退出/切换，再传新账户课表，不承诺离线即时准确。

两端设备登记及账户关联与云端课表开关分离。Android课表仍不上传：真实云端courseCount/pendingCount为0，timetableUpdatedAt/coverageUntil为null；缺token不影响已激活状态。iOS授权后上传3天课表，撤回删除云端课程/提醒数据，保留激活身份/授权/停用。两端客户端说明对齐新账户范围，旧说明下的授权按既有修订要求处理；界面不反复插入技术隐私解释，API/日志仍禁止密码、验证码、学校Cookie和令牌。

## 6. 总览：GET `/api/admin/overview`

```ts
type Overview = {
  asOf:string;activationCount:number|null;deviceCount:number|null;
  activeDeviceCount:number|null;disabledDeviceCount:number|null;
  legacyDeviceCount:number|null;connectedTodayCount:number|null;
  pendingCount:number|null;acceptedCount:number|null;
  services?:{activation:ServiceState;notify:ServiceState;apns:ServiceState};
};
type ServiceState = {
  status:"ready"|"not_configured"|"unavailable"|"not_connected";
  message?:string;checkedAt?:string|null;
};
```

activationCount码总量、deviceCount安装总量；active/disabled/legacy按activation.state统计，unbound另存在，不强行三项等于总量。connectedTodayCount是北京时间今天成功通讯的独立安装数，不是请求次数/永久在线。pendingCount有效待任务；acceptedCount声明统计范围内Apple接收请求数，非收到人数，可附rangeStartAt。未知null，真实0；health ok只说明进程，不证明APNs/真机。正式无数据不得填演示。

## 7. 设备列表、状态与按需课表

```ts
type Device = {
  id:string;accountName:string|null;platform:"ios"|"android"|null;
  model:string|null;appVersion:string|null;bundleId:string|null;
  apnsEnv:"sandbox"|"production"|null;lastSeenAt:string|null;
  accountUpdatedAt:string|null;accountRevision:number;
  activation:{codeId:string|null;note:string|null;
    state:"active"|"disabled"|"unbound"|"legacy_pending";
    codeEnabled:boolean|null;deviceEnabled:boolean;
    activatedAt:string|null;checkedAt:string|null};
  timetableUpdatedAt:string|null;courseCount:number;pendingCount:number;
  coverageUntil:string|null;tokenState:"ready"|"missing";
  prefs:{enabled:boolean;leadMin:number;merge:boolean};courses?:Course[];
};
type Course = {key:string;date:string;start:string;end:string;
  title:string;code:string;room:string;location:string};
```

GET `/devices`→`{items,nextCursor?,total?}`，可支持q/platform/status/cursor/limit，q搜账户/编号。GET `/devices/:id`→`{device,courses}`，详情打开才读课表，列表可省courses。id为server安装ID；待关联旧条目可用明确legacy编号但不伪装已认领，canonical状态操作只用于已验证身份。

客户端currentAccountName映射管理accountName；accountUpdatedAt仅接受账户更新时变，lastSeenAt是最近成功通讯，不冒充账户/课表同步；迁移预建尚未通讯者为null，不能填激活时间或当前时间。platform未知为null，前端显示“待识别”，不能猜Android；model/appVersion/bundleId/apnsEnv未知同样为null。Android没有APNs环境，apnsEnv为null；iOS未获知环境也为null，不造production。activatedAt取此安装真实关联时间，不能用同码共有issued伪造；checkedAt为最近成功核验。state=disabled当码或设备明确停用，active需有效原grant/可验证码与安装映射且码和设备均启用，即使平台及元数据尚未知也可active；unbound无授权，legacy_pending专指缺可验证授权映射，不能仅因平台未知标待关联。课表/token/APNs及元数据完整度不决定授权。

coverageUntil按日期覆盖元数据，不把今天无课当过期。Course日期YYYY-MM-DD、start/end HH:MM北京时间，end已是显示下课时间，不再减10分钟。iOS≤60节；服务仅管理已上传快照，不保证主动读学校课表。

| 操作 | 请求/响应 | 范围 |
|---|---|---|
| PATCH `/devices/:id` | `{enabled:boolean,confirmed:true}`→`{device:Device}`，成功后reload | 仅此安装deviceEnabled，不改码或同码其他设备 |
| DELETE `/devices/:id` | 无body→`{ok:true}` | 清云端课表、提醒设置/token、活动及待任务；保留安装身份/授权关联/停用状态 |

确认显示编号/账户/影响，后端重新校验权限；启用安装不启用已停用码。删除不是注销授权/永久封禁，也不删身份以免再register绕过。成功前端reload，不把安装从列表移除；不删手机本地缓存。旧手机DELETE `/api/notify/device`撤回也不清独立停用身份。后台不返secret/hash/私钥/完整token/学校凭证，不推算姓名/学号；含账户的记录不宣称完全匿名。

## 8. 独立应用公告：`/api/admin/announcements`

公告由App拉取展示，发布默认不发APNs；管理员明确选择额外通知时才建立独立普通通知任务，不把公告状态当推送结果。

```ts
type Announcement = {id:string;title:string;body:string;
  platform:"all"|"ios"|"android";
  status:"draft"|"scheduled"|"published"|"withdrawn";
  publishAt:string|null;expiresAt:string|null;
  createdAt:string;updatedAt:string;revision:number};
```

| 方法路径 | 请求 | 响应 |
|---|---|---|
| GET `/announcements` | 可选q/status/platform/cursor/limit | `{items,nextCursor?,total?}` |
| POST `/announcements` | `{title,body,platform,publishAt,expiresAt,clientRequestId}` | 201 `{announcement}`，草稿 |
| PATCH `/announcements/:id` | `{revision,title,body,platform,publishAt,expiresAt}` | `{announcement}`，保存未发布内容 |
| POST `/announcements/:id/publish` | `{revision,confirmed:true,idempotencyKey,push?,audience?}` | `{announcement}`，立即published或未来scheduled |
| POST `/announcements/:id/withdraw` | `{revision,confirmed:true,idempotencyKey}` | `{announcement}`，withdrawn并取消计划/对外生效 |

publishAt/expiresAt为ISO/null；null publishAt在确认时取服务器时间，expiresAt晚于实际发布。title≤120、body≤4000。首页生效为published且发布时间已到、未过期；到期仍可保留published历史但不生效，scheduled由服务端任务到点发布，浏览器不代排程。

创建草稿clientRequestId为固定编辑会话UUID，服务端按管理员与此key幂等返回同一草稿，丢失创建响应后不能新建重复记录；适用于公告与消息POST。push为boolean、默认false；true须最终确认中明确“额外发送iOS普通通知”及audience=test|all。公告body超过500字符不能额外推送，前端与后端都校验；platform=android禁止Apple通知。后端先核能力/范围，再幂等生成可在messages查询的独立notification任务；推送不可用先422/503，不留下不明半完成成功。入队后的Apple结果在通知任务体现，不改成公告已收到。

**保存草稿不直接改线上。** 最小语义：published/scheduled禁止PATCH，先withdraw再编辑保存，重新publish，后端同样强制。下架到客户端下次通讯才可确认，不宣称立即收回缓存。修改重新发布需新发布身份（id+发布revision等）让已确认旧公告的客户端能见新版；publish/withdraw同一次超时重试保持幂等key，既有幂等结果先于revision校验。publish超时后保留已保存id/revision/key，重试同次publish不重复PATCH草稿。

新版一次/check带回对应平台生效公告；独立公告为持久真源。旧iOS单announcement投影选一条生效公告，body映射message，使用稳定发布身份；旧Android未支持公告不宣称收到。旧messages中channel=announcement迁至此集合且不重复发布/发送，不能改notification后群发。

## 9. 普通消息：`/api/admin/messages`

Message为notification；iOS走APNs，Android按D-023在打开/回前台时取得App内消息，公告另入口：

```ts
type Message = {id:string;title:string;body:string;
  channel:"notification";platform:"ios"|"android";audience:"all"|"test";
  scheduleAt:string|null;
  status:"draft"|"scheduled"|"queued"|"sending"|"accepted_by_apns"|"available_in_app"|"partial"|"failed";
  createdAt:string;revision:number;reason?:string;retryable?:boolean;
  recipientCount:number|null;acceptedCount:number|null;failedCount:number|null;
  availableCount?:number|null;offeredCount?:number|null;readCount?:number|null};
```

GET `/messages`→`{items,nextCursor?,total?}`。POST接收title/body/channel/platform/audience/scheduleAt/clientRequestId，201 `{message}`仅草稿；clientRequestId沿用固定编辑会话UUID并服务端去重。PATCH `/messages/:id`带revision及修改字段，`{message}`仅允许编辑状态。旧announcement迁至独立公告并从新messages排除。

POST `/messages/:id/submit`与`/retry`接受`{revision,confirmed:true,idempotencyKey}`，202 `{message}`真实排队/计划状态。retry只发可重试失败对象，不发Apple已接收对象。test是服务端登记测试设备，不自动等同sandbox；每设备用真实环境。缺普通token/能力返回422/503而非成功。

确认显示正文、iOS通道、测试/全部范围、实际环境/人数（未知待核对）、立即/计划时间；后端认证及校验不因confirmed省略。幂等key绑定操作/消息/payload，同尝试响应丢失或重复点击保留同key、先查结果后revision，不再新建草稿/入队；submit超时后保留已保存id/revision/key，同次重试不再PATCH草稿。明确新修改/重试用新key。

后端验证完整APNs payload大小、持久化及服务器排程；已提交任务不能保存时静默改正文。accepted_by_apns只代表Apple接收，非用户收到/已读，partial与真实结果一致。演示内存不写生产。

Android提交不依赖APNs/token，状态为available_in_app（或scheduled）。发送时固定接收设备：已启用且通过签名校验报告inbox_supported的Android安装，并按all/test过滤；不向之后才安装的设备追发，不把旧版Android/iOS计作Android收件人。没有即时接收设备返回422，计划发布到期仍无设备则failed可重试。Android不产生Apple推送记录，acceptedCount为null；offeredCount是曾在签名校验回复中提供过内容的设备数，不证明客户端收到；readCount仅计收到签名已读确认的设备数。

Android `/api/client/check` 可带readMessageIds（≤100个msg-标识，顺序保留），在原AMS-CHECK-2签名文本后追加`\nAMS-INBOX-1\n`与紧凑JSON数组。该字段同时声明收件能力；服务端为此安装记录inbox_supported。签名status含messages（每次≤10条，未读、未过期、按发送先后），格式`{id,title,body,url,publishedAt,expiresAt}`。已读只更新该签名安装的已提供记录；禁用设备返回空messages；重复确认幂等，旧协议请求与iOS不变。App点击知道了/查看详情后本机先记已读，随后校验同步；断网时下次校验补同步。新App遇旧服务器拒绝新增字段时仅重试一次原签名请求，原授权/账户/公告仍可用，普通消息须新服务部署后才可取得。

## 10. APNs：GET `/api/admin/apns`

```ts
type ApnsState = {configured:boolean;environment:string;bundleId:string;
  keyId:string|null;teamId:string|null;
  capabilities:{notification:boolean;liveactivity:boolean};records:PushRecord[]};
type PushRecord = {id:string;accountName:string|null;
  kind:"start"|"update"|"end"|"notification";
  status:"queued"|"accepted_by_apns"|"failed"|"expired";
  at:string;environment:"sandbox"|"production";reason?:string;retryable?:boolean};
```

configured只表示密钥可加载，不是真实验收；keyId/teamId配置标识可掩码/null，禁.p8/JWT/完整token。records.accountName对应发送时快照，未知null，不用切换后账户冒充历史对象；可附installationId/deviceId、精确时间、nextCursor，当前前端只用上述字段。

旧sent→accepted_by_apns；wait-token/retry:*→queued附reason；no-token/no-key/fail:*→failed；expired/superseded→expired附reason。旧attempts非完整次数，缺逐次/APNs-ID/到达证据不造；at按状态对应计划/结果时刻。当前事件约2天清理，统计保留范围需声明。

既有notify只Live Activity，push-type=liveactivity、topic=`<bundle>.push-type.liveactivity`；普通通知要另注册普通device token、alert通道和正确topic/授权，不复用start/update token。Android本地课程提醒不代表远程消息通道，本轮Message不含Android推送。

现有scheduler约15秒一轮、退避最多6次、失效token清除、旧状态过期/替代；重试用有效内容不再发已接收事件。安装停用后取消/冻结待任务，发送前重查状态及账户代次。密钥文件与真机验收由服务端维护方完成，前端不上传/读取正文。

## 11. iOS公共配置与合并通讯

旧GET `/api/public/ios/config`保留schemaVersion=1、announcement/release可null；release=`{version,build,url,notes}`，独立Androidsettings。version≤40、build 1–2147483647整数、notes≤2000、URL仅HTTPS AppStore/TestFlight无用户名密码。announcement=`{id,title,message,important?,source?,publishedAt?,expiresAt?,url?}`，body映射message，无生效公告null。

原IOS_PUBLIC_CONFIG环境变量及成功24小时/失败1小时缓存、已确认id是**旧客户端行为**，不是新版每次打开策略。新一次/check返回授权/账户/公告/平台版本，页面就绪后展示；新发布revision/确认身份对齐。发布不是即时推送。

可新增GET/POST `/api/admin/ios-config`管理独立版本，缺API前503且不启UI；公告统一announcements，不能有绕开发布/下架的第二真源。发布管理页链接只跳转，配置保存不证明上传/审核。

## 12. 服务端维护方接入与验收

1. 同源登录/过期/改凭证/Origin；核对items/announcement/message包装、ISO与各错误JSON，正式未接入或空库不补演示。
2. 迁移逐条核码ID/哈希/加密/额度/绑定/issued、管理员/settings、原签名材料；旧URL转发与新版域名分别验，备份/导入/切换/旧服务退出承载分别报告。
3. 同码两台不同ID、同指纹重复claim/check同ID不扣额；旧grant不重签可认领，reset后的有效旧grant兼容且不改额度。
4. 独立停用A、B仍可用；A换UUID/register/activate不解除；旧/check按fingerprint给签名false；删除提醒/reset/码enable不清停用。离线/503不当停用。
5. 两端账户A→B→null、编号/授权不变、revision/时间准确；切换/退出事务清旧云端课表及提醒，timetable携accountRevision，A迟到上传不能覆盖B/退出、恢复已清课表或重排旧任务。旧客户端缺字段不清新账户，旧无link注册不能因activation ready全面拒绝且不能降级已关联安装；重装/离线revision恢复；Android无课表上传，iOS授权边界保持。
6. 冷启动与同次前台回调合并一次、下次前台再次通讯、不等旧周期；响应授权/公告/版本，网络异常有区分；旧intervalDays合法且UI不写0。
7. 公告草稿不生效、发布/定时/到期/下架、先下架再编辑、重发布确认身份、平台/首页生效；不自动发APNs，显式额外通知≤500字符且非Android-only；旧iOS投影与旧message迁移无重复发送。
8. 公告/消息POST固定编辑会话clientRequestId防重复草稿；publish/submit丢响应保留key且不重复PATCH，幂等结果先于revision校验；服务器排程/不重发已接受，分别测liveactivity/notification及sandbox/production，Apple200与手机显示分验。
9. 前端设备详情按需、PATCH设备状态/delete后reload保留身份、未知/未接入/离线与确认流程；迁移预建platform/model/appVersion/bundleId/apnsEnv未知返回null，平台显示“待识别”，有效授权与元数据完整度分开统计；交付实际提交/部署版本/客户端包/检查/真机缺口，不以静态上线冒充后端完成，保留现有/api与其他站点。

后台只读按需刷新/可见时轮询，不为动画高频请求。生产写入只由真实连接明确按钮触发。演示不调用写API，备份/真实账户/密钥/学校会话不进静态包/Git/截图/日志。

## 2026-10-13 前端修订摘要

- 首页改设备授权、通讯、生效公告，课表进详情；Device补元数据、激活关联/独立状态、账户同步revision，id为server安装编号。
- ADMIN-BE-001扩两端设备登记、幂等身份认领、独立停用、防UUID绕过、账户切换/退出/乱序；Android课表本机。
- 新版每次冷启动/前台合并通讯；旧grant及v/app/device/grant/intervalDays保持，旧settings周期不写0。
- 公告独立announcements、items/announcement包装、草稿/计划/发布/下架及先下架编辑；messages仅notification、message包装与稳定提交/重试幂等。
- PATCH `/devices/:id`只变该安装状态并回`{device}`；delete云端提醒保留身份/授权/停用并reload；Overview四项设备统计+services，正式不补演示。
- Device.lastSeenAt/apnsEnv允许null；公告默认不附通知，显式通知≤500字符且仅iOS；POST草稿固定clientRequestId、提交超时原key重试不重PATCH。
- Device.platform/bundleId允许null，未知平台显示“待识别”；有效授权可active，legacy_pending仅缺可验证授权映射。账户切换/退出清旧云端课表/提醒，timetable绑定accountRevision；保留已部署iOS无link注册兼容并阻止已关联安装降级。
- 复用现有管理路径与参数：设备状态PATCH `/devices/:id`，公告额外推送使用push（默认false）；确认、幂等、500字符限制、Android-only禁止Apple通知与先下架编辑要求保持。
- 本文只约定接入，接口/客户端发布/迁移/真实推送以后续实际证据分别确认。
