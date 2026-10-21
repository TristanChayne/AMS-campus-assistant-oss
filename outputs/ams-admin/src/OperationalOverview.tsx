import {useEffect, useState} from 'react';
import {ArrowUpRight, ChevronRight, Clock3, FileText, Link2, Plus, Radio, ShieldCheck, Smartphone, Users, UserX} from 'lucide-react';
import {Badge, Button, Empty, Panel} from './components';
import {activationStatus, chinaDay, formatDate, isActiveAnnouncement} from './model';
import type {Announcement, Data, Device, Page, ServiceState} from './model';
import './operational.css';

type Props = {
 data: Data;
 preview: boolean;
 go: (page: Page) => void;
 openDevice: (device: Device) => void;
 openAnnouncement: (announcement: Announcement) => void;
 createAnnouncement: () => void;
};

const serviceLabels: Record<ServiceState['status'], string> = {
 ready: '正常', not_configured: '待配置', unavailable: '暂不可用', not_connected: '待接入',
};
const platformLabels = {all: '全部平台', ios: 'iPhone', android: 'Android'};
const pushLabels = {queued: '排队中', accepted_by_apns: 'Apple 已接收', failed: '提交失败', expired: '已过期'};

function timestamp(value: string | null) {
 const result = value ? Date.parse(value) : NaN;
 return Number.isFinite(result) ? result : -Infinity;
}

function deviceTone(device: Device) {
 return device.activation.state === 'active' ? 'green' : device.activation.state === 'disabled' ? 'amber' : 'neutral';
}

export default function OperationalOverview({data, preview, go, openDevice, openAnnouncement, createAnnouncement}: Props) {
 const [now, setNow] = useState(Date.now);
 useEffect(() => {
  const update = () => setNow(Date.now());
  const timer = window.setInterval(update, 60000);
  const resume = () => { if (document.visibilityState === 'visible') update(); };
  document.addEventListener('visibilitychange', resume);
  return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', resume); };
 }, []);

 const todayStart = Date.parse(`${chinaDay()}T00:00:00+08:00`);
 const counts = preview ? {
  active: data.devices.filter(d => d.activation.state === 'active' && d.activation.codeEnabled === true && d.activation.deviceEnabled).length,
  disabled: data.devices.filter(d => d.activation.state === 'disabled' || d.activation.codeEnabled === false || !d.activation.deviceEnabled).length,
  pending: data.devices.filter(d => d.activation.state === 'legacy_pending').length,
  connected: data.devices.filter(d => d.lastSeenAt !== null && timestamp(d.lastSeenAt) >= todayStart && timestamp(d.lastSeenAt) < todayStart + 86400000).length,
 } : {
  active: data.overview?.activeDeviceCount,
  disabled: data.overview?.disabledDeviceCount,
  pending: data.overview?.legacyDeviceCount,
  connected: data.overview?.connectedTodayCount,
 };
 const metrics = [
  {label: '已授权设备', value: counts.active, icon: ShieldCheck, tone: 'green'},
  {label: '已停用设备', value: counts.disabled, icon: UserX, tone: 'amber'},
  {label: '待关联设备', value: counts.pending, icon: Link2, tone: 'neutral'},
  {label: '今日连接设备', value: counts.connected, icon: Clock3, tone: 'blue'},
 ];
 const recentDevices = [...data.devices].sort((a, b) => timestamp(b.lastSeenAt) - timestamp(a.lastSeenAt)).slice(0, 6);
 const announcements = data.announcements.filter(a => isActiveAnnouncement(a, now))
  .sort((a, b) => timestamp(b.publishAt || b.createdAt) - timestamp(a.publishAt || a.createdAt)).slice(0, 3);
 const services = [
  {key: 'activation' as const, label: '激活验证'},
  {key: 'notify' as const, label: '课程提醒'},
  {key: 'apns' as const, label: 'Apple 推送'},
 ];
 const latestPush = [...(data.apns?.records || [])].sort((a, b) => timestamp(b.at) - timestamp(a.at))[0];
 const channelState = (supported: boolean | undefined) => supported ? data.apns?.configured ? '已配置' : '等待密钥' : '待接入';

 return <div className="operational-overview">
  <section className="op-summary" aria-labelledby="op-summary-title">
   <div className="op-summary-heading"><h2 id="op-summary-title">设备概况</h2><button type="button" className="op-text-link" onClick={() => go('devices')}>查看设备<ArrowUpRight size={15}/></button></div>
   <dl className="op-metrics">{metrics.map(metric => <div key={metric.label} className="op-metric"><dt><span className={`op-metric-icon ${metric.tone}`}><metric.icon size={16}/></span>{metric.label}</dt><dd>{metric.value ?? '—'}</dd></div>)}</dl>
   <p className="op-stat-scope">{preview ? `统计范围：当前 ${data.devices.length} 台演示设备 · 今日按北京时间计算` : data.overview ? `统计范围：服务端汇总 · 截至 ${formatDate(data.overview.asOf)}（北京时间）` : '统计范围：待后端提供 · 今日按北京时间计算'}</p>
  </section>

  <div className="op-layout">
   <div className="op-main">
    <Panel className="op-devices">
     <div className="op-panel-heading"><div><h2>最近通讯设备</h2><p>按最近一次服务器通讯排序</p></div><button type="button" className="op-text-link" onClick={() => go('devices')}>查看全部<ArrowUpRight size={15}/></button></div>
     {recentDevices.length ? <><div className="op-device-columns" aria-hidden="true"><span>当前学校账户 / 设备编号</span><span>平台</span><span>授权状态</span><span>最近通讯</span><span/></div><ul className="op-device-list" aria-label="最近与服务器通讯的设备">{recentDevices.map(device => <li key={device.id}><button type="button" className="op-device-row" onClick={() => openDevice(device)} aria-label={`查看 ${device.accountName || '未登录学校账户'} 的设备详情，编号 ${device.id}，${device.platform === 'ios' ? 'Apple' : device.platform === 'android' ? 'Android' : '待识别'}，${activationStatus[device.activation.state]}，${device.lastSeenAt ? `最近通讯 ${formatDate(device.lastSeenAt)}（北京时间）` : '尚未通讯'}`}>
      <span className="op-device-identity"><span className="op-device-avatar"><Smartphone size={18}/></span><span><strong title={device.accountName || undefined}>{device.accountName || '未登录学校账户'}</strong><small title={device.id}>编号 {device.id}</small></span></span>
      <span className="op-device-platform">{device.platform === 'ios' ? 'Apple' : device.platform === 'android' ? 'Android' : '待识别'}</span>
      <span className="op-device-state"><Badge tone={deviceTone(device)}>{activationStatus[device.activation.state]}</Badge></span>
      <span className={`op-device-time${device.lastSeenAt ? '' : ' unseen'}`}>{device.lastSeenAt ? <time dateTime={device.lastSeenAt}>{formatDate(device.lastSeenAt)}</time> : '尚未通讯'}</span>
      <ChevronRight className="op-device-chevron" size={16}/>
     </button></li>)}</ul></> : <Empty title="暂无设备通讯记录" text="设备完成服务器登记后，会显示在这里。" action={<Button variant="secondary" onClick={() => go('devices')}><Users size={16}/>查看设备管理</Button>}/>}
    </Panel>

    <Panel className="op-announcements">
     <div className="op-panel-heading"><div><h2>生效公告</h2><p>已发布且处于有效期内的应用公告</p></div><button type="button" className="op-text-link" onClick={() => go('announcements')}>管理公告<ArrowUpRight size={15}/></button></div>
     {announcements.length ? <ul className="op-announcement-list">{announcements.map(announcement => <li key={announcement.id}><button type="button" className="op-announcement-row" onClick={() => openAnnouncement(announcement)}>
      <span className="op-announcement-icon"><FileText size={19}/></span><span className="op-announcement-content"><span className="op-announcement-title"><strong>{announcement.title}</strong><Badge tone="blue">{platformLabels[announcement.platform]}</Badge></span><span className="op-announcement-body">{announcement.body}</span><span className="op-announcement-date">{announcement.publishAt ? <><span>发布于 </span><time dateTime={announcement.publishAt}>{formatDate(announcement.publishAt)}</time></> : '发布时间未提供'}</span></span><ChevronRight size={16} className="op-announcement-chevron"/>
     </button></li>)}</ul> : <Empty title="暂无生效公告" text="发布公告后，将在生效时间到达时显示。" action={<Button variant="secondary" onClick={createAnnouncement}><Plus size={16}/>新建公告</Button>}/>}
    </Panel>
   </div>

   <aside className="op-rail" aria-label="服务与推送状态">
    <Panel className="op-services"><div className="op-rail-heading"><h2>服务状态</h2><span className="op-subtle-icon"><ShieldCheck size={17}/></span></div><ul className="op-service-list">{services.map(service => {
     const state = data.overview?.services?.[service.key];
     return <li key={service.key}><div><strong>{service.label}</strong>{state?.message && <p>{state.message}</p>}{state?.checkedAt && <time dateTime={state.checkedAt}>{formatDate(state.checkedAt)}</time>}</div><Badge tone={state?.status === 'ready' ? 'green' : state?.status === 'not_configured' || state?.status === 'unavailable' ? 'amber' : 'neutral'}>{state ? serviceLabels[state.status] : '待接入'}</Badge></li>;
    })}</ul></Panel>

    <Panel className="op-apns"><div className="op-rail-heading"><h2>Apple 推送</h2><span className="op-subtle-icon"><Radio size={17}/></span></div><div className="op-apns-key"><span>推送密钥</span><Badge tone={data.apns?.configured ? 'green' : data.apns ? 'amber' : 'neutral'}>{data.apns?.configured ? '已配置' : data.apns ? '待配置' : '待接入'}</Badge></div><dl className="op-apns-details"><div><dt>课程实时活动</dt><dd>{channelState(data.apns?.capabilities.liveactivity)}</dd></div><div><dt>普通通知</dt><dd>{channelState(data.apns?.capabilities.notification)}</dd></div><div><dt>环境</dt><dd>{data.apns?.environment || '待接入'}</dd></div><div><dt>最近提交结果</dt><dd>{latestPush ? pushLabels[latestPush.status] : '暂无记录'}</dd></div></dl>{latestPush && <p className="op-push-time"><Clock3 size={13}/><time dateTime={latestPush.at}>{formatDate(latestPush.at)}（北京时间）</time></p>}<button type="button" className="op-rail-action" onClick={() => go('apns')}>查看推送记录<ArrowUpRight size={15}/></button></Panel>
   </aside>
  </div>
 </div>;
}
