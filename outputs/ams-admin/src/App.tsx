import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  LayoutDashboard,
  KeyRound,
  CalendarDays,
  Send,
  Radio,
  Settings as SettingsIcon,
  Search,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Check,
  ShieldCheck,
  LogIn,
  LogOut,
  Sun,
  Moon,
  Menu,
  ChevronRight,
  Smartphone,
  Monitor,
  MoreHorizontal,
  Copy,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Eye,
  FileText,
  Bell,
  MapPin,
  BookOpen,
  Wifi,
  Lock,
  CheckCheck,
  ArrowRight,
  X,
  ChevronDown,
  Megaphone,
} from "lucide-react";
import { api, allItems, ApiError } from "./api";
import OperationalOverview from "./OperationalOverview";
import {
  Badge,
  Panel,
  Button,
  Empty,
  SearchBox,
  Modal,
  Pager,
  SortButton,
  Busy,
  Field,
} from "./components";
import {
  makeDemo,
  emptyData,
  chinaDay,
  chinaInput,
  formatDate,
  codeState,
  messageStatus,
  activationStatus,
  announcementStatus,
  isActiveAnnouncement,
} from "./model";
import type {
  Page,
  Data,
  Code,
  Device,
  Announcement,
  Message,
  ApnsState,
  Settings,
  Overview,
} from "./model";

const navigation = [
  { id: "overview", name: "工作台", icon: LayoutDashboard },
  { id: "activations", name: "激活管理", icon: KeyRound },
  { id: "devices", name: "设备与账户", icon: Smartphone },
  { id: "announcements", name: "应用公告", icon: Megaphone },
  { id: "messages", name: "消息推送", icon: Send },
  { id: "apns", name: "Apple 推送", icon: Radio },
  { id: "settings", name: "系统设置", icon: SettingsIcon },
] as const;
const descriptions: Record<Page, string> = {
  overview: "设备授权、服务器通讯与正在使用的公告。",
  activations: "管理激活码、使用额度与设备授权。",
  devices: "每台设备独立管理，查看当前账户与授权状态。",
  announcements: "管理 App 内的公告，发布与推送分别控制。",
  messages: "准备 Apple 通知，检查对象、内容与发送时间。",
  apns: "查看推送配置与每一次提交的结果。",
  settings: "管理版本信息与管理员账户。",
};
type Dialog =
  | { kind: "code"; code: Code }
  | { kind: "create" }
  | { kind: "device"; device: Device }
  | { kind: "announcement"; announcement: Announcement }
  | { kind: "announce-compose"; announcement?: Announcement }
  | { kind: "message"; message: Message }
  | { kind: "compose"; message?: Message }
  | { kind: "login" }
  | { kind: "command" }
  | null;
type Confirmation = {
  title: string;
  text: string;
  label: string;
  danger?: boolean;
  run: () => Promise<boolean>;
};

export default function App() {
  const initialPreview =
    new URLSearchParams(location.search).get("preview") === "1";
  const pageFromHash = () =>
    navigation.some((n) => n.id === location.hash.slice(1))
      ? (location.hash.slice(1) as Page)
      : "overview";
  const [page, setPage] = useState<Page>(pageFromHash),
    [preview, setPreview] = useState(initialPreview),
    [checkingSession, setCheckingSession] = useState(!initialPreview),
    [data, setData] = useState<Data>(() =>
      initialPreview ? makeDemo() : { ...emptyData },
    ),
    [dialog, setDialog] = useState<Dialog>(null),
    [confirm, setConfirm] = useState<Confirmation | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [loading, setLoading] = useState(false),
    [username, setUsername] = useState(""),
    [menu, setMenu] = useState(false),
    [dark, setDark] = useState(
      () => localStorage.getItem("ams-admin-theme") === "dark",
    ),
    [mobile, setMobile] = useState(
      () => matchMedia("(max-width:760px)").matches,
    );
  useEffect(() => {
    const media = matchMedia("(max-width:760px)"),
      change = () => setMobile(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const trigger = document.getElementById("nav-toggle");
    document.querySelector<HTMLButtonElement>(".sidebar nav button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      requestAnimationFrame(() => {
        if (trigger?.getAttribute("aria-expanded") === "false") trigger.focus();
      });
    };
  }, [menu]);
  useEffect(() => {
    const expire = () => {
      setData({ ...emptyData });
      setUsername("");
      setPreview(false);
      setConfirm(null);
      setDialog(null);
      setMenu(false);
      setError("管理会话已过期，请重新登录。");
    };
    window.addEventListener("ams-admin-expired", expire);
    return () => window.removeEventListener("ams-admin-expired", expire);
  }, []);
  const reduce = useReducedMotion(),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("ams-admin-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    const change = () => setPage(pageFromHash());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if ((preview || username) && !dialog && !confirm && !busy)
          setDialog({ kind: "command" });
      }
    };
    window.addEventListener("keydown", fn);
    return () => {
      window.removeEventListener("keydown", fn);
    };
  }, [dialog, confirm, busy, preview, username]);
  useEffect(() => {
    if (initialPreview) return;
    const controller = new AbortController();
    let current = true;
    async function restoreSession() {
      try {
        const profile = await api<{ username: string }>(
          "profile",
          undefined,
          undefined,
          { notifyUnauthorized: false, signal: controller.signal },
        );
        if (!current) return;
        setUsername(profile.username);
        await loadReal();
      } catch (e) {
        if (!current) return;
        setData({ ...emptyData });
        setUsername("");
        setError(
          e instanceof ApiError && e.status === 401
            ? ""
            : e instanceof Error
              ? e.message
              : "无法加载管理服务，请重试。",
        );
      } finally {
        if (current) setCheckingSession(false);
      }
    }
    void restoreSession();
    return () => {
      current = false;
      controller.abort();
    };
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const go = (p: Page) => {
    location.hash = p;
    setPage(p);
    setMenu(false);
    setDialog(null);
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  async function loadReal() {
    setLoading(true);
    setErrors({});
    const endpoints = [
      "codes",
      "devices",
      "announcements",
      "messages",
      "apns",
      "settings",
      "overview",
    ];
    const results = await Promise.allSettled(
        endpoints.map((p) =>
          ["devices", "announcements", "messages"].includes(p)
            ? allItems(p)
            : api<unknown>(p),
        ),
      ),
      next = { ...emptyData },
      failures: Record<string, string> = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i],
        p = endpoints[i];
      if (r.status === "rejected") {
        failures[p] = r.reason.message;
        if (r.reason.status === 401) {
          setDialog({ kind: "login" });
          setUsername("");
        }
      } else {
        const v = r.value as Record<string, unknown>;
        if (p === "codes") next.codes = (v.codes || []) as Code[];
        if (p === "devices")
          next.devices = ((v.items || []) as Device[]).map(normalizeDevice);
        if (p === "announcements")
          next.announcements = (v.items || []) as Announcement[];
        if (p === "messages") next.messages = (v.items || []) as Message[];
        if (p === "apns") next.apns = v as unknown as ApnsState;
        if (p === "settings") next.settings = v as unknown as Settings;
        if (p === "overview") next.overview = v as unknown as Overview;
      }
    }
    if (
      results.some((r) => r.status === "rejected" && r.reason.status === 401)
    ) {
      setData({ ...emptyData });
      setErrors({});
      setUsername("");
      setDialog({ kind: "login" });
      setError("管理会话已过期，请重新登录。");
    } else {
      setData(next);
      setErrors(failures);
    }
    setLoading(false);
  }
  async function action(
    real: () => Promise<unknown>,
    demo: () => void,
    success: string,
  ) {
    setBusy(true);
    setError("");
    try {
      if (preview) {
        demo();
        notify(`演示：${success}`);
      } else {
        await real();
        await loadReal();
        notify(success);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成，请重试。");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("login", {
        username: form.get("username"),
        password: form.get("password"),
      });
      const p = await api<{ username: string }>("profile");
      const currentUrl = new URL(location.href);
      currentUrl.searchParams.delete("preview");
      history.replaceState(
        null,
        "",
        currentUrl.pathname + currentUrl.search + currentUrl.hash,
      );
      setUsername(p.username);
      setPreview(false);
      setData({ ...emptyData });
      setDialog(null);
      await loadReal();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录未完成");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      await api("logout", {});
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setUsername("");
    setData({ ...emptyData });
    setDialog({ kind: "login" });
  }
  const restorePreview = () => {
    setPreview(true);
    setUsername("");
    setData(makeDemo());
    setErrors({});
    setError("");
    setDialog(null);
  };
  const sectionError =
    errors[
      page === "activations" ? "codes" : page === "devices" ? "devices" : page
    ];
  const activate = (c: Code, kind: string) => {
    const descriptions: Record<string, [string, string]> = {
      disable: [
        "停用激活码",
        "停止该激活码及其所有关联设备的授权。设备在下次成功通讯后获知停用。",
      ],
      enable: ["启用激活码", "恢复该激活码的可用状态。"],
      reset: [
        "重置设备绑定",
        "清空绑定并恢复额度。已经签发的安装凭证仍可使用，此操作不会让已有设备立即失效。",
      ],
      delete: [
        "删除激活码",
        "仅可删除从未激活且已停用的记录，删除后无法恢复。",
      ],
    };
    setDialog(null);
    setConfirm({
      title: descriptions[kind][0],
      text: `${c.note || "未命名激活码"}：${descriptions[kind][1]}`,
      label: descriptions[kind][0],
      danger: kind !== "enable",
      run: async () => {
        return action(
          () => api("update", { id: c.id, action: kind }),
          () =>
            setData((d) => ({
              ...d,
              codes:
                kind === "delete"
                  ? d.codes.filter((x) => x.id !== c.id)
                  : d.codes.map((x) =>
                      x.id !== c.id
                        ? x
                        : {
                            ...x,
                            ...(kind === "reset"
                              ? {
                                  used_count: 0,
                                  remaining: x.max_uses,
                                  device: null,
                                }
                              : { enabled: kind === "enable" ? 1 : 0 }),
                          },
                    ),
              devices: d.devices.map((device) =>
                device.activation.codeId !== c.id ||
                !["enable", "disable"].includes(kind)
                  ? device
                  : {
                      ...device,
                      activation: {
                        ...device.activation,
                        codeEnabled: kind === "enable",
                        state:
                          kind === "enable" && device.activation.deviceEnabled
                            ? "active"
                            : "disabled",
                      },
                    },
              ),
            })),
          descriptions[kind][0] + "完成",
        );
      },
    });
  };
  const copy = async (text: string | null) => {
    if (!text) {
      notify("旧记录尚未补录激活码");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify(preview ? "已复制演示标识，不能用于真实激活" : "已复制激活码");
    } catch {
      setError("无法访问剪贴板，请手动选择并复制。");
    }
  };
  const nowLabel = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
  if (!preview && (checkingSession || !username)) {
    return (
      <div className="auth-page">
        <header className="auth-header">
          <a className="brand" href="/admin/">
            <span className="brand-mark">
              A<span />
            </span>
            <div>
              <strong>AMS</strong>
              <small>校园管理工作台</small>
            </div>
          </a>
          <button
            className="icon-button"
            aria-label={dark ? "切换浅色模式" : "切换深色模式"}
            onClick={() => setDark(!dark)}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="auth-main">
          <Panel className="auth-card">
            <span className="auth-symbol">
              <KeyRound size={24} />
            </span>
            <h1>{checkingSession ? "正在验证登录" : "登录管理后台"}</h1>
            <p className="auth-description">AMS 校园助手 · 管理工作台</p>
            {checkingSession ? (
              <p className="auth-loading" role="status">
                <Busy />
                正在加载，请稍候…
              </p>
            ) : (
              <LoginForm busy={busy} error={error} login={login} />
            )}
            {!checkingSession && error && (
              <Button variant="ghost" onClick={() => location.reload()}>
                重新检查登录状态
              </Button>
            )}
          </Panel>
        </main>
        <footer className="auth-footer">AMS 校园助手</footer>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      {menu && <div className="mobile-scrim" onClick={() => setMenu(false)} />}
      <aside
        id="admin-navigation"
        inert={mobile && !menu}
        aria-hidden={mobile && !menu ? true : undefined}
        className={`sidebar ${menu ? "open" : ""}`}
      >
        <button
          className="icon-button sidebar-close"
          aria-label="关闭导航"
          onClick={() => {
            setMenu(false);
          }}
        >
          <X size={20} />
        </button>
        <a href="#overview" className="brand" onClick={() => go("overview")}>
          <span className="brand-mark">
            A<span />
          </span>
          <div>
            <strong>AMS</strong>
            <small>校园管理工作台</small>
          </div>
        </a>
        <div className="workspace">
          <span className="workspace-icon">
            <BookOpen size={17} />
          </span>
          <div>
            <strong>校园助手</strong>
            <small>管理空间</small>
          </div>
          <Badge tone="blue">{preview ? "预览" : "正式"}</Badge>
        </div>
        <span className="nav-label">管理</span>
        <nav aria-label="主导航">
          {navigation.map((n) => (
            <button
              key={n.id}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => go(n.id)}
              className={`nav-item ${page === n.id ? "active" : ""}`}
            >
              <n.icon size={19} />
              <span>{n.name}</span>
              {page === n.id && (
                <motion.i className="nav-active" layoutId="navigation" />
              )}
              {n.id === "messages" &&
                data.messages.filter((m) => m.status === "draft").length >
                  0 && (
                  <small>
                    {data.messages.filter((m) => m.status === "draft").length}
                  </small>
                )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="profile-button"
            onClick={() =>
              preview ? setDialog({ kind: "login" }) : go("settings")
            }
          >
            <span className="avatar">
              {preview ? "A" : username.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{preview ? "界面预览" : username || "管理员"}</strong>
              <small>{preview ? "查看设计与操作流程" : "账户设置"}</small>
            </div>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell" inert={mobile && menu}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              id="nav-toggle"
              className="icon-button mobile-menu"
              aria-label="打开导航"
              aria-expanded={menu}
              aria-controls="admin-navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={21} />
            </button>
            <span>校园助手</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((n) => n.id === page)?.name}</strong>
          </div>
          <div className="top-actions">
            {!preview && (
              <button
                className="button ghost session-logout"
                aria-label="退出登录"
                onClick={() => void logout()}
              >
                <LogOut size={16} />
                <span>退出登录</span>
              </button>
            )}
            <button
              className="command-button"
              aria-label="快速前往"
              onClick={() => setDialog({ kind: "command" })}
            >
              <Search size={16} />
              <span>快速前往</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button"
              aria-label={dark ? "切换浅色模式" : "切换深色模式"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="header-divider" />
            <span className="avatar small">A</span>
          </div>
        </header>
        <main id="main-content">
          {preview && (
            <div className="mode-banner">
              <span className="mode-icon">
                <Eye size={15} />
              </span>
              <div>
                <strong>交互预览</strong>
                <span>
                  示例数据 · 操作仅在当前页面演示，不会激活设备或发送消息
                </span>
              </div>
              <button onClick={() => setDialog({ kind: "login" })}>
                管理员登录
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <h1>
                {page === "overview"
                  ? "工作台"
                  : navigation.find((n) => n.id === page)?.name}
              </h1>
              <p>{descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              {page === "overview" ? (
                <>
                  <span className="date-label">
                    <CalendarDays size={16} />
                    {nowLabel}
                  </span>
                  <PublishMenu />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      preview ? notify("演示数据已是最新") : void loadReal()
                    }
                    disabled={loading}
                  >
                    <RefreshCw size={16} className={loading ? "spin" : ""} />
                    刷新
                  </Button>
                </>
              ) : page === "activations" ? (
                <Button
                  onClick={() => {
                    setError("");
                    setDialog({ kind: "create" });
                  }}
                >
                  <Plus size={17} />
                  生成激活码
                </Button>
              ) : page === "announcements" ? (
                <Button
                  onClick={() => {
                    setError("");
                    setDialog({ kind: "announce-compose" });
                  }}
                >
                  <Plus size={17} />
                  新建公告
                </Button>
              ) : page === "messages" ? (
                <Button
                  onClick={() => {
                    setError("");
                    setDialog({ kind: "compose" });
                  }}
                >
                  <Plus size={17} />
                  新建消息
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() =>
                    preview ? notify("演示数据已是最新") : void loadReal()
                  }
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? "spin" : ""} />
                  刷新
                </Button>
              )}
            </div>
          </div>
          {error && !dialog && !confirm && (
            <div role="alert" className="error-banner">
              <AlertCircle size={18} />
              {error}
              <button onClick={() => setError("")} aria-label="关闭错误提示">
                <X size={16} />
              </button>
            </div>
          )}
          {sectionError && (
            <div role="alert" className="error-banner">
              <AlertCircle size={18} />
              {sectionError}
              <Button variant="ghost" onClick={() => void loadReal()}>
                重新加载
              </Button>
            </div>
          )}
          {loading ? (
            <div className="loading-panel" aria-live="polite">
              <Busy />
              正在读取管理数据…
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={page}
                data-page={page}
                initial={{ opacity: 0, y: reduce ? 0 : 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduce ? 0 : -4 }}
                transition={{ duration: 0.16 }}
              >
                {page === "overview" && (
                  <OperationalOverview
                    data={data}
                    preview={preview}
                    go={go}
                    openDevice={(d) => setDialog({ kind: "device", device: d })}
                    openAnnouncement={(a) =>
                      setDialog({ kind: "announcement", announcement: a })
                    }
                    createAnnouncement={() =>
                      setDialog({ kind: "announce-compose" })
                    }
                  />
                )}
                {page === "activations" && (
                  <ActivationPage
                    codes={data.codes}
                    preview={preview}
                    open={(c) => {
                      setError("");
                      setDialog({ kind: "code", code: c });
                    }}
                    copy={copy}
                  />
                )}
                {page === "devices" && (
                  <DevicesPage
                    devices={data.devices}
                    open={(d) => {
                      setError("");
                      setDialog({ kind: "device", device: d });
                    }}
                  />
                )}
                {page === "announcements" && (
                  <AnnouncementsPage
                    announcements={data.announcements}
                    open={(a) => {
                      setError("");
                      setDialog({ kind: "announcement", announcement: a });
                    }}
                  />
                )}
                {page === "messages" && (
                  <MessagesPage
                    messages={data.messages}
                    open={(m) => setDialog({ kind: "message", message: m })}
                  />
                )}
                {page === "apns" && (
                  <ApnsPage
                    state={data.apns}
                    preview={preview}
                    go={go}
                    notify={notify}
                  />
                )}
                {page === "settings" && (
                  <SettingsPage
                    settings={data.settings}
                    preview={preview}
                    username={username}
                    busy={busy}
                    action={action}
                    update={(s) => setData((d) => ({ ...d, settings: s }))}
                    onSessionEnd={() => {
                      setUsername("");
                      setData({ ...emptyData });
                      setDialog({ kind: "login" });
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
          <footer className="site-footer">
            <span>AMS 校园助手</span>
            <span>
              {preview ? "设计预览 · 所有账户与记录均为示例" : "管理工作台"}
              <i />
              北京时间
            </span>
          </footer>
        </main>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            className="toast"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <CheckCircle2 size={18} />
            {toast}
            <button aria-label="关闭通知" onClick={() => setToast("")}>
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {dialog?.kind === "command" && (
        <CommandDialog go={go} close={() => setDialog(null)} />
      )}
      {dialog?.kind === "login" && (
        <Modal
          title="管理员登录"
          subtitle="使用现有管理账户登录"
          onClose={() => {
            setDialog(null);
            setError("");
          }}
        >
          <LoginForm busy={busy} error={error} login={login} />
          <Button variant="ghost" onClick={restorePreview}>
            继续查看界面预览
          </Button>
        </Modal>
      )}
      {dialog?.kind === "create" && (
        <CreateCode
          busy={busy}
          error={error}
          close={() => setDialog(null)}
          create={async (note, maxUses, mode) => {
            const ok = await action(
              () =>
                api<{ id: string; code: string }>("codes", {
                  note,
                  maxUses,
                  mode,
                }),
              () => {
                const id = `demo-${crypto.randomUUID()}`;
                setData((d) => ({
                  ...d,
                  codes: [
                    {
                      id,
                      note,
                      enabled: 1,
                      created: Date.now() / 1000,
                      device: null,
                      issued: null,
                      max_uses: maxUses,
                      used_count: 0,
                      remaining: maxUses,
                      mode,
                      code: "DEMO-PREVIEW-" + id.slice(5, 13),
                    },
                    ...d.codes,
                  ],
                }));
              },
              "激活码已生成",
            );
            if (ok) {
              go("activations");
              setDialog(null);
            }
          }}
        />
      )}
      {dialog?.kind === "code" && (
        <CodeDetails
          code={data.codes.find((c) => c.id === dialog.code.id) || dialog.code}
          busy={busy}
          error={error}
          preview={preview}
          close={() => setDialog(null)}
          copy={copy}
          activate={activate}
          saveQuota={async (c, n) => {
            await action(
              () => api("update", { id: c.id, action: "quota", maxUses: n }),
              () =>
                setData((d) => ({
                  ...d,
                  codes: d.codes.map((x) =>
                    x.id === c.id
                      ? { ...x, max_uses: n, remaining: n - x.used_count }
                      : x,
                  ),
                })),
              "额度已保存",
            );
          }}
          saveCode={async (c, code) => {
            await action(
              () => api("update", { id: c.id, action: "saveCode", code }),
              () =>
                setData((d) => ({
                  ...d,
                  codes: d.codes.map((x) =>
                    x.id === c.id ? { ...x, code } : x,
                  ),
                })),
              "激活码已补录",
            );
          }}
        />
      )}
      {dialog?.kind === "device" && (
        <DeviceDetails
          device={
            data.devices.find((d) => d.id === dialog.device.id) || dialog.device
          }
          preview={preview}
          close={() => setDialog(null)}
          toggleDevice={() => {
            const d =
                data.devices.find((d) => d.id === dialog.device.id) ||
                dialog.device,
              enabled = !d.activation.deviceEnabled;
            setError("");
            setDialog(null);
            setConfirm({
              title: enabled ? "启用此设备" : "停用此设备",
              text: `${d.accountName || "未关联账户"} · ${d.id}：${enabled ? "恢复此设备的使用资格；关联激活码也须启用。" : "仅停用这台设备，同激活码的其他设备继续使用。新版 App 下次通讯时执行，离线设备暂不能获知。"}`,
              label: enabled ? "启用此设备" : "停用此设备",
              danger: !enabled,
              run: () =>
                action(
                  () =>
                    api(
                      `devices/${encodeURIComponent(d.id)}`,
                      {
                        enabled,
                        confirmed: true,
                      },
                      "PATCH",
                    ),
                  () =>
                    setData((x) => ({
                      ...x,
                      devices: x.devices.map((v) =>
                        v.id === d.id
                          ? {
                              ...v,
                              activation: {
                                ...v.activation,
                                deviceEnabled: enabled,
                                state:
                                  enabled && v.activation.codeEnabled
                                    ? "active"
                                    : "disabled",
                              },
                              pendingCount: enabled ? v.pendingCount : 0,
                            }
                          : v,
                      ),
                    })),
                  enabled ? "设备已启用" : "设备已停用",
                ),
            });
          }}
          deleteDevice={() => {
            const d = dialog.device;
            setError("");
            setDialog(null);
            setConfirm({
              title: "清除云端课表与提醒",
              text: `清除 ${d.accountName || d.id} 的云端课表、推送凭证与提醒排程。保留设备编号、当前账户和授权状态。`,
              label: "清除云端数据",
              danger: true,
              run: () =>
                action(
                  () =>
                    api(
                      `devices/${encodeURIComponent(d.id)}`,
                      undefined,
                      "DELETE",
                    ),
                  () =>
                    setData((x) => ({
                      ...x,
                      devices: x.devices.map((v) =>
                        v.id === d.id
                          ? {
                              ...v,
                              courses: [],
                              courseCount: 0,
                              pendingCount: 0,
                              timetableUpdatedAt: null,
                              coverageUntil: null,
                              tokenState: "missing",
                              prefs: { ...v.prefs, enabled: false },
                            }
                          : v,
                      ),
                    })),
                  "云端课表与提醒已清除",
                ),
            });
          }}
        />
      )}
      {dialog?.kind === "announcement" && (
        <AnnouncementDetails
          announcement={
            data.announcements.find((a) => a.id === dialog.announcement.id) ||
            dialog.announcement
          }
          close={() => setDialog(null)}
          edit={() => {
            setError("");
            setDialog({
              kind: "announce-compose",
              announcement: dialog.announcement,
            });
          }}
          withdraw={() => {
            const a = dialog.announcement,
              key = crypto.randomUUID();
            setError("");
            setDialog(null);
            setConfirm({
              title: "下架公告",
              text: `“${a.title}”将从 App 公告列表移除，保留发布记录；此前已经发送的通知无法撤回。`,
              label: "下架公告",
              danger: true,
              run: () =>
                action(
                  () =>
                    api(`announcements/${encodeURIComponent(a.id)}/withdraw`, {
                      revision: a.revision,
                      confirmed: true,
                      idempotencyKey: key,
                    }),
                  () =>
                    setData((d) => ({
                      ...d,
                      announcements: d.announcements.map((x) =>
                        x.id === a.id
                          ? {
                              ...x,
                              status: "withdrawn",
                              revision: x.revision + 1,
                            }
                          : x,
                      ),
                    })),
                  "公告已下架",
                ),
            });
          }}
        />
      )}
      {dialog?.kind === "announce-compose" && (
        <AnnouncementComposer
          initial={dialog.announcement}
          preview={preview}
          pushReady={Boolean(
            data.apns?.configured && data.apns.capabilities.notification,
          )}
          busy={busy}
          error={error}
          close={() => setDialog(null)}
          save={async (
            a,
            publish,
            key,
            createKey,
            notifyUsers,
            audience,
            onSaved,
            skipSave,
          ) => {
            const mutate = async () => {
              let saved = a;
              if (!skipSave) {
                const response = await api<{ announcement: Announcement }>(
                  a.id
                    ? `announcements/${encodeURIComponent(a.id)}`
                    : "announcements",
                  { ...a, clientRequestId: createKey },
                  a.id ? "PATCH" : "POST",
                );
                saved = response.announcement;
                if (
                  !a.id &&
                  (saved.title !== a.title ||
                    saved.body !== a.body ||
                    saved.platform !== a.platform ||
                    (Date.parse(saved.publishAt || "") !==
                      Date.parse(a.publishAt || "") &&
                      (saved.publishAt || a.publishAt)) ||
                    (Date.parse(saved.expiresAt || "") !==
                      Date.parse(a.expiresAt || "") &&
                      (saved.expiresAt || a.expiresAt)))
                ) {
                  const updated = await api<{ announcement: Announcement }>(
                    `announcements/${encodeURIComponent(saved.id)}`,
                    { ...a, id: saved.id, revision: saved.revision },
                    "PATCH",
                  );
                  saved = updated.announcement;
                }
                onSaved(saved);
              }
              if (publish)
                await api(
                  `announcements/${encodeURIComponent(saved.id)}/publish`,
                  {
                    revision: saved.revision,
                    confirmed: true,
                    idempotencyKey: key,
                    push: notifyUsers,
                    audience,
                  },
                );
            };
            const ok = await action(
              mutate,
              () => {
                const next = {
                  ...a,
                  id: a.id || `demo-${crypto.randomUUID()}`,
                  status: publish
                    ? a.publishAt && Date.parse(a.publishAt) > Date.now()
                      ? "scheduled"
                      : "published"
                    : "draft",
                  createdAt: a.createdAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  revision: a.revision + 1,
                } as Announcement;
                setData((d) => ({
                  ...d,
                  announcements: [
                    next,
                    ...d.announcements.filter((x) => x.id !== next.id),
                  ],
                  messages:
                    publish && notifyUsers
                      ? [
                          {
                            id: `demo-${crypto.randomUUID()}`,
                            title: a.title,
                            body: a.body,
                            channel: "notification",
                            platform: "ios",
                            audience,
                            scheduleAt: a.publishAt,
                            status: a.publishAt ? "scheduled" : "queued",
                            createdAt: new Date().toISOString(),
                            revision: 1,
                          },
                          ...d.messages,
                        ]
                      : d.messages,
                }));
              },
              publish ? "公告发布计划已保存" : "公告草稿已保存",
            );
            if (ok) setDialog(null);
            return ok;
          }}
        />
      )}
      {dialog?.kind === "compose" && (
        <Composer
          initial={dialog.message}
          preview={preview}
          busy={busy}
          error={error}
          close={() => setDialog(null)}
          save={async (message, submit, idempotencyKey, onSaved, skipSave) => {
            setError("");
            const mutation = async () => {
              let savedMessage = message;
              if (!skipSave) {
                const response = await api<{ message: Message }>(
                  message.id
                    ? `messages/${encodeURIComponent(message.id)}`
                    : "messages",
                  message,
                  message.id ? "PATCH" : "POST",
                );
                savedMessage = response.message;
                if (
                  !message.id &&
                  (savedMessage.title !== message.title ||
                    savedMessage.body !== message.body ||
                    savedMessage.audience !== message.audience ||
                    savedMessage.platform !== message.platform ||
                    (Date.parse(savedMessage.scheduleAt || "") !==
                      Date.parse(message.scheduleAt || "") &&
                      (savedMessage.scheduleAt || message.scheduleAt)))
                ) {
                  const updated = await api<{ message: Message }>(
                    `messages/${encodeURIComponent(savedMessage.id)}`,
                    {
                      ...message,
                      id: savedMessage.id,
                      revision: savedMessage.revision,
                    },
                    "PATCH",
                  );
                  savedMessage = updated.message;
                }
                onSaved(savedMessage);
              }
              if (submit)
                await api(
                  `messages/${encodeURIComponent(savedMessage.id)}/submit`,
                  {
                    revision: savedMessage.revision,
                    idempotencyKey,
                    confirmed: true,
                  },
                );
            };
            const ok = await action(
              mutation,
              () => {
                const m = {
                  ...message,
                  id: message.id || `demo-${crypto.randomUUID()}`,
                  status: submit
                    ? message.scheduleAt
                      ? "scheduled"
                      : message.platform === "android" ? "available_in_app" : "queued"
                    : "draft",
                  createdAt: message.createdAt || new Date().toISOString(),
                  revision: message.revision || 1,
                } as Message;
                setData((d) => ({
                  ...d,
                  messages: [m, ...d.messages.filter((x) => x.id !== m.id)],
                }));
              },
              submit ? "消息已加入发送计划" : "草稿已保存",
            );
            if (ok) setDialog(null);
            return ok;
          }}
        />
      )}
      {dialog?.kind === "message" && (
        <MessageDetails
          message={dialog.message}
          retry={() => {
            const m = dialog.message,
              retryKey = crypto.randomUUID();
            setDialog(null);
            setConfirm({
              title: "重试失败对象",
              text: "仅重试后端确认可重试的失败对象，不会重新提交已被 Apple 接收的对象。",
              label: "重试失败对象",
              run: () =>
                action(
                  () =>
                    api(`messages/${encodeURIComponent(m.id)}/retry`, {
                      revision: m.revision,
                      confirmed: true,
                      idempotencyKey: retryKey,
                    }),
                  () =>
                    setData((d) => ({
                      ...d,
                      messages: d.messages.map((x) =>
                        x.id === m.id ? { ...x, status: "queued" } : x,
                      ),
                    })),
                  "失败对象已加入重试计划",
                ),
            });
          }}
          close={() => setDialog(null)}
          edit={() => {
            setError("");
            setDialog({ kind: "compose", message: dialog.message });
          }}
        />
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => {
            if (!busy) {
              setConfirm(null);
              setError("");
            }
          }}
          footer={
            <>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                取消
              </Button>
              <Button
                variant={confirm.danger ? "danger" : "primary"}
                disabled={busy}
                onClick={async () => {
                  if (await confirm.run()) setConfirm(null);
                }}
              >
                {busy ? <Busy /> : null}
                {confirm.label}
              </Button>
            </>
          }
        >
          <div className={`confirm-icon ${confirm.danger ? "danger" : ""}`}>
            <AlertCircle size={25} />
          </div>
          <p className="confirm-text">{confirm.text}</p>
          {preview && (
            <p className="hint">当前为演示操作，不影响真实设备或数据。</p>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}

function LoginForm({
  busy,
  error,
  login,
}: {
  busy: boolean;
  error: string;
  login: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form onSubmit={login} className="form-stack auth-form" aria-busy={busy}>
      <Field label="管理员账户">
        <input
          name="username"
          autoComplete="username"
          required
          maxLength={80}
          placeholder="输入管理员账户"
          readOnly={busy}
          aria-describedby={error ? "admin-login-error" : undefined}
          autoFocus
        />
      </Field>
      <Field label="管理员密码">
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          placeholder="输入密码"
          readOnly={busy}
          aria-describedby={error ? "admin-login-error" : undefined}
        />
      </Field>
      {error && (
        <p className="field-error" id="admin-login-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Busy /> : <LogIn size={17} />}登录管理后台
      </Button>
    </form>
  );
}

function ActivationPage({
  codes,
  preview,
  open,
  copy,
}: {
  codes: Code[];
  preview: boolean;
  open: (c: Code) => void;
  copy: (v: string | null) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(1),
    [desc, setDesc] = useState(true);
  const rows = codes
    .filter(
      (c) =>
        (filter === "all" || codeState(c) === filter) &&
        `${c.note} ${c.id} ${c.code || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => (desc ? b.created - a.created : a.created - b.created));
  useEffect(() => setPage(1), [search, filter, desc]);
  return (
    <Panel className="table-panel">
      <div className="table-toolbar">
        <div className="tabs">
          {[
            ["all", "全部"],
            ["available", "可用"],
            ["used", "额度用尽"],
            ["disabled", "已停用"],
          ].map(([id, name]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {name}
              <span>
                {id === "all"
                  ? codes.length
                  : codes.filter((c) => codeState(c) === id).length}
              </span>
            </button>
          ))}
        </div>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="搜索备注或激活码"
        />
      </div>
      <div className="table-hint">
        {preview
          ? "示例激活码不能用于真实激活。"
          : "当前显示最近 200 条记录；搜索与筛选仅作用于已加载记录。"}
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="数据列表"
      >
        <table>
          <thead>
            <tr>
              <th>激活码 / 用途</th>
              <th>授权类型</th>
              <th>状态</th>
              <th>使用额度</th>
              <th>
                <SortButton onClick={() => setDesc(!desc)}>创建时间</SortButton>
              </th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * 8, page * 8).map((c) => (
              <tr key={c.id}>
                <td>
                  <button className="record-link" onClick={() => open(c)}>
                    <span className="record-icon">
                      <KeyRound size={18} />
                    </span>
                    <span>
                      <strong>{c.note || "未备注"}</strong>
                      <small>{c.code || "旧码未补录"}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <span className="type-label">
                    {c.mode === "demo" ? "审核演示" : "普通授权"}
                  </span>
                </td>
                <td>
                  <Badge
                    tone={
                      codeState(c) === "available"
                        ? "green"
                        : codeState(c) === "used"
                          ? "neutral"
                          : "amber"
                    }
                  >
                    {codeState(c) === "available"
                      ? "可用"
                      : codeState(c) === "used"
                        ? "额度用尽"
                        : "已停用"}
                  </Badge>
                </td>
                <td>
                  <span className="quota">
                    <strong>{c.used_count}</strong> / {c.max_uses}
                  </span>
                  <div className="quota-bar">
                    <i
                      style={{ width: `${(c.used_count / c.max_uses) * 100}%` }}
                    />
                  </div>
                </td>
                <td className="muted">{formatDate(c.created)}</td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`复制${c.note}激活码`}
                      onClick={() => copy(c.code)}
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`查看${c.note}详情`}
                      onClick={() => open(c)}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <Empty
          action={
            search || filter !== "all" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                清除筛选
              </Button>
            ) : undefined
          }
        />
      )}
      <Pager page={page} total={rows.length} onChange={setPage} />
    </Panel>
  );
}

function normalizeDevice(d: Device): Device {
  return {
    ...d,
    model: d.model ?? null,
    appVersion: d.appVersion ?? null,
    accountUpdatedAt: d.accountUpdatedAt ?? null,
    accountRevision: d.accountRevision ?? 0,
    activation: d.activation ?? {
      codeId: null,
      note: null,
      state: "legacy_pending",
      codeEnabled: null,
      deviceEnabled: true,
      activatedAt: null,
      checkedAt: null,
    },
  };
}
function DevicesPage({
  devices,
  open,
}: {
  devices: Device[];
  open: (d: Device) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [platform, setPlatform] = useState("all"),
    [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, filter, platform]);
  const rows = devices
    .filter(
      (d) =>
        (filter === "all" || d.activation.state === filter) &&
        (platform === "all" ||
          d.platform === platform ||
          (platform === "unknown" && d.platform === null)) &&
        `${d.accountName || ""} ${d.id} ${d.activation.note || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Date.parse(b.lastSeenAt || "1970-01-01") -
        Date.parse(a.lastSeenAt || "1970-01-01"),
    );
  useEffect(
    () => setPage((p) => Math.min(p, Math.max(1, Math.ceil(rows.length / 8)))),
    [rows.length],
  );
  return (
    <Panel className="table-panel">
      <div className="table-toolbar">
        <div className="tabs">
          {[
            ["all", "全部设备"],
            ["active", "已激活"],
            ["disabled", "已停用"],
            ["legacy_pending", "待关联"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="device-filters">
          <select
            aria-label="筛选设备平台"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="all">全部平台</option>
            <option value="ios">Apple</option>
            <option value="android">Android</option>
            <option value="unknown">待识别</option>
          </select>
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="搜索账户、设备编号或授权备注"
          />
        </div>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="设备与账户列表"
        id="device-list"
      >
        <table>
          <thead>
            <tr>
              <th>当前账户 / 设备编号</th>
              <th>平台 / 版本</th>
              <th>授权状态</th>
              <th>关联激活码</th>
              <th>最近通讯</th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * 8, page * 8).map((d) => (
              <tr key={d.id}>
                <td>
                  <button className="record-link" onClick={() => open(d)}>
                    <span className="user-avatar">
                      {(d.accountName || "D").slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                      <strong>{d.accountName || "未关联账户"}</strong>
                      <small>{d.id}</small>
                    </span>
                    <ChevronRight
                      size={16}
                      className="device-mobile-chevron"
                      aria-hidden="true"
                    />
                  </button>
                </td>
                <td>
                  {d.platform === "ios"
                    ? "Apple"
                    : d.platform === "android"
                      ? "Android"
                      : "待识别"}
                  <small className="cell-sub">
                    {d.appVersion || "版本未知"}
                  </small>
                </td>
                <td>
                  <Badge
                    tone={
                      d.activation.state === "active"
                        ? "green"
                        : d.activation.state === "disabled"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {activationStatus[d.activation.state]}
                  </Badge>
                </td>
                <td>
                  <span>{d.activation.note || "—"}</span>
                  <small className="cell-sub">
                    {d.activation.codeId || "尚未认领"}
                  </small>
                </td>
                <td>
                  {d.lastSeenAt ? formatDate(d.lastSeenAt) : "尚未通讯"}
                  <small className="cell-sub">
                    账户同步 {formatDate(d.accountUpdatedAt)}
                  </small>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`查看${d.accountName || d.id}设备`}
                    onClick={() => open(d)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && (
        <p className="device-scroll-hint">
          左右滑动查看更多 · 点击账户查看设备详情
        </p>
      )}
      {!rows.length && (
        <Empty
          title="没有符合条件的设备"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setFilter("all");
                setPlatform("all");
              }}
            >
              清除筛选
            </Button>
          }
        />
      )}
      <Pager page={page} total={rows.length} onChange={setPage} />
    </Panel>
  );
}

function MessagesPage({
  messages,
  open,
}: {
  messages: Message[];
  open: (m: Message) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const rows = messages.filter(
    (m) =>
      (filter === "all" ||
        (filter === "draft" && m.status === "draft") ||
        (filter === "scheduled" &&
          ["scheduled", "queued", "sending"].includes(m.status)) ||
        (filter === "submitted" &&
          ["available_in_app", "accepted_by_apns", "partial", "failed"].includes(
            m.status,
          ))) &&
      `${m.title} ${m.body}`.includes(search),
  );
  return (
    <Panel className="table-panel">
      <div className="table-toolbar">
        <div className="tabs">
          {[
            ["all", "全部消息"],
            ["draft", "草稿"],
            ["scheduled", "发送计划"],
            ["submitted", "提交记录"],
          ].map(([id, name]) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={filter === id ? "selected" : ""}
            >
              {name}
            </button>
          ))}
        </div>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="搜索消息内容"
        />
      </div>
      <div className="message-list">
        {rows.map((m) => (
          <button key={m.id} className="message-item" onClick={() => open(m)}>
            <span
              className={`message-type ${m.channel === "notification" ? "blue" : ""}`}
            >
              {m.channel === "notification" ? (
                <Bell size={23} />
              ) : (
                <FileText size={23} />
              )}
            </span>
            <div className="message-content">
              <div>
                <h3>{m.title}</h3>
                <Badge
                  tone={
                    m.status === "draft"
                      ? "neutral"
                      : m.status === "failed"
                        ? "amber"
                        : ["accepted_by_apns", "available_in_app"].includes(m.status)
                          ? "green"
                          : "blue"
                  }
                >
                  {messageStatus[m.status]}
                </Badge>
              </div>
              <p>{m.body}</p>
              <small>
                {m.platform === "android" ? "Android · 打开后获取" : "Apple 通知"}
                <i />
                {m.audience === "test" ? "测试设备" : "全部适用用户"}
                <i />
                {formatDate(m.scheduleAt || m.createdAt)}
              </small>
            </div>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
      {!rows.length && (
        <Empty title="这里还没有消息" text="点击“新建消息”，写下第一条通知。" />
      )}
      <div className="message-footnote">
        <AlertCircle size={14} />
        Android 消息在新版 App 打开或回到前台时获取；Apple 接受推送请求不代表用户已收到。
      </div>
    </Panel>
  );
}

function ApnsPage({
  state,
  go,
}: {
  state: ApnsState | null;
  preview: boolean;
  go: (p: Page) => void;
  notify: (s: string) => void;
}) {
  const [filter, setFilter] = useState("all"),
    [configHelp, setConfigHelp] = useState(false);
  const rows =
    state?.records.filter((r) => filter === "all" || r.status === filter) || [];
  return (
    <>
      <Panel className="apns-config">
        <div className="apns-logo">
          <Radio size={30} />
        </div>
        <div className="apns-config-heading">
          <h2>Apple Push Notification service</h2>
          <p>灵动岛与普通通知，在这里分别管理。</p>
        </div>
        <Badge tone={state?.configured ? "green" : "amber"}>
          {state?.configured ? "已配置" : state ? "等待配置" : "后端待接入"}
        </Badge>
        <div className="config-grid">
          <div>
            <span>应用标识</span>
            <strong>{state?.bundleId || "—"}</strong>
          </div>
          <div>
            <span>推送密钥</span>
            <strong>{state?.keyId || "尚未配置"}</strong>
          </div>
          <div>
            <span>开发者团队</span>
            <strong>{state?.teamId || "尚未配置"}</strong>
          </div>
          <div>
            <span>环境</span>
            <strong>{state?.environment || "—"}</strong>
          </div>
        </div>
        <div className="config-footer">
          <span>
            <Lock size={14} />
            密钥仅保存在服务器，网页不展示私钥内容。
          </span>
          <Button variant="secondary" onClick={() => setConfigHelp(true)}>
            查看配置说明
            <ArrowUpRight size={14} />
          </Button>
        </div>
      </Panel>
      <div className="channel-grid">
        <Panel>
          <div className="channel-head">
            <span className="channel-icon">
              <Smartphone size={22} />
            </span>
            <Badge tone={state?.capabilities.liveactivity ? "blue" : "neutral"}>
              {state?.capabilities.liveactivity ? "通道已实现" : "待接入"}
            </Badge>
          </div>
          <h3>课程实时活动</h3>
          <p>
            按课表启动、更新与结束灵动岛。
            <br />
            用户需同意上传，并具备可用推送凭证。
          </p>
          <button className="text-button" onClick={() => go("devices")}>
            查看课表与提醒
            <ArrowRight size={15} />
          </button>
        </Panel>
        <Panel>
          <div className="channel-head">
            <span className="channel-icon">
              <Bell size={22} />
            </span>
            <Badge tone={state?.capabilities.notification ? "green" : "amber"}>
              {state?.capabilities.notification
                ? "通道可用"
                : "待后端与 App 接入"}
            </Badge>
          </div>
          <h3>普通消息通知</h3>
          <p>
            向适用的 iPhone 发送文字通知。
            <br />
            需要 App 注册普通通知推送凭证。
          </p>
          <button className="text-button" onClick={() => go("messages")}>
            前往消息中心
            <ArrowRight size={15} />
          </button>
        </Panel>
      </div>
      <Panel className="table-panel">
        <div className="table-toolbar">
          <h2>推送提交记录</h2>
          <select
            aria-label="筛选推送结果"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全部结果</option>
            <option value="accepted_by_apns">已提交 APNs</option>
            <option value="queued">排队中</option>
            <option value="failed">提交失败</option>
            <option value="expired">已过期</option>
          </select>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label="数据列表"
        >
          <table>
            <thead>
              <tr>
                <th>账户</th>
                <th>操作</th>
                <th>环境</th>
                <th>结果</th>
                <th>时间 / 原因</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.accountName || "未上传账户名"}</td>
                  <td>
                    {
                      {
                        start: "启动实时活动",
                        update: "更新状态",
                        end: "结束活动",
                        notification: "普通通知",
                      }[r.kind]
                    }
                  </td>
                  <td>
                    <span className="type-label">
                      {r.environment === "sandbox" ? "测试" : "正式"}
                    </span>
                  </td>
                  <td>
                    <Badge
                      tone={
                        r.status === "failed"
                          ? "amber"
                          : r.status === "accepted_by_apns"
                            ? "green"
                            : "neutral"
                      }
                    >
                      {
                        {
                          queued: "排队中",
                          accepted_by_apns: "已提交 APNs",
                          failed: "提交失败",
                          expired: "已过期",
                        }[r.status]
                      }
                    </Badge>
                  </td>
                  <td>
                    <span>{formatDate(r.at)}</span>
                    {r.reason && (
                      <small className="cell-sub error-text">{r.reason}</small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <Empty title="暂无对应推送记录" text="真实提交结果由推送服务提供。" />
        )}
        <div className="message-footnote">
          <CheckCheck size={15} />
          “已提交 APNs”表示 Apple 接受了请求，不代表设备实际展示或用户阅读。
        </div>
      </Panel>
      {configHelp && (
        <Modal title="Apple 推送配置" onClose={() => setConfigHelp(false)}>
          <div className="form-stack">
            <p className="hint">
              请由后台维护者在新服务器配置 Apple
              推送密钥、密钥标识和开发者团队，再分别验证测试与正式环境。
            </p>
            <div className="info-note">
              <Lock size={18} />
              <span>私钥不得上传至此网页，不得放入前端资源或浏览器存储。</span>
            </div>
            <p className="hint">
              课程实时活动还需要 App 的 Live Activity
              推送凭证；普通消息需要独立的通知凭证与权限。网页中的“已配置”只代表服务配置，真实送达需要手机验收。
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

function CreateCode({
  busy,
  error,
  close,
  create,
}: {
  busy: boolean;
  error: string;
  close: () => void;
  create: (note: string, max: number, mode: "normal" | "demo") => void;
}) {
  return (
    <Modal
      title="生成激活码"
      subtitle="先设置用途与额度，方便以后查找"
      onClose={close}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          create(
            String(f.get("note")),
            Number(f.get("maxUses")),
            f.get("mode") as "normal" | "demo",
          );
        }}
      >
        <Field label="用途备注">
          <input
            name="note"
            maxLength={100}
            placeholder="例如：iPhone 测试设备"
            autoFocus
          />
        </Field>
        <Field label="激活次数" hint="同一安装重复请求不会重复占用额度。">
          <input
            name="maxUses"
            type="number"
            min={1}
            max={10000}
            defaultValue={1}
            required
          />
        </Field>
        <Field label="授权类型">
          <select name="mode">
            <option value="normal">普通授权</option>
            <option value="demo">审核演示授权</option>
          </select>
        </Field>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? <Busy /> : <Plus size={17} />}生成激活码
        </Button>
      </form>
    </Modal>
  );
}

function CodeDetails({
  code: c,
  busy,
  error,
  preview,
  close,
  copy,
  activate,
  saveQuota,
  saveCode,
}: {
  code: Code;
  busy: boolean;
  error: string;
  preview: boolean;
  close: () => void;
  copy: (s: string | null) => void;
  activate: (c: Code, k: string) => void;
  saveQuota: (c: Code, n: number) => void;
  saveCode: (c: Code, s: string) => void;
}) {
  return (
    <Modal
      title={c.note || "激活码详情"}
      subtitle={c.id}
      drawer
      onClose={close}
    >
      <div className="detail-code">
        <span>激活码</span>
        <strong>{c.code || "旧码尚未补录"}</strong>
        <Button
          variant="secondary"
          onClick={() => copy(c.code)}
          disabled={!c.code}
        >
          <Copy size={15} />
          复制{preview ? "演示标识" : "激活码"}
        </Button>
      </div>
      <div className="detail-grid">
        <div>
          <span>状态</span>
          <Badge tone={c.enabled ? "green" : "amber"}>
            {c.enabled ? "已启用" : "已停用"}
          </Badge>
        </div>
        <div>
          <span>授权类型</span>
          <strong>{c.mode === "demo" ? "审核演示" : "普通授权"}</strong>
        </div>
        <div>
          <span>已使用额度</span>
          <strong>
            {c.used_count} / {c.max_uses}
          </strong>
        </div>
        <div>
          <span>创建时间</span>
          <strong>{formatDate(c.created)}</strong>
        </div>
      </div>
      <form
        className="form-stack detail-section"
        onSubmit={(e) => {
          e.preventDefault();
          saveQuota(c, Number(new FormData(e.currentTarget).get("quota")));
        }}
      >
        <h3>调整额度</h3>
        <Field label="激活次数" hint={`不能低于已使用的 ${c.used_count} 次。`}>
          <input
            name="quota"
            type="number"
            min={Math.max(1, c.used_count)}
            max={10000}
            defaultValue={c.max_uses}
            required
          />
        </Field>
        <Button variant="secondary" type="submit" disabled={busy}>
          {busy ? <Busy /> : null}保存额度
        </Button>
      </form>
      {!c.code && (
        <form
          className="form-stack detail-section"
          onSubmit={(e) => {
            e.preventDefault();
            saveCode(c, String(new FormData(e.currentTarget).get("code")));
          }}
        >
          <h3>补录原激活码</h3>
          <Field label="完整激活码" hint="必须与原记录匹配，不能用此功能换码。">
            <input
              name="code"
              required
              pattern="AMS-[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}"
              placeholder="AMS-XXXXXXXX-XXXXXXXX-XXXXXXXX"
            />
          </Field>
          <Button variant="secondary" type="submit" disabled={busy}>
            保存原激活码
          </Button>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="detail-section danger-section">
        <h3>授权操作</h3>
        <p>
          停用会在客户端后续成功验证时生效。重置绑定后，已有安装凭证仍可使用。
        </p>
        <div className="button-row">
          <Button
            variant={c.enabled ? "danger-outline" : "secondary"}
            onClick={() => activate(c, c.enabled ? "disable" : "enable")}
          >
            {c.enabled ? "停用激活码" : "启用激活码"}
          </Button>
          <Button variant="secondary" onClick={() => activate(c, "reset")}>
            重置绑定
          </Button>
        </div>
        {!c.enabled &&
          c.used_count === 0 &&
          c.issued === null &&
          c.device === null && (
            <Button
              variant="danger-outline"
              onClick={() => activate(c, "delete")}
            >
              <Trash2 size={15} />
              删除未使用记录
            </Button>
          )}
      </div>
    </Modal>
  );
}

function DeviceDetails({
  device: initial,
  preview,
  close,
  deleteDevice,
  toggleDevice,
}: {
  device: Device;
  preview: boolean;
  close: () => void;
  deleteDevice: () => void;
  toggleDevice: () => void;
}) {
  const [device, setDevice] = useState(initial),
    [showCourses, setShowCourses] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [day, setDay] = useState(chinaDay());
  useEffect(() => {
    setDevice(initial);
  }, [initial]);
  useEffect(() => {
    let active = true;
    if (showCourses && !preview) {
      setLoading(true);
      api<{ device: Device; courses: Device["courses"] }>(
        `devices/${encodeURIComponent(initial.id)}`,
      )
        .then((r) => {
          if (active)
            setDevice({ ...normalizeDevice(r.device), courses: r.courses });
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [initial.id, preview, showCourses]);
  const courses = device.courses?.filter((c) => c.date === day) || [],
    claimed =
      device.activation.state !== "legacy_pending" &&
      device.activation.state !== "unbound";
  return (
    <Modal
      title={device.accountName || "未关联账户"}
      subtitle={device.id}
      drawer
      onClose={close}
      footer={
        <Button
          variant={
            device.activation.deviceEnabled ? "danger-outline" : "primary"
          }
          disabled={!claimed}
          onClick={toggleDevice}
        >
          {device.activation.deviceEnabled ? "停用此设备" : "启用此设备"}
        </Button>
      }
    >
      <div className="device-summary">
        <span className="large-avatar">
          {(device.accountName || "D").slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h3>
            {device.model ||
              (device.platform === "ios"
                ? "Apple 设备"
                : device.platform === "android"
                  ? "Android 设备"
                  : "设备型号待识别")}
          </h3>
          <Badge
            tone={
              device.activation.state === "active"
                ? "green"
                : device.activation.state === "disabled"
                  ? "amber"
                  : "neutral"
            }
          >
            {activationStatus[device.activation.state]}
          </Badge>
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <span>当前账户</span>
          <strong>{device.accountName || "未关联账户"}</strong>
        </div>
        <div>
          <span>账户同步时间</span>
          <strong>{formatDate(device.accountUpdatedAt)}</strong>
        </div>
        <div>
          <span>关联激活码</span>
          <strong>{device.activation.note || "—"}</strong>
          <small>{device.activation.codeId || "待认领设备编号"}</small>
        </div>
        <div>
          <span>最近通讯</span>
          <strong>{formatDate(device.lastSeenAt)}</strong>
        </div>
        <div>
          <span>最近授权校验</span>
          <strong>{formatDate(device.activation.checkedAt)}</strong>
        </div>
        <div>
          <span>应用版本</span>
          <strong>{device.appVersion || "未知版本"}</strong>
        </div>
      </div>
      {device.activation.codeEnabled === false && (
        <p className="field-error">
          关联激活码已停用；单独启用设备仍不能恢复授权。
        </p>
      )}
      {!claimed && (
        <p className="hint">
          升级后的 App 首次通讯并认领编号后，可在这里单独管理设备授权。
        </p>
      )}
      <div className="detail-section">
        <div className="section-label">
          <h3>云端课表与提醒</h3>
          <Badge tone={device.prefs.enabled ? "blue" : "neutral"}>
            {device.prefs.enabled ? "提醒开启" : "提醒关闭"}
          </Badge>
        </div>
        <div className="detail-grid">
          <div>
            <span>课表同步</span>
            <strong>{formatDate(device.timetableUpdatedAt)}</strong>
          </div>
          <div>
            <span>缓存课程</span>
            <strong>{device.courseCount} 节</strong>
          </div>
          <div>
            <span>提前提醒</span>
            <strong>{device.prefs.leadMin} 分钟</strong>
          </div>
          <div>
            <span>待执行</span>
            <strong>{device.pendingCount} 项</strong>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => setShowCourses(!showCourses)}
        >
          <CalendarDays size={16} />
          {showCourses ? "收起云端课表" : "查看云端课表"}
        </Button>
        {showCourses && (
          <div className="detail-section">
            <div className="section-label">
              <input
                type="date"
                aria-label="选择课程日期"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            {loading ? (
              <div className="loading-panel">
                <Busy />
                正在读取课表…
              </div>
            ) : (
              <>
                {error && (
                  <p role="alert" className="field-error">
                    {error}
                  </p>
                )}
                {courses.map((c) => (
                  <div className="detail-course" key={c.key}>
                    <div>
                      <Badge tone="blue">{c.code}</Badge>
                      <span>
                        {c.start}–{c.end}
                      </span>
                    </div>
                    <h3>{c.title}</h3>
                    <p>
                      <MapPin size={14} />
                      {c.room} · {c.location}
                    </p>
                  </div>
                ))}
                {!courses.length && !error && (
                  <Empty
                    title="这一天没有云端课程"
                    text="可以选择其他日期查看。"
                  />
                )}
              </>
            )}
          </div>
        )}
        <Button variant="danger-outline" onClick={deleteDevice}>
          <Trash2 size={15} />
          清除云端课表与提醒
        </Button>
      </div>
    </Modal>
  );
}

function MessageDetails({
  message: m,
  close,
  edit,
  retry,
}: {
  message: Message;
  close: () => void;
  edit: () => void;
  retry: () => void;
}) {
  return (
    <Modal
      title="消息详情"
      subtitle={messageStatus[m.status]}
      drawer
      onClose={close}
      footer={
        m.status === "draft" || m.status === "scheduled" ? (
          <Button onClick={edit}>编辑与预览</Button>
        ) : ["failed", "partial"].includes(m.status) && m.retryable ? (
          <Button onClick={retry}>重试失败对象</Button>
        ) : undefined
      }
    >
      {m.platform === "android" ? <AnnouncementPreview title={m.title} body={m.body} message /> : <PhonePreview title={m.title} body={m.body} channel={m.channel} />}
      <div className="detail-grid">
        <div>
          <span>消息类型</span>
          <strong>{m.platform === "android" ? "Android App 内消息" : "Apple 通知"}</strong>
        </div>
        <div>
          <span>发送对象</span>
          <strong>{m.audience === "test" ? "测试设备" : "全部适用用户"}</strong>
        </div>
        <div>
          <span>发送时间</span>
          <strong>{m.scheduleAt ? formatDate(m.scheduleAt) : "立即"}</strong>
        </div>
        <div>
          <span>状态</span>
          <Badge tone={m.status === "failed" ? "amber" : "blue"}>
            {messageStatus[m.status]}
          </Badge>
        </div>
      </div>
      {m.reason && <p className="field-error">{m.reason}</p>}
      {m.platform === "android" && <p className="hint">接收设备 {m.recipientCount ?? "待核对"} · 校验回复中提供 {m.offeredCount ?? "待核对"} · 已确认阅读 {m.readCount ?? "待核对"}</p>}
      <p className="hint">{m.platform === "android" ? "用户打开新版 App 或回到前台后获取；提供内容不等于已阅读，没有后台远程推送。" : "推送提交成功不代表已送达或已阅读。"}</p>
    </Modal>
  );
}

function PhonePreview({
  title,
  body,
  channel,
}: {
  title: string;
  body: string;
  channel: string;
}) {
  return (
    <div className="phone-preview">
      <div className="phone-top">
        <span className="phone-time">9:41</span>
        <span>
          <Wifi size={14} />
          <span className="battery" />
        </span>
      </div>
      <div className="phone-island" />
      <div className="phone-date">星期二，校园的一天</div>
      <div className="phone-clock">09:41</div>
      <div
        className={`phone-notification ${channel === "announcement" ? "announcement" : ""}`}
      >
        <div>
          <span className="mini-logo">A</span>
          <span>AMS 校园助手</span>
          <small>现在</small>
        </div>
        <h3>{title || "消息标题"}</h3>
        <p>{body || "写下消息内容，在这里查看手机上的显示效果。"}</p>
        {channel === "announcement" && (
          <span className="preview-action">
            查看详情
            <ChevronRight size={13} />
          </span>
        )}
      </div>
      <span className="phone-bottom" />
    </div>
  );
}

function Composer({
  initial,
  preview,
  busy,
  error,
  close,
  save,
}: {
  initial?: Message;
  preview: boolean;
  busy: boolean;
  error: string;
  close: () => void;
  save: (
    m: Message,
    submit: boolean,
    key: string,
    onSaved: (m: Message) => void,
    skipSave?: boolean,
  ) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title || ""),
    [body, setBody] = useState(initial?.body || ""),
    [platform, setPlatform] = useState<"ios" | "android">(initial?.platform || "ios"),
    [audience, setAudience] = useState<"all" | "test">(
      initial?.audience || "test",
    ),
    [schedule, setSchedule] = useState(chinaInput(initial?.scheduleAt || null)),
    [step, setStep] = useState(1),
    [validation, setValidation] = useState(""),
    [discard, setDiscard] = useState(false);
  const draft = useRef({
      id: initial?.id || "",
      revision: initial?.revision || 1,
      signature: "",
    }),
    createKey = useRef(crypto.randomUUID()),
    submission = useRef({ signature: "", key: "" });
  const signature = () =>
    JSON.stringify([title.trim(), body.trim(), platform, audience, schedule]);
  const valid = () => {
    if (!title.trim() || !body.trim()) {
      setValidation("请填写消息标题和内容。");
      return false;
    }
    if (body.length > 500) {
      setValidation("通知内容最多 500 个字符。");
      return false;
    }
    if (schedule && Date.parse(schedule + ":00+08:00") <= Date.now()) {
      setValidation("计划发送时间必须晚于当前时间。");
      return false;
    }
    setValidation("");
    return true;
  };
  const persist = async (submit: boolean) => {
    if (!valid()) return;
    const sig = signature();
    if (submission.current.signature !== sig)
      submission.current = { signature: sig, key: crypto.randomUUID() };
    const m = {
      id: draft.current.id,
      title: title.trim(),
      body: body.trim(),
      channel: "notification",
      platform,
      audience,
      scheduleAt: schedule ? schedule + ":00+08:00" : null,
      status: "draft",
      createdAt: initial?.createdAt || "",
      revision: draft.current.revision,
      clientRequestId: createKey.current,
    } as Message;
    await save(
      m,
      submit,
      submission.current.key,
      (saved) => {
        draft.current = {
          id: saved.id,
          revision: saved.revision,
          signature: sig,
        };
      },
      submit && draft.current.signature === sig,
    );
  };
  const requestClose = () => {
    if (busy) return;
    if (
      title !== (initial?.title || "") ||
      body !== (initial?.body || "") ||
      platform !== (initial?.platform || "ios") ||
      audience !== (initial?.audience || "test") ||
      schedule !== chinaInput(initial?.scheduleAt || null)
    )
      setDiscard(true);
    else close();
  };
  if (discard)
    return (
      <Modal
        title="放弃未保存的修改？"
        onClose={() => setDiscard(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscard(false)}>
              继续编辑
            </Button>
            <Button variant="danger" onClick={close}>
              放弃修改
            </Button>
          </>
        }
      >
        <p className="confirm-text">关闭后，本次未保存的消息内容会丢失。</p>
      </Modal>
    );
  return (
    <Modal
      title={step === 1 ? (initial ? "编辑消息" : "新建消息") : "确认发送计划"}
      subtitle={
        preview ? "仅演示操作，不会向真实用户发送" : "检查内容、对象与发送时间"
      }
      onClose={requestClose}
      wide
      footer={
        <>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => (step === 2 ? setStep(1) : void persist(false))}
          >
            {step === 2 ? <ArrowLeft size={15} /> : <FileText size={15} />}{" "}
            {step === 2 ? "返回编辑" : "保存草稿"}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (!valid()) return;
              step === 1 ? setStep(2) : void persist(true);
            }}
          >
            {busy ? (
              <Busy />
            ) : step === 1 ? (
              <Eye size={16} />
            ) : (
              <Send size={16} />
            )}{" "}
            {step === 1
              ? "检查发送预览"
              : preview
                ? "演示加入发送计划"
                : "确认加入发送计划"}
          </Button>
        </>
      }
    >
      <div className="composer-grid">
        <div className="form-stack">
          {step === 1 ? (
            <>
              <Field label="消息标题">
                <input
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：服务维护提醒"
                  autoFocus
                />
              </Field>
              <Field label="消息内容">
                <textarea
                  value={body}
                  maxLength={500}
                  rows={5}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="填写要发送到手机的通知内容。"
                />
                <small className="char-count">{body.length} / 500</small>
              </Field>
              <Field label="接收平台">
                <select value={platform} onChange={(e) => setPlatform(e.target.value as "ios" | "android")} aria-describedby="message-channel-help">
                  <option value="ios">Apple · 系统通知</option>
                  <option value="android">Android · 打开 App 后获取</option>
                </select>
              </Field>
              <p id="message-channel-help" className="hint">{platform === "android" ? "新版 Android 打开 App 或回到前台时获取，App 未打开时不会弹出远程通知。" : "通过 Apple 推送通道发送系统通知。"}</p>
              <Field label="发送对象">
                <select
                  value={audience}
                  onChange={(e) =>
                    setAudience(e.target.value as "all" | "test")
                  }
                >
                  <option value="test">测试设备（建议先测试）</option>
                  <option value="all">{platform === "android" ? "全部适用 Android 设备" : "全部适用 Apple 设备"}</option>
                </select>
              </Field>
              <Field label="发送时间（北京时间）" hint="留空为立即发送">
                <input
                  type="datetime-local"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <div className="confirmation-summary">
                <CheckCircle2 size={25} />
                <h3>检查发送内容</h3>
              </div>
              <dl className="review-list">
                <div>
                  <dt>类型</dt>
                  <dd>{platform === "android" ? "Android App 内消息 · 打开后获取" : "Apple 通知"}</dd>
                </div>
                <div>
                  <dt>对象</dt>
                  <dd>
                    {audience === "test" ? "测试设备" : platform === "android" ? "全部适用 Android 设备" : "全部适用 Apple 设备"}
                  </dd>
                </div>
                <div>
                  <dt>人数</dt>
                  <dd>{preview ? "示例受众" : "由后端执行前校验"}</dd>
                </div>
                <div>
                  <dt>发送时间</dt>
                  <dd>{schedule ? schedule.replace("T", " ") : "立即"}</dd>
                </div>
              </dl>
              <div className="info-note">
                <AlertCircle size={18} />
                <span>
                  {preview
                    ? "当前计划只保存为演示记录。"
                    : platform === "android" ? "发布后等待用户打开新版 App 获取；没有后台远程推送。" : "需要普通通知通道可用；提交 Apple 不代表设备已展示。"}
                </span>
              </div>
            </>
          )}
          {(validation || error) && (
            <p role="alert" className="field-error">
              {validation || error}
            </p>
          )}
        </div>
        <div className="composer-preview">
          <span className="preview-label">
            <Smartphone size={15} />
            手机显示预览
          </span>
          {platform === "android" ? <AnnouncementPreview title={title} body={body} message /> : <PhonePreview title={title} body={body} channel="notification" />}
          <p>用于预览排版，实际样式随设备变化。</p>
        </div>
      </div>
    </Modal>
  );
}
function SettingsPage({
  settings,
  preview,
  username,
  busy,
  action,
  update,
  onSessionEnd,
}: {
  settings: Settings | null;
  preview: boolean;
  username: string;
  busy: boolean;
  action: (
    real: () => Promise<unknown>,
    demo: () => void,
    s: string,
  ) => Promise<boolean>;
  update: (s: Settings) => void;
  onSessionEnd: () => void;
}) {
  const [tab, setTab] = useState("release"),
    [validation, setValidation] = useState("");
  if (!settings)
    return (
      <Panel>
        <Empty
          title="设置服务尚未接入"
          text="后端接入后，可在这里管理版本与账户。"
        />
      </Panel>
    );
  const saveSettings = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      s = {
        interval_days: settings.interval_days,
        version_code: Number(f.get("build")),
        version_name: String(f.get("version")),
        download_url: String(f.get("url")),
        release_notes: String(f.get("notes")),
      };
    void action(
      () =>
        api("settings", {
          intervalDays: s.interval_days,
          versionCode: s.version_code,
          versionName: s.version_name,
          downloadUrl: s.download_url,
          notes: s.release_notes,
        }),
      () => update(s),
      "版本与验证设置已保存",
    );
  };
  const saveAccount = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      next = String(f.get("newPassword") || "");
    if (next !== f.get("confirmPassword")) {
      setValidation("两次输入的新密码不一致。");
      return;
    }
    setValidation("");
    let done = false;
    await action(
      async () => {
        const r = await api("credentials", {
          username: f.get("username"),
          currentPassword: f.get("currentPassword"),
          newPassword: next,
        });
        done = true;
        return r;
      },
      () => {},
      "账户信息已保存",
    );
    if (done && !preview) onSessionEnd();
  };
  return (
    <div className="settings-layout">
      <div className="settings-nav">
        {[
          ["release", "版本与验证", Monitor],
          ["account", "管理员账户", ShieldCheck],
        ].map(([id, label, Icon]) => {
          const I = Icon as typeof Monitor;
          return (
            <button
              key={id as string}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id as string)}
            >
              <I size={18} />
              {label as string}
              <ChevronRight size={16} />
            </button>
          );
        })}
      </div>
      <Panel className="settings-panel">
        {tab === "release" ? (
          <form className="form-stack" onSubmit={saveSettings}>
            <div className="panel-title">
              <div>
                <h2>版本与验证</h2>
                <p>管理 Android 版本提示；新版通讯方式见下方。</p>
              </div>
            </div>
            <div className="connection-policy">
              <ShieldCheck size={21} />
              <div>
                <strong>新版每次打开校验</strong>
                <p>
                  打开 App
                  或重新进入前台时同步授权、账户与公告。旧版继续按原协议校验，升级后采用新方式。
                </p>
              </div>
            </div>
            <div className="two-fields">
              <Field label="版本名称">
                <input
                  name="version"
                  maxLength={40}
                  defaultValue={settings.version_name}
                  required
                />
              </Field>
              <Field label="版本编号">
                <input
                  name="build"
                  type="number"
                  min={0}
                  max={2147483647}
                  defaultValue={settings.version_code}
                  required
                />
              </Field>
            </div>
            <Field label="下载链接">
              <input
                name="url"
                type="url"
                pattern="https://.*"
                maxLength={500}
                defaultValue={settings.download_url}
                required
              />
            </Field>
            <Field label="更新说明">
              <textarea
                name="notes"
                rows={4}
                maxLength={2000}
                defaultValue={settings.release_notes}
              />
            </Field>
            <div className="settings-save">
              <Button type="submit" disabled={busy}>
                {busy ? <Busy /> : <Check size={16} />}保存设置
              </Button>
              <span>仅填写已经可以下载的版本。</span>
            </div>
          </form>
        ) : (
          <form className="form-stack" onSubmit={saveAccount}>
            <div className="panel-title">
              <div>
                <h2>管理员账户</h2>
                <p>修改后全部管理会话失效，需要重新登录。</p>
              </div>
            </div>
            <Field label="账户名">
              <input
                name="username"
                defaultValue={username || "preview.admin"}
                minLength={3}
                maxLength={80}
                required
                autoComplete="username"
              />
            </Field>
            <Field label="当前密码">
              <input
                type="password"
                name="currentPassword"
                maxLength={128}
                autoComplete="current-password"
                required
              />
            </Field>
            <Field
              label="新密码"
              hint="留空只修改账户名；新密码至少 10 个字符。"
            >
              <input
                type="password"
                name="newPassword"
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
              />
            </Field>
            <Field label="确认新密码">
              <input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
              />
            </Field>
            {validation && (
              <p role="alert" className="field-error">
                {validation}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? <Busy /> : <Check size={16} />}保存账户信息
            </Button>
          </form>
        )}
      </Panel>
    </div>
  );
}

function CommandDialog({
  go,
  close,
}: {
  go: (p: Page) => void;
  close: () => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <Modal title="快速前往" onClose={close}>
      <SearchBox
        value={search}
        onChange={setSearch}
        placeholder="搜索页面名称"
      />
      <div className="command-list">
        {navigation
          .filter((n) => n.name.includes(search))
          .map((n) => (
            <button key={n.id} onClick={() => go(n.id)}>
              <n.icon size={19} />
              <span>{n.name}</span>
              <ArrowUpRight size={15} />
            </button>
          ))}
      </div>
    </Modal>
  );
}

function PublishMenu() {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => () => cancel(), []);
  const items = [
    {
      label: "Android 发布",
      url: "https://www.pgyer.com/dashboard/?agKey=c8f32d50b6298e94b012f9a3f6b475d6",
      icon: Smartphone,
    },
    {
      label: "Apple 发布",
      url: "https://appstoreconnect.apple.com/apps/6821119883/distribution",
      icon: Monitor,
    },
  ];
  return (
    <div
      className="publish-menu"
      ref={ref}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          cancel();
          setOpen(true);
        }
      }}
      onPointerLeave={() => {
        cancel();
        timer.current = setTimeout(() => {
          if (!ref.current?.contains(document.activeElement)) setOpen(false);
        }, 150);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
          e.stopPropagation();
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setOpen(true);
          requestAnimationFrame(() => {
            const links =
              ref.current?.querySelectorAll<HTMLAnchorElement>(
                '[role="menuitem"]',
              );
            if (!links?.length) return;
            const current = Array.from(links).indexOf(
                document.activeElement as HTMLAnchorElement,
              ),
              next =
                e.key === "ArrowDown"
                  ? (current + 1) % links.length
                  : current <= 0
                    ? links.length - 1
                    : current - 1;
            links[next].focus();
          });
        }
      }}
    >
      <button
        ref={trigger}
        className="button secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="publish-options"
        onClick={() => {
          cancel();
          setOpen(!open);
        }}
      >
        应用发布
        <ChevronDown size={16} className={open ? "turned" : ""} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="publish-options"
            className="publish-options"
            role="menu"
            aria-label="应用发布平台"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: 0.14 }}
          >
            {items.map((item) => (
              <a
                key={item.label}
                role="menuitem"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
              >
                <item.icon size={17} />
                {item.label}
                <ArrowUpRight size={15} />
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnnouncementsPage({
  announcements,
  open,
}: {
  announcements: Announcement[];
  open: (a: Announcement) => void;
}) {
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all");
  const rows = announcements
    .filter(
      (a) =>
        (filter === "all" ||
          (filter === "active"
            ? isActiveAnnouncement(a)
            : a.status === filter)) &&
        `${a.title} ${a.body}`.includes(search),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return (
    <Panel className="table-panel">
      <div className="table-toolbar">
        <div className="tabs">
          {[
            ["all", "全部公告"],
            ["active", "生效中"],
            ["draft", "草稿"],
            ["scheduled", "待发布"],
            ["withdrawn", "已下架"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={filter === id ? "selected" : ""}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="搜索公告内容"
        />
      </div>
      <div className="announcement-list">
        {rows.map((a) => (
          <button
            className="announcement-item"
            key={a.id}
            onClick={() => open(a)}
          >
            <span className="message-type">
              <Megaphone size={22} />
            </span>
            <div className="message-content">
              <div>
                <h3>{a.title}</h3>
                <Badge
                  tone={
                    isActiveAnnouncement(a)
                      ? "green"
                      : a.status === "scheduled"
                        ? "blue"
                        : "neutral"
                  }
                >
                  {a.status === "published" && !isActiveAnnouncement(a)
                    ? a.expiresAt && Date.parse(a.expiresAt) <= Date.now()
                      ? "已结束"
                      : "待生效"
                    : announcementStatus[a.status]}
                </Badge>
              </div>
              <p>{a.body}</p>
              <small>
                {platformName(a.platform)}
                <i />
                {formatDate(a.publishAt || a.updatedAt)}
                {a.expiresAt && <> · 截止 {formatDate(a.expiresAt)}</>}
              </small>
            </div>
            <ChevronRight size={18} />
          </button>
        ))}
      </div>
      {!rows.length && (
        <Empty title="暂无对应公告" text="新建公告，或尝试其他筛选条件。" />
      )}
    </Panel>
  );
}
function platformName(platform: string) {
  return platform === "all"
    ? "全部平台"
    : platform === "ios"
      ? "Apple"
      : "Android";
}
function AnnouncementPreview({ title, body, message = false }: { title: string; body: string; message?: boolean }) {
  return (
    <div className="app-announcement-preview">
      <div className="app-preview-head">
        <span className="mini-logo">A</span>
        <strong>AMS 校园助手</strong>
        <small>{message ? "应用内消息" : "应用内公告"}</small>
      </div>
      <span className="eyebrow">{message ? "消息" : "公告"}</span>
      <h3>{title || (message ? "消息标题" : "公告标题")}</h3>
      <p>{body || "填写公告内容，在这里查看 App 内的阅读效果。"}</p>
      <div className="app-preview-foot">
        {message ? "知道了" : "查看详情"}
        <ChevronRight size={14} />
      </div>
    </div>
  );
}
function AnnouncementDetails({
  announcement: a,
  close,
  edit,
  withdraw,
}: {
  announcement: Announcement;
  close: () => void;
  edit: () => void;
  withdraw: () => void;
}) {
  const live = a.status === "published" || a.status === "scheduled";
  return (
    <Modal
      title="公告详情"
      subtitle={announcementStatus[a.status]}
      drawer
      onClose={close}
      footer={
        live ? (
          <Button variant="danger-outline" onClick={withdraw}>
            下架公告
          </Button>
        ) : (
          <Button onClick={edit}>编辑公告</Button>
        )
      }
    >
      <AnnouncementPreview title={a.title} body={a.body} />
      <div className="detail-grid">
        <div>
          <span>适用平台</span>
          <strong>{platformName(a.platform)}</strong>
        </div>
        <div>
          <span>发布时间</span>
          <strong>{a.publishAt ? formatDate(a.publishAt) : "立即"}</strong>
        </div>
        <div>
          <span>结束时间</span>
          <strong>{a.expiresAt ? formatDate(a.expiresAt) : "持续生效"}</strong>
        </div>
        <div>
          <span>最近修改</span>
          <strong>{formatDate(a.updatedAt)}</strong>
        </div>
      </div>
      {live && <p className="hint">修改已发布或待发布的公告，先下架再编辑。</p>}
    </Modal>
  );
}
function AnnouncementComposer({
  initial,
  preview,
  pushReady,
  busy,
  error,
  close,
  save,
}: {
  initial?: Announcement;
  preview: boolean;
  pushReady: boolean;
  busy: boolean;
  error: string;
  close: () => void;
  save: (
    a: Announcement,
    publish: boolean,
    key: string,
    createKey: string,
    notify: boolean,
    audience: "all" | "test",
    onSaved: (a: Announcement) => void,
    skipSave?: boolean,
  ) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title || ""),
    [body, setBody] = useState(initial?.body || ""),
    [platform, setPlatform] = useState<Announcement["platform"]>(
      initial?.platform || "all",
    ),
    [publishAt, setPublishAt] = useState(
      chinaInput(initial?.publishAt || null),
    ),
    [expiresAt, setExpiresAt] = useState(
      chinaInput(initial?.expiresAt || null),
    ),
    [notifyUsers, setNotifyUsers] = useState(false),
    [audience, setAudience] = useState<"all" | "test">("test"),
    [step, setStep] = useState(1),
    [validation, setValidation] = useState(""),
    [discard, setDiscard] = useState(false);
  const draft = useRef({
      id: initial?.id || "",
      revision: initial?.revision || 1,
      signature: "",
    }),
    createKey = useRef(crypto.randomUUID()),
    submission = useRef({ signature: "", key: "" });
  const value = (): Announcement => ({
    id: draft.current.id,
    title: title.trim(),
    body: body.trim(),
    platform,
    status: "draft",
    publishAt: publishAt ? publishAt + ":00+08:00" : null,
    expiresAt: expiresAt ? expiresAt + ":00+08:00" : null,
    createdAt: initial?.createdAt || "",
    updatedAt: initial?.updatedAt || "",
    revision: draft.current.revision,
  });
  const signature = () =>
    JSON.stringify([title.trim(), body.trim(), platform, publishAt, expiresAt]);
  const valid = () => {
    if (!title.trim() || !body.trim()) {
      setValidation("请填写公告标题和内容。");
      return false;
    }
    const start = publishAt ? Date.parse(publishAt + ":00+08:00") : Date.now();
    if (publishAt && start <= Date.now()) {
      setValidation("计划发布时间必须晚于当前时间。");
      return false;
    }
    if (expiresAt && Date.parse(expiresAt + ":00+08:00") <= start) {
      setValidation("结束时间必须晚于发布时间。");
      return false;
    }
    if (notifyUsers && body.length > 500) {
      setValidation("额外 Apple 通知的内容最多 500 个字符。");
      return false;
    }
    if (notifyUsers && platform === "android") {
      setValidation("Apple 通知不适用于仅 Android 公告。");
      return false;
    }
    setValidation("");
    return true;
  };
  const persist = async (publish: boolean) => {
    if (!valid()) return;
    const m = value(),
      sig = signature(),
      operation = JSON.stringify([sig, notifyUsers, audience]);
    if (submission.current.signature !== operation)
      submission.current = { signature: operation, key: crypto.randomUUID() };
    await save(
      m,
      publish,
      submission.current.key,
      createKey.current,
      notifyUsers,
      audience,
      (saved) => {
        draft.current = {
          id: saved.id,
          revision: saved.revision,
          signature: sig,
        };
      },
      publish && draft.current.signature === sig,
    );
  };
  const requestClose = () => {
    if (busy) return;
    if (
      title !== (initial?.title || "") ||
      body !== (initial?.body || "") ||
      platform !== (initial?.platform || "all") ||
      publishAt !== chinaInput(initial?.publishAt || null) ||
      expiresAt !== chinaInput(initial?.expiresAt || null) ||
      notifyUsers
    )
      setDiscard(true);
    else close();
  };
  if (discard)
    return (
      <Modal
        title="放弃未保存的修改？"
        onClose={() => setDiscard(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscard(false)}>
              继续编辑
            </Button>
            <Button variant="danger" onClick={close}>
              放弃修改
            </Button>
          </>
        }
      >
        <p className="confirm-text">关闭后，本次未保存的公告内容会丢失。</p>
      </Modal>
    );
  return (
    <Modal
      title={step === 1 ? (initial ? "编辑公告" : "新建公告") : "确认发布公告"}
      onClose={requestClose}
      wide
      footer={
        <>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => (step === 2 ? setStep(1) : void persist(false))}
          >
            {step === 2 ? <ArrowLeft size={15} /> : <FileText size={15} />}{" "}
            {step === 2 ? "返回编辑" : "保存草稿"}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              if (!valid()) return;
              step === 1 ? setStep(2) : void persist(true);
            }}
          >
            {busy ? (
              <Busy />
            ) : step === 1 ? (
              <Eye size={16} />
            ) : (
              <Megaphone size={16} />
            )}{" "}
            {step === 1 ? "检查发布预览" : "发布公告"}
          </Button>
        </>
      }
    >
      <div className="composer-grid">
        <div className="form-stack">
          {step === 1 ? (
            <>
              <Field label="公告标题">
                <input
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：新版本更新说明"
                  autoFocus
                />
              </Field>
              <Field label="公告内容">
                <textarea
                  value={body}
                  maxLength={4000}
                  rows={6}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="填写用户需要了解的内容。"
                />
                <small className="char-count">{body.length} / 4000</small>
              </Field>
              <Field label="适用平台">
                <select
                  value={platform}
                  onChange={(e) => {
                    setPlatform(e.target.value as Announcement["platform"]);
                    if (e.target.value === "android") setNotifyUsers(false);
                  }}
                >
                  <option value="all">全部平台</option>
                  <option value="ios">Apple</option>
                  <option value="android">Android</option>
                </select>
              </Field>
              <div className="two-fields">
                <Field label="发布时间（北京时间）" hint="留空立即发布">
                  <input
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                  />
                </Field>
                <Field label="结束时间（北京时间）" hint="留空持续生效">
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </Field>
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={notifyUsers}
                  disabled={platform === "android" || (!preview && !pushReady)}
                  onChange={(e) => setNotifyUsers(e.target.checked)}
                />
                <span>
                  同时发送 Apple 通知
                  <small>
                    {!preview && !pushReady
                      ? "普通通知通道尚未接入"
                      : "默认只发布 App 公告"}
                  </small>
                </span>
              </label>
              {notifyUsers && (
                <Field label="额外通知对象">
                  <select
                    value={audience}
                    onChange={(e) =>
                      setAudience(e.target.value as "all" | "test")
                    }
                  >
                    <option value="test">测试设备</option>
                    <option value="all">全部适用 Apple 设备</option>
                  </select>
                </Field>
              )}
            </>
          ) : (
            <>
              <div className="confirmation-summary">
                <CheckCircle2 size={25} />
                <h3>检查发布内容</h3>
              </div>
              <dl className="review-list">
                <div>
                  <dt>平台</dt>
                  <dd>{platformName(platform)}</dd>
                </div>
                <div>
                  <dt>发布</dt>
                  <dd>{publishAt ? publishAt.replace("T", " ") : "立即"}</dd>
                </div>
                <div>
                  <dt>结束</dt>
                  <dd>
                    {expiresAt ? expiresAt.replace("T", " ") : "持续生效"}
                  </dd>
                </div>
                <div>
                  <dt>额外推送</dt>
                  <dd>
                    {notifyUsers
                      ? audience === "test"
                        ? "Apple 测试设备"
                        : "全部适用 Apple 设备"
                      : "不发送推送"}
                  </dd>
                </div>
              </dl>
              {preview && (
                <div className="info-note">
                  <Eye size={17} />
                  <span>当前发布仅影响示例记录。</span>
                </div>
              )}
            </>
          )}
          {(validation || error) && (
            <p role="alert" className="field-error">
              {validation || error}
            </p>
          )}
        </div>
        <div className="composer-preview">
          <span className="preview-label">
            <Smartphone size={15} />
            App 显示预览
          </span>
          <AnnouncementPreview title={title} body={body} />
        </div>
      </div>
    </Modal>
  );
}
