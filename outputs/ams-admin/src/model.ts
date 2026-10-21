export type Page =
  | "overview"
  | "activations"
  | "devices"
  | "announcements"
  | "messages"
  | "apns"
  | "settings";
export type Code = {
  id: string;
  note: string;
  enabled: number;
  created: number;
  device: string | null;
  issued: number | null;
  max_uses: number;
  used_count: number;
  remaining: number;
  code: string | null;
  mode: "normal" | "demo";
};
export type Course = {
  key: string;
  date: string;
  start: string;
  end: string;
  title: string;
  code: string;
  room: string;
  location: string;
};
export type ActivationState =
  | "active"
  | "disabled"
  | "unbound"
  | "legacy_pending";
export type Device = {
  id: string;
  accountName: string | null;
  platform: "ios" | "android" | null;
  model: string | null;
  appVersion: string | null;
  bundleId: string | null;
  apnsEnv: "sandbox" | "production" | null;
  lastSeenAt: string | null;
  accountUpdatedAt: string | null;
  accountRevision: number;
  activation: {
    codeId: string | null;
    note: string | null;
    state: ActivationState;
    codeEnabled: boolean | null;
    deviceEnabled: boolean;
    activatedAt: string | null;
    checkedAt: string | null;
  };
  timetableUpdatedAt: string | null;
  courseCount: number;
  pendingCount: number;
  coverageUntil: string | null;
  tokenState: "ready" | "missing";
  prefs: { enabled: boolean; leadMin: number; merge: boolean };
  courses?: Course[];
};
export type Announcement = {
  id: string;
  title: string;
  body: string;
  platform: "all" | "ios" | "android";
  status: "draft" | "scheduled" | "published" | "withdrawn";
  publishAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
export type Message = {
  id: string;
  title: string;
  body: string;
  channel: "notification";
  platform: "ios" | "android";
  audience: "all" | "test";
  scheduleAt: string | null;
  status:
    | "draft"
    | "scheduled"
    | "queued"
    | "sending"
    | "accepted_by_apns"
    | "available_in_app"
    | "partial"
    | "failed";
  createdAt: string;
  revision: number;
  reason?: string;
  retryable?: boolean;
  recipientCount?: number | null;
  offeredCount?: number | null;
  readCount?: number | null;
};
export type PushRecord = {
  id: string;
  accountName: string | null;
  kind: "start" | "update" | "end" | "notification";
  status: "queued" | "accepted_by_apns" | "failed" | "expired";
  at: string;
  environment: "sandbox" | "production";
  reason?: string;
  retryable?: boolean;
};
export type ApnsState = {
  configured: boolean;
  environment: string;
  bundleId: string;
  keyId: string | null;
  teamId: string | null;
  capabilities: { notification: boolean; liveactivity: boolean };
  records: PushRecord[];
};
export type Settings = {
  interval_days: number;
  version_code: number;
  version_name: string;
  download_url: string;
  release_notes: string;
};
export type ServiceState = {
  status: "ready" | "not_configured" | "unavailable" | "not_connected";
  message?: string;
  checkedAt?: string | null;
};
export type Overview = {
  asOf: string;
  activationCount: number | null;
  deviceCount: number | null;
  activeDeviceCount: number | null;
  disabledDeviceCount: number | null;
  legacyDeviceCount: number | null;
  connectedTodayCount: number | null;
  pendingCount: number | null;
  acceptedCount: number | null;
  services?: {
    activation: ServiceState;
    notify: ServiceState;
    apns: ServiceState;
  };
};
export type Data = {
  codes: Code[];
  devices: Device[];
  announcements: Announcement[];
  messages: Message[];
  apns: ApnsState | null;
  settings: Settings | null;
  overview: Overview | null;
};
export const emptyData: Data = {
  codes: [],
  devices: [],
  announcements: [],
  messages: [],
  apns: null,
  settings: null,
  overview: null,
};
export function chinaDay(offset = 0) {
  return new Date(Date.now() + 8 * 3600e3 + offset * 86400e3)
    .toISOString()
    .slice(0, 10);
}
export function formatDate(v: string | number | null, brief = false) {
  if (v === null) return "尚未同步";
  const d = new Date(typeof v === "number" ? v * 1000 : v);
  return Number.isNaN(d.getTime())
    ? "未知时间"
    : new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "2-digit",
        day: "2-digit",
        ...(brief ? {} : { hour: "2-digit", minute: "2-digit", hour12: false }),
      }).format(d);
}
export function chinaInput(v: string | null) {
  if (!v) return "";
  const t = new Date(v).getTime();
  return Number.isNaN(t)
    ? ""
    : new Date(t + 8 * 3600e3).toISOString().slice(0, 16);
}
export const messageStatus: Record<Message["status"], string> = {
  draft: "草稿",
  scheduled: "计划发送",
  queued: "排队中",
  sending: "提交中",
  accepted_by_apns: "已提交 APNs",
  available_in_app: "已发布到 App",
  partial: "部分失败",
  failed: "发送失败",
};
export const activationStatus: Record<ActivationState, string> = {
  active: "已激活",
  disabled: "已停用",
  unbound: "未激活",
  legacy_pending: "待关联",
};
export const announcementStatus: Record<Announcement["status"], string> = {
  draft: "草稿",
  scheduled: "待发布",
  published: "已发布",
  withdrawn: "已下架",
};
export function codeState(c: Code) {
  return c.enabled !== 1
    ? "disabled"
    : c.remaining === 0
      ? "used"
      : "available";
}
export function isActiveAnnouncement(a: Announcement, now = Date.now()) {
  return (
    a.status === "published" &&
    (!a.publishAt || new Date(a.publishAt).getTime() <= now) &&
    (!a.expiresAt || new Date(a.expiresAt).getTime() > now)
  );
}
export function makeDemo(): Data {
  const today = chinaDay(),
    iso = (hour: string) => `${today}T${hour}:00+08:00`,
    ago = (minutes: number) =>
      new Date(Date.now() - minutes * 60000).toISOString(),
    now = Math.floor(Date.now() / 1000);
  const courses: Course[] = [
    {
      key: "demo-c1",
      date: today,
      start: "09:00",
      end: "10:50",
      title: "软件工程",
      code: "CSE208",
      room: "SA169",
      location: "南校区",
    },
    {
      key: "demo-c2",
      date: today,
      start: "13:00",
      end: "14:50",
      title: "人机交互",
      code: "CSE203",
      room: "MA401",
      location: "南校区",
    },
    {
      key: "demo-c3",
      date: today,
      start: "16:00",
      end: "17:50",
      title: "数据库系统",
      code: "CSE202",
      room: "FB221",
      location: "北校区",
    },
  ];
  const devices: Device[] = Array.from({ length: 8 }, (_, i) => ({
    id: `DEMO-INSTALL-${String(i + 1).padStart(4, "0")}`,
    accountName:
      i === 7 ? null : `demo.student${String(i + 1).padStart(2, "0")}`,
    platform: i === 7 ? null : i === 6 ? "android" : "ios",
    model: i === 7 ? null : i === 6 ? "Android 测试设备" : "iPhone 测试设备",
    appVersion: i === 7 ? null : i === 6 ? "0.14.1 (73)" : "0.1.0 (4)",
    bundleId: i === 7 ? null : i === 6 ? "cn.local.ams" : "cn.xjtlu.ams.ios",
    apnsEnv: i === 6 || i === 7 ? null : i < 2 ? "sandbox" : "production",
    lastSeenAt: i === 7 ? null : ago(i * 4 + 2),
    accountUpdatedAt: i === 7 ? null : ago(35),
    accountRevision: 1,
    activation: {
      codeId: i === 7 ? null : i < 2 ? "demo-code-1" : `demo-code-${i + 1}`,
      note: i < 2 ? "个人测试设备" : i === 7 ? null : "同学体验",
      state: i === 4 ? "disabled" : i === 7 ? "legacy_pending" : "active",
      codeEnabled: i === 7 ? null : i !== 4,
      deviceEnabled: i !== 4,
      activatedAt: i === 7 ? null : ago(60),
      checkedAt: i === 7 ? null : ago(i * 4 + 2),
    },
    timetableUpdatedAt: i === 3 || i === 6 || i === 7 ? null : ago(35),
    courseCount: i === 3 || i === 6 || i === 7 ? 0 : 3,
    pendingCount: i === 3 || i === 4 || i === 6 || i === 7 ? 0 : 6,
    coverageUntil: i === 3 || i === 6 || i === 7 ? null : chinaDay(2),
    tokenState: i === 3 || i === 6 || i === 7 ? "missing" : "ready",
    prefs: {
      enabled: i !== 3 && i !== 4 && i !== 6 && i !== 7,
      leadMin: 15,
      merge: true,
    },
    courses: i === 3 || i === 6 || i === 7 ? [] : courses,
  }));
  const codes: Code[] = Array.from({ length: 13 }, (_, i) => ({
    id: `demo-code-${i + 1}`,
    note:
      ["个人测试设备", "iPhone 测试组", "同学体验", "开发联调"][i % 4] +
      (i > 3 ? ` ${i + 1}` : ""),
    enabled: i === 4 || i === 10 ? 0 : 1,
    created: now - i * 86400,
    device: i % 3 === 0 ? "demo-install-fingerprint" : null,
    issued: i % 3 === 0 ? now - i * 86000 : null,
    max_uses: i % 4 === 0 ? 5 : 1,
    used_count: i === 0 ? 2 : i % 3 === 0 ? 1 : 0,
    remaining: (i % 4 === 0 ? 5 : 1) - (i === 0 ? 2 : i % 3 === 0 ? 1 : 0),
    code: `DEMO-PREVIEW-${String(i + 1).padStart(4, "0")}`,
    mode: i === 0 ? "demo" : "normal",
  }));
  const announcements: Announcement[] = [
    {
      id: "demo-announcement-1",
      title: "AMS 校园助手使用说明",
      body: "欢迎使用 AMS。课表、校园服务与预约入口已集中在首页，更新后可继续使用现有激活授权。",
      platform: "all",
      status: "published",
      publishAt: ago(60),
      expiresAt: null,
      createdAt: ago(60),
      updatedAt: ago(60),
      revision: 1,
    },
    {
      id: "demo-announcement-2",
      title: "新版本更新说明",
      body: "优化了课表缓存与课程提醒，修复部分页面的显示问题。",
      platform: "all",
      status: "draft",
      publishAt: null,
      expiresAt: null,
      createdAt: iso("08:00"),
      updatedAt: iso("08:00"),
      revision: 1,
    },
  ];
  const messages: Message[] = [
    {
      id: "demo-message-1",
      title: "课程提醒测试",
      body: "距离下一节课还有 15 分钟，记得提前前往教室。",
      channel: "notification",
      platform: "ios",
      audience: "test",
      scheduleAt: null,
      status: "draft",
      createdAt: iso("08:00"),
      revision: 1,
    },
    {
      id: "demo-message-2",
      title: "服务维护提醒",
      body: "校园助手维护期间，请稍后再试。",
      channel: "notification",
      platform: "ios",
      audience: "test",
      scheduleAt: null,
      status: "failed",
      createdAt: iso("07:00"),
      revision: 1,
      reason: "暂时无法连接 Apple 推送服务。",
      retryable: true,
    },
  ];
  const records: PushRecord[] = [
    {
      id: "demo-event-1",
      accountName: "demo.student01",
      kind: "start",
      status: "accepted_by_apns",
      at: iso("08:45"),
      environment: "sandbox",
    },
    {
      id: "demo-event-2",
      accountName: "demo.student03",
      kind: "update",
      status: "accepted_by_apns",
      at: iso("09:00"),
      environment: "production",
    },
    {
      id: "demo-event-3",
      accountName: "demo.student04",
      kind: "start",
      status: "failed",
      at: iso("08:45"),
      environment: "production",
      reason: "设备推送凭证已失效，请用户重新打开 App。",
      retryable: false,
    },
  ];
  return {
    codes,
    devices,
    announcements,
    messages,
    apns: {
      configured: false,
      environment: "sandbox / production",
      bundleId: "cn.xjtlu.ams.ios",
      keyId: null,
      teamId: null,
      capabilities: { notification: false, liveactivity: true },
      records,
    },
    settings: {
      interval_days: 7,
      version_code: 73,
      version_name: "0.14.1",
      download_url: "https://www.pgyer.com/amsxiaoyuanzhushou",
      release_notes: "体验更轻盈的校园日常。",
    },
    overview: {
      asOf: new Date().toISOString(),
      activationCount: codes.length,
      deviceCount: 8,
      activeDeviceCount: 6,
      disabledDeviceCount: 1,
      legacyDeviceCount: 1,
      connectedTodayCount: 7,
      pendingCount: 24,
      acceptedCount: 2,
      services: {
        activation: { status: "ready" },
        notify: { status: "ready" },
        apns: { status: "not_configured" },
      },
    },
  };
}
