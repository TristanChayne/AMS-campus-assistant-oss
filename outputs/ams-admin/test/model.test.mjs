import assert from 'node:assert/strict';
import test from 'node:test';
import { chinaInput, codeState, makeDemo, emptyData, isActiveAnnouncement } from '../src/model.ts';

test('编辑定时消息保持北京时间，跨日与有偏移时间一致', () => {
  assert.equal(chinaInput('2026-10-13T17:45:00Z'), '2026-10-14T01:45');
  assert.equal(chinaInput('2026-10-14T01:45:00+08:00'), '2026-10-14T01:45');
  assert.equal(chinaInput(null), '');
  assert.equal(chinaInput('invalid'), '');
});

test('停用优先于用尽；额度状态保持现有激活语义', () => {
  const code = makeDemo().codes[0];
  assert.equal(codeState({ ...code, enabled: 0, remaining: 0 }), 'disabled');
  assert.equal(codeState({ ...code, enabled: 1, remaining: 0 }), 'used');
  assert.equal(codeState({ ...code, enabled: 1, remaining: 2 }), 'available');
});

test('预览账户均为虚构，上传模型含账户名且不包含密码或会话', () => {
  const data = makeDemo();
  for (const device of data.devices) {
    if (device.accountName !== null) assert.match(device.accountName, /^demo\.student\d{2}$/);
    assert.equal(device.courseCount, device.courses.length);
    assert.equal(Object.keys(device).some(k => /password|cookie|session|token$/i.test(k)), false);
  }
  assert.ok(data.codes.every(c => c.code.startsWith('DEMO-PREVIEW-')));
  assert.equal(data.apns.capabilities.notification, false);
  assert.deepEqual(emptyData.devices, []);
  assert.equal(emptyData.apns, null);
});

test('生效公告尊重发布状态、开始及结束时间', () => {
  const a = makeDemo().announcements[0];
  const now = Date.parse('2026-10-13T08:00:00Z');
  assert.equal(isActiveAnnouncement({ ...a, publishAt: null, expiresAt: null }, now), true);
  assert.equal(isActiveAnnouncement({ ...a, status: 'draft', publishAt: null }, now), false);
  assert.equal(isActiveAnnouncement({ ...a, status: 'scheduled', publishAt: null }, now), false);
  assert.equal(isActiveAnnouncement({ ...a, publishAt: '2026-10-13T08:00:01Z' }, now), false);
  assert.equal(isActiveAnnouncement({ ...a, publishAt: null, expiresAt: '2026-10-13T08:00:00Z' }, now), false);
});

test('共享激活码的两个设备仍有独立编号', () => {
  const devices = makeDemo().devices;
  assert.equal(devices[0].activation.codeId, devices[1].activation.codeId);
  assert.notEqual(devices[0].id, devices[1].id);
  assert.equal(devices.find(d => d.platform === 'android').apnsEnv, null);
});
