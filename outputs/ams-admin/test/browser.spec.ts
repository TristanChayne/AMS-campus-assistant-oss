import {test as base, expect, type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sections = [
  ['overview', '工作台'], ['activations', '激活管理'], ['devices', '设备与账户'],
  ['announcements', '应用公告'], ['messages', '消息推送'], ['apns', 'Apple 推送'], ['settings', '系统设置'],
] as const;

const test = base.extend<{apiRequests: string[]; allowBusinessApi: boolean; pageErrors: string[]}>({
  allowBusinessApi: [false, {option: true}],
  apiRequests: [async ({page, allowBusinessApi}, use) => {
    const requests: string[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/')) requests.push(`${request.method()} ${path}`);
    });
    // Every business request is intercepted locally, including all mutations.
    await page.route('**/api/**', route => route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: {message: '管理服务尚未接入，请稍后重试。'}})}));
    await use(requests);
    if (!allowBusinessApi) expect(requests, '演示操作不得访问任何业务 API').toEqual([]);
  }, {auto: true}],
  pageErrors: [async ({page}, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(errors);
    expect(errors, '页面不应产生未处理的 JavaScript 错误').toEqual([]);
  }, {auto: true}],
});

async function waitSettled(page: Page) {
  await expect.poll(() => page.evaluate(() => Array.from(document.querySelectorAll('#main-content > div[style], dialog > div[style]')).every(el => getComputedStyle(el).opacity === '1')), {message: '等待界面淡入完成'}).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), {message: '等待主题与导航过渡完成'}).toBe(0);
}
async function go(page: Page, name: string) {
  const id = sections.find(section => section[1] === name)![0];
  const menu = page.getByRole('button', {name: '打开导航', exact: true});
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', {name: '主导航'}).getByRole('button', {name: new RegExp(`^${name}`)}).click();
  await expect(page.getByRole('heading', {level: 1, name, exact: true})).toBeVisible();
  await expect(page.locator(`[data-page="${id}"]`)).toBeVisible();
  await waitSettled(page);
}
async function assertNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - document.documentElement.clientWidth), {message: '页面应适合视口；表格可在自身容器内滚动'}).toBeLessThanOrEqual(1);
}
async function assertAccessible(page: Page) {
  await waitSettled(page);
  const results = await new AxeBuilder({page}).analyze();
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map(v => ({id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({target: n.target, summary: n.failureSummary}))})), 'axe 不应发现严重或致命问题').toEqual([]);
}
const rowForDevice = (page: Page, id: string) => page.locator('tbody tr').filter({hasText: id});
const recordWithHeading = (page: Page, title: string) => page.getByRole('button').filter({has: page.getByRole('heading', {name: title, exact: true})});
async function openDevice(page: Page, id: string) {
  await rowForDevice(page, id).getByRole('button').first().click();
  const detail = page.getByRole('dialog');
  await expect(detail).toBeVisible();
  return detail;
}
async function newRecord(page: Page, kind: 'message' | 'announcement') {
  await page.locator('.heading-actions').getByRole('button', {name: kind === 'message' ? /^(新建消息|新建推送)$/ : /^(新建公告|写公告)$/}).click();
  const composer = page.getByRole('dialog');
  await expect(composer).toBeVisible();
  return composer;
}

test.beforeEach(async ({page}) => {
  await page.goto('./?preview=1');
  await expect(page.getByRole('heading', {level: 1, name: '工作台', exact: true})).toBeVisible();
});

test('七模块导航与浏览器返回保持一致，桌面和手机无页面横向溢出', async ({page}) => {
  for (const [id, name] of sections) {await go(page, name); await expect(page).toHaveURL(new RegExp(`#${id}$`)); await assertNoPageOverflow(page);}
  await page.goBack();
  await expect(page.getByRole('heading', {level: 1, name: 'Apple 推送', exact: true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {level: 1, name: 'Apple 推送', exact: true})).toBeVisible();
});

test('工作台聚焦设备授权与生效公告，不展示个人课程或反复隐私说明', async ({page}) => {
  const home = page.locator('[data-page="overview"]');
  await expect(home).toContainText('设备');
  await expect(home).toContainText('公告');
  await expect(home).toContainText('AMS 校园助手使用说明');
  for (const text of ['软件工程', 'CSE208', '不上传用户密码', '让提醒跟上每一节课']) await expect(home).not.toContainText(text);
  await assertNoPageOverflow(page);
});

test('应用发布只有一个入口，两条外链支持悬停、触摸与键盘 Escape', async ({page}, testInfo) => {
  const opener = page.getByRole('button', {name: '应用发布', exact: true});
  await expect(opener).toHaveCount(1);
  const menu = page.getByRole('menu', {name: /^应用发布/});
  if (testInfo.project.name === 'desktop') await opener.hover(); else await opener.tap();
  await expect(menu).toBeVisible();
  const links = menu.getByRole('menuitem');
  await expect(links).toHaveCount(2);
  for (const link of await links.all()) {await expect(link).toHaveAttribute('href', /^https:\/\//); expect(await link.evaluate(el => el.tagName)).toBe('A');}
  await opener.focus();
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.press('Enter');
  await expect(menu).toBeVisible();
  await links.first().focus();
  await page.keyboard.press('Tab');
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('激活搜索重置分页，额度修改与示例生成仅改变演示记录', async ({page}) => {
  await go(page, '激活管理');
  await expect(page.locator('tbody tr')).toHaveCount(8);
  await page.getByRole('button', {name: '下一页', exact: true}).click();
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('textbox', {name: '搜索记录', exact: true}).fill('个人测试设备');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(page.getByRole('button', {name: '上一页', exact: true})).toBeDisabled();
  await page.getByRole('button', {name: '查看个人测试设备详情', exact: true}).click();
  const detail = page.getByRole('dialog');
  await detail.getByRole('spinbutton', {name: '激活次数'}).fill('7');
  await detail.getByRole('button', {name: '保存额度', exact: true}).click();
  await expect(detail).toContainText('2 / 7');
  await page.keyboard.press('Escape');
  await page.getByRole('button', {name: '清除搜索', exact: true}).click();
  await page.locator('.heading-actions').getByRole('button', {name: '生成激活码', exact: true}).click();
  const create = page.getByRole('dialog');
  await create.getByRole('textbox', {name: '用途备注', exact: true}).fill('浏览器验证示例');
  await create.getByRole('spinbutton', {name: '激活次数'}).fill('3');
  await create.getByRole('combobox', {name: '授权类型', exact: true}).selectOption('demo');
  await create.getByRole('button', {name: '生成激活码', exact: true}).click();
  const row = page.locator('tbody tr').filter({hasText: '浏览器验证示例'});
  for (const text of ['DEMO-PREVIEW-', '审核演示', '0 / 3']) await expect(row).toContainText(text);
  await page.reload();
  await expect(page.locator('tbody tr').filter({hasText: '浏览器验证示例'})).toHaveCount(0);
});

test('同激活码两台设备独立停用，码与另一台授权保持不变', async ({page}) => {
  await go(page, '设备与账户');
  for (const id of ['DEMO-INSTALL-0001', 'DEMO-INSTALL-0002']) await expect(rowForDevice(page, id)).toContainText('已激活');
  let detail = await openDevice(page, 'DEMO-INSTALL-0001');
  await expect(detail).toContainText('demo-code-1');
  await detail.getByRole('button', {name: /^(停用此设备|停用设备)$/}).click();
  await expect(page.getByRole('dialog')).toContainText('DEMO-INSTALL-0001');
  await page.getByRole('dialog').getByRole('button', {name: /^(停用此设备|停用设备|确认停用)$/}).click();
  await expect(rowForDevice(page, 'DEMO-INSTALL-0001')).toContainText('已停用');
  await expect(rowForDevice(page, 'DEMO-INSTALL-0002')).toContainText('已激活');
  await go(page, '激活管理');
  const code = page.locator('tbody tr').filter({hasText: 'DEMO-PREVIEW-0001'});
  await expect(code).toContainText('可用');
  await expect(code).toContainText('2 / 5');
  await go(page, '设备与账户');
  detail = await openDevice(page, 'DEMO-INSTALL-0001');
  await detail.getByRole('button', {name: /^(启用此设备|启用设备)$/}).click();
  await page.getByRole('dialog').getByRole('button', {name: /^(启用此设备|启用设备|确认启用)$/}).click();
  for (const id of ['DEMO-INSTALL-0001', 'DEMO-INSTALL-0002']) await expect(rowForDevice(page, id)).toContainText('已激活');
});

test('整码停用同步关联设备，恢复激活码不解除单设备停用', async ({page}) => {
  await go(page, '设备与账户');
  await openDevice(page, 'DEMO-INSTALL-0001');
  await page.getByRole('dialog').getByRole('button', {name: '停用此设备', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: '停用此设备', exact: true}).click();
  await go(page, '激活管理');
  await page.getByRole('button', {name: '查看个人测试设备详情', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: '停用激活码', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: '停用激活码', exact: true}).click();
  await go(page, '设备与账户');
  for (const id of ['DEMO-INSTALL-0001', 'DEMO-INSTALL-0002']) await expect(rowForDevice(page, id)).toContainText('已停用');
  await go(page, '激活管理');
  await page.getByRole('button', {name: '查看个人测试设备详情', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: '启用激活码', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: '启用激活码', exact: true}).click();
  await go(page, '设备与账户');
  await expect(rowForDevice(page, 'DEMO-INSTALL-0001')).toContainText('已停用');
  await expect(rowForDevice(page, 'DEMO-INSTALL-0002')).toContainText('已激活');
});

test('账户名与安装编号均可搜索，待关联记录不冒充硬件身份', async ({page}, testInfo) => {
  await go(page, '设备与账户');
  const search = page.getByRole('textbox', {name: '搜索记录', exact: true});
  await search.fill('demo.student02');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('DEMO-INSTALL-0002');
  await search.fill('DEMO-INSTALL-0001');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('demo.student01');
  await search.fill('DEMO-INSTALL-0008');
  const legacy = rowForDevice(page, 'DEMO-INSTALL-0008');
  for (const text of ['待关联', '待识别', '版本未知', '尚未通讯']) await expect(legacy).toContainText(text);
  await expect(legacy).not.toContainText('Android');
  if (testInfo.project.name === 'mobile-390') {
    const hitArea = await legacy.getByRole('button').first().boundingBox();
    expect(hitArea?.height, '手机账户入口应至少 44 像素高').toBeGreaterThanOrEqual(44);
  }
  const detail = await openDevice(page, 'DEMO-INSTALL-0008');
  await expect(detail).toContainText('设备型号待识别');
  await expect(detail).toContainText('未知版本');
  await expect(detail).not.toContainText('Android');
  await page.keyboard.press('Escape');
  await search.fill('不存在的安装');
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('设备详情按需展开云端课表，Android 无云端课表时不伪造数据', async ({page}) => {
  await go(page, '设备与账户');
  let detail = await openDevice(page, 'DEMO-INSTALL-0001');
  await expect(detail).toContainText('demo.student01');
  await expect(detail.locator('input[type=password]')).toHaveCount(0);
  await expect(detail.getByText('软件工程', {exact: true})).not.toBeVisible();
  await detail.getByRole('button', {name: /^(查看云端课表|展开云端课表)$/}).click();
  for (const text of ['软件工程', 'CSE208', 'SA169']) await expect(detail).toContainText(text);
  await detail.getByLabel('选择课程日期').fill('2099-01-01');
  await expect(detail).toContainText('这一天没有云端课程');
  await assertNoPageOverflow(page);
  await page.keyboard.press('Escape');
  detail = await openDevice(page, 'DEMO-INSTALL-0007');
  await expect(detail).toContainText('Android');
  await expect(detail).not.toContainText('软件工程');
  await detail.getByRole('button', {name: '查看云端课表', exact: true}).click();
  await expect(detail).toContainText('这一天没有云端课程');
});

test('公告独立保存草稿、发布二次确认、首页更新且下架需确认', async ({page}) => {
  await go(page, '应用公告');
  let composer = await newRecord(page, 'announcement');
  await composer.getByRole('button', {name: '保存草稿', exact: true}).click();
  await expect(composer.getByRole('alert')).toContainText(/请填写.*标题和内容/);
  await composer.getByRole('textbox', {name: '公告标题', exact: true}).fill('浏览器验证生效公告');
  await composer.getByRole('textbox', {name: /^公告内容/}).fill('这是隔离的演示公告，发布与下架只影响当前页面。');
  await composer.getByRole('button', {name: '保存草稿', exact: true}).click();
  await expect(recordWithHeading(page, '浏览器验证生效公告')).toContainText('草稿');
  await go(page, '工作台');
  await expect(page.locator('[data-page="overview"]')).not.toContainText('浏览器验证生效公告');
  await go(page, '应用公告');
  await recordWithHeading(page, '浏览器验证生效公告').click();
  await page.getByRole('dialog').getByRole('button', {name: /^(编辑公告|编辑与预览)$/}).click();
  composer = page.getByRole('dialog');
  await composer.getByRole('button', {name: /^(检查发布预览|预览并发布|检查发布内容)$/}).click();
  await expect(page.getByRole('dialog')).toContainText('浏览器验证生效公告');
  await page.getByRole('dialog').getByRole('button', {name: '发布公告', exact: true}).click();
  await expect(recordWithHeading(page, '浏览器验证生效公告')).toContainText(/生效中|已发布/);
  await go(page, '工作台');
  await expect(page.locator('[data-page="overview"]')).toContainText('浏览器验证生效公告');
  await go(page, '应用公告');
  await recordWithHeading(page, '浏览器验证生效公告').click();
  await page.getByRole('dialog').getByRole('button', {name: '下架公告', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: '取消', exact: true}).click();
  await expect(recordWithHeading(page, '浏览器验证生效公告')).toContainText(/生效中|已发布/);
  await recordWithHeading(page, '浏览器验证生效公告').click();
  await page.getByRole('dialog').getByRole('button', {name: '下架公告', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: /^(下架公告|确认下架)$/}).click();
  await expect(recordWithHeading(page, '浏览器验证生效公告')).toContainText('已下架');
  await go(page, '工作台');
  await expect(page.locator('[data-page="overview"]')).not.toContainText('浏览器验证生效公告');
});

test('消息推送专用于普通通知，必填、手机预览与计划确认完整可用', async ({page}) => {
  await go(page, '消息推送');
  let composer = await newRecord(page, 'message');
  await expect(composer.getByRole('button', {name: '应用公告', exact: true})).toHaveCount(0);
  await composer.getByRole('button', {name: '保存草稿', exact: true}).click();
  await expect(composer.getByRole('alert')).toContainText('请填写消息标题和内容');
  await composer.getByRole('textbox', {name: '消息标题', exact: true}).fill('浏览器验证通知');
  await composer.getByRole('textbox', {name: /^消息内容/}).fill('这条普通通知仅保存在当前演示页面。');
  await expect(composer.locator('.phone-notification')).toContainText('浏览器验证通知');
  await assertNoPageOverflow(page);
  await composer.getByRole('button', {name: '保存草稿', exact: true}).click();
  await expect(recordWithHeading(page, '浏览器验证通知')).toContainText('草稿');
  await recordWithHeading(page, '浏览器验证通知').click();
  await page.getByRole('dialog').getByRole('button', {name: '编辑与预览', exact: true}).click();
  composer = page.getByRole('dialog');
  await composer.getByLabel('发送时间（北京时间）').fill('2099-01-01T09:00');
  await composer.getByRole('button', {name: '检查发送预览', exact: true}).click();
  const confirmation = page.getByRole('dialog');
  for (const text of ['测试设备', '2099-01-01 09:00', '当前计划只保存为演示记录']) await expect(confirmation).toContainText(text);
  await confirmation.getByRole('button', {name: '返回编辑', exact: true}).click();
  await expect(page.getByRole('dialog').getByRole('textbox', {name: '消息标题', exact: true})).toHaveValue('浏览器验证通知');
  await page.getByRole('dialog').getByRole('button', {name: '检查发送预览', exact: true}).click();
  await page.getByRole('dialog').getByRole('button', {name: '演示加入发送计划', exact: true}).click();
  await expect(recordWithHeading(page, '浏览器验证通知')).toContainText('计划发送');
  await expect(recordWithHeading(page, '浏览器验证通知')).toContainText(/Apple 通知|普通通知/);
});

test('过去的发送时间被拒绝，表单与手机预览保持内容', async ({page}) => {
  await go(page, '消息推送');
  const composer = await newRecord(page, 'message');
  await composer.getByRole('textbox', {name: '消息标题', exact: true}).fill('过去时间检查');
  await composer.getByRole('textbox', {name: /^消息内容/}).fill('不能以过去的时间进入发送计划。');
  await composer.getByLabel('发送时间（北京时间）').fill('2000-01-01T09:00');
  await composer.getByRole('button', {name: '检查发送预览', exact: true}).click();
  await expect(composer.getByRole('alert')).toContainText('计划发送时间必须晚于当前时间');
  await expect(composer.getByRole('textbox', {name: '消息标题', exact: true})).toHaveValue('过去时间检查');
  await expect(composer.locator('.phone-notification')).toContainText('过去时间检查');
});

test('Android消息通过App内获取，平台选择/草稿/提交/详情保持一致', async ({page}) => {
  await go(page, '消息推送');
  let composer = await newRecord(page, 'message');
  await composer.getByLabel('接收平台').selectOption('android');
  await composer.getByRole('textbox', {name: '消息标题', exact: true}).fill('Android 打开后获取检查');
  await composer.getByRole('textbox', {name: /^消息内容/}).fill('这是隔离演示消息，不会访问服务器或真实用户。');
  await expect(composer.locator('.app-announcement-preview')).toContainText('应用内消息');
  await expect(composer.locator('.phone-notification')).toHaveCount(0);
  await expect(composer).toContainText('App 未打开时不会弹出远程通知');
  await assertAccessible(page); await assertNoPageOverflow(page);
  await composer.getByRole('button', {name: '保存草稿', exact: true}).click();
  let record = recordWithHeading(page, 'Android 打开后获取检查');
  await expect(record).toContainText('Android · 打开后获取'); await record.click();
  await page.getByRole('dialog').getByRole('button', {name: '编辑与预览', exact: true}).click();
  composer = page.getByRole('dialog');
  await expect(composer.getByLabel('接收平台')).toHaveValue('android');
  await composer.getByLabel('发送对象').selectOption('all');
  await composer.getByRole('button', {name: '检查发送预览', exact: true}).click();
  await expect(composer).toContainText('全部适用 Android 设备');
  await expect(composer).toContainText('Android App 内消息 · 打开后获取');
  await composer.getByRole('button', {name: '演示加入发送计划', exact: true}).click();
  record = recordWithHeading(page, 'Android 打开后获取检查');
  await expect(record).toContainText('已发布到 App'); await record.click();
  await expect(page.getByRole('dialog')).toContainText('没有后台远程推送');
  await assertAccessible(page); await assertNoPageOverflow(page);
});

test('Escape 归还焦点，快速导航与手机侧栏可用键盘关闭', async ({page}, testInfo) => {
  await go(page, '激活管理');
  const opener = page.locator('.heading-actions').getByRole('button', {name: '生成激活码', exact: true});
  await opener.focus(); await opener.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog').getByRole('button', {name: /^设备与账户/}).click();
  await expect(page.getByRole('heading', {level: 1, name: '设备与账户', exact: true})).toBeVisible();
  if (testInfo.project.name === 'mobile-390') {
    const toggle = page.getByRole('button', {name: '打开导航', exact: true});
    await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    expect(await page.locator('.sidebar').evaluate(el => (el as HTMLElement).inert)).toBe(true);
    await toggle.click();
    await page.getByRole('button', {name: '关闭导航', exact: true}).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  }
});

for (const kind of ['message', 'announcement'] as const) {
  test(`${kind === 'message' ? '通知' : '公告'}未保存编辑不会被 Ctrl 或 Command K 替换，关闭先确认放弃`, async ({page}) => {
    await go(page, kind === 'message' ? '消息推送' : '应用公告');
    let composer = await newRecord(page, kind);
    const titleLabel = kind === 'message' ? '消息标题' : '公告标题';
    const bodyLabel = kind === 'message' ? /^消息内容/ : /^公告内容/;
    await composer.getByRole('textbox', {name: titleLabel, exact: true}).fill('未保存的隔离编辑');
    await composer.getByRole('textbox', {name: bodyLabel}).fill('快捷键不应丢失这段正文。');
    for (const key of ['Control+k', 'Meta+k']) {
      await page.keyboard.press(key);
      await expect(composer.getByRole('textbox', {name: titleLabel, exact: true})).toHaveValue('未保存的隔离编辑');
      await expect(composer.getByRole('textbox', {name: bodyLabel})).toHaveValue('快捷键不应丢失这段正文。');
      await expect(page.getByRole('dialog')).toHaveCount(1);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toContainText('放弃未保存的修改');
    await page.getByRole('dialog').getByRole('button', {name: '继续编辑', exact: true}).click();
    composer = page.getByRole('dialog');
    await expect(composer.getByRole('textbox', {name: titleLabel, exact: true})).toHaveValue('未保存的隔离编辑');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').getByRole('button', {name: '放弃修改', exact: true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('深色持久化且减少动画偏好下对话框不位移或缩放', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'}); await page.reload();
  await page.getByRole('button', {name: '切换深色模式', exact: true}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await go(page, '激活管理');
  await page.locator('.heading-actions').getByRole('button', {name: '生成激活码', exact: true}).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const transforms = await dialog.locator(':scope > div').evaluate(async el => {
    const values: string[] = [];
    for (let i = 0; i < 6; i++) {values.push(getComputedStyle(el).transform); await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));}
    return values;
  });
  expect(transforms.every(value => value === 'none' || value === 'matrix(1, 0, 0, 1, 0, 0)'), `减少动画下不应发生位移：${transforms.join(' -> ')}`).toBe(true);
  await assertNoPageOverflow(page);
});

test('七个模块、公告及推送弹窗的 axe 严重和致命问题为零', async ({page}) => {
  test.setTimeout(90_000);
  for (const [, name] of sections) {await go(page, name); await assertAccessible(page);}
  await go(page, '应用公告'); await newRecord(page, 'announcement'); await assertAccessible(page); await page.keyboard.press('Escape');
  await go(page, '消息推送'); await newRecord(page, 'message'); await assertAccessible(page); await page.keyboard.press('Escape');
  await page.getByRole('button', {name: '切换深色模式', exact: true}).click(); await assertAccessible(page);
});

// Synthetic service responses validate the frontend boundary, not a real backend.
const syntheticData: Record<string, unknown> = {
  login: {ok: true}, profile: {username: 'isolated-admin'},
  codes: {codes: [{id: 'private-code-1', note: '隔离私密授权记录', enabled: 1, created: 1_760_000_000, device: null, issued: null, max_uses: 5, used_count: 1, remaining: 4, code: 'DEMO-PRIVATE-ONLY', mode: 'normal'}]},
  devices: {items: [{id: 'PRIVATE-INSTALL-ONLY', accountName: 'private.account.example', platform: 'ios', model: '隔离测试设备', appVersion: '0.1.0 (4)', bundleId: 'cn.xjtlu.ams.ios', apnsEnv: 'sandbox', lastSeenAt: '2026-10-13T08:30:00Z', accountUpdatedAt: '2026-10-13T08:30:00Z', accountRevision: 1, activation: {codeId: 'private-code-1', note: '隔离私密授权记录', state: 'active', codeEnabled: true, deviceEnabled: true, activatedAt: '2026-10-13T08:00:00Z', checkedAt: '2026-10-13T08:30:00Z'}, timetableUpdatedAt: null, courseCount: 0, pendingCount: 0, coverageUntil: null, tokenState: 'missing', prefs: {enabled: false, leadMin: 15, merge: true}}]},
  announcements: {items: [{id: 'private-announcement', title: '隔离私密公告', body: '会话失效后应清除的隔离公告正文。', platform: 'all', status: 'published', publishAt: '2026-10-13T08:30:00Z', expiresAt: null, createdAt: '2026-10-13T08:30:00Z', updatedAt: '2026-10-13T08:30:00Z', revision: 1}]},
  messages: {items: [{id: 'utc-notice', title: 'UTC 时间验证通知', body: '仅用于时区验证。', channel: 'notification', platform: 'ios', audience: 'test', scheduleAt: '2099-01-01T08:30:00Z', status: 'scheduled', createdAt: '2026-10-13T08:30:00Z', revision: 1}]},
  apns: {configured: false, environment: 'sandbox', bundleId: 'cn.xjtlu.ams.ios', keyId: null, teamId: null, capabilities: {notification: false, liveactivity: false}, records: []},
  settings: {interval_days: 7, version_code: 73, version_name: '0.14.1', download_url: 'https://example.com/isolated-test.apk', release_notes: '隔离验证'},
  overview: {asOf: '2026-10-13T08:30:00Z', activationCount: 1, deviceCount: 1, activeDeviceCount: 1, disabledDeviceCount: 0, legacyDeviceCount: 0, connectedTodayCount: 1, pendingCount: 0, acceptedCount: 0},
};
async function loginWithSyntheticAccount(page: Page) {
  await page.getByRole('button', {name: '管理员登录', exact: true}).click();
  const login = page.getByRole('dialog');
  await login.getByRole('textbox', {name: '管理员账户', exact: true}).fill('isolated-admin');
  await login.getByLabel('管理员密码', {exact: true}).fill('local-test-only');
  await login.getByRole('button', {name: '登录管理后台', exact: true}).click();
  await expect(login).not.toBeVisible(); await expect(page.locator('.profile-button')).toContainText('isolated-admin'); await expect(page.locator('.mode-banner')).toHaveCount(0);
}

test.describe('服务故障与隔离响应', () => {
  test.use({allowBusinessApi: true});
  for (const kind of ['message', 'announcement'] as const) {
    test(`${kind === 'message' ? '通知' : '公告'}创建成功但响应丢失，修改正文后重试先更新旧草稿再发布`, async ({page, apiRequests}) => {
      const collection = kind === 'message' ? 'messages' : 'announcements';
      const action = kind === 'message' ? 'submit' : 'publish';
      const recordId = `isolated-${kind}-only`;
      const title = `${kind === 'message' ? '通知' : '公告'}断网重试验证`;
      const oldBody = '首次保存到隔离服务的旧正文。';
      const newBody = '响应丢失后编辑的最新正文，必须更新后再发布。';
      const createPayloads: Record<string, unknown>[] = [];
      const mutations: {method: string; path: string; payload: Record<string, unknown>}[] = [];
      let stored: Record<string, unknown> | undefined;
      let bodyAtSubmission: unknown;
      await page.route('**/api/admin/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname.slice('/api/admin/'.length);
        const method = request.method();
        const fulfill = (data: unknown, status = 200) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(data)});
        if (path === collection && method === 'POST') {
          const payload = request.postDataJSON() as Record<string, unknown>;
          createPayloads.push(payload); mutations.push({method, path, payload});
          if (!stored) {
            stored = {...payload, id: recordId, revision: 1, status: 'draft', createdAt: '2026-10-13T08:30:00Z', updatedAt: '2026-10-13T08:30:00Z'};
            // The service persisted the record, but the browser receives no response.
            return route.abort('failed');
          }
          // Idempotent creation returns the existing, still stale draft.
          return fulfill({[kind]: stored});
        }
        if (path === `${collection}/${recordId}` && method === 'PATCH') {
          const payload = request.postDataJSON() as Record<string, unknown>;
          mutations.push({method, path, payload});
          stored = {...stored, ...payload, revision: 2};
          return fulfill({[kind]: stored});
        }
        if (path === `${collection}/${recordId}/${action}` && method === 'POST') {
          const payload = request.postDataJSON() as Record<string, unknown>;
          mutations.push({method, path, payload}); bodyAtSubmission = stored?.body;
          stored = {...stored, status: kind === 'message' ? 'queued' : 'published', revision: 3};
          return fulfill({[kind]: stored});
        }
        if (path === collection && method === 'GET') return fulfill({items: stored ? [stored] : []});
        return fulfill(syntheticData[path] || {error: {message: '未实现的隔离接口'}}, path in syntheticData ? 200 : 503);
      });
      await loginWithSyntheticAccount(page);
      await go(page, kind === 'message' ? '消息推送' : '应用公告');
      const composer = await newRecord(page, kind);
      await composer.getByRole('textbox', {name: kind === 'message' ? '消息标题' : '公告标题', exact: true}).fill(title);
      const body = composer.getByRole('textbox', {name: kind === 'message' ? /^消息内容/ : /^公告内容/});
      await body.fill(oldBody);
      await composer.getByRole('button', {name: '保存草稿', exact: true}).click();
      await expect(composer.getByRole('alert')).toContainText('无法连接管理服务');
      await expect(body).toHaveValue(oldBody);
      await body.fill(newBody);
      await composer.getByRole('button', {name: kind === 'message' ? '检查发送预览' : '检查发布预览', exact: true}).click();
      await page.getByRole('dialog').getByRole('button', {name: kind === 'message' ? '确认加入发送计划' : '发布公告', exact: true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(recordWithHeading(page, title)).toHaveCount(1);
      await expect(recordWithHeading(page, title)).toContainText(kind === 'message' ? '排队中' : '已发布');
      expect(createPayloads).toHaveLength(2);
      expect(createPayloads[0].clientRequestId).toEqual(expect.any(String));
      expect(createPayloads[0].clientRequestId).toBeTruthy();
      expect(createPayloads[1].clientRequestId).toBe(createPayloads[0].clientRequestId);
      expect(mutations.map(m => `${m.method} ${m.path}`)).toEqual([
        `POST ${collection}`, `POST ${collection}`, `PATCH ${collection}/${recordId}`, `POST ${collection}/${recordId}/${action}`,
      ]);
      expect(mutations[2].payload).toMatchObject({id: recordId, body: newBody, revision: 1});
      expect(mutations[3].payload).toMatchObject({revision: 2, confirmed: true, idempotencyKey: expect.any(String)});
      expect(bodyAtSubmission).toBe(newBody);
      expect(stored?.body).toBe(newBody);
      expect(apiRequests.filter(request => /^(POST|PATCH|PUT|DELETE) /.test(request))).toEqual([
        'POST /api/admin/login', ...mutations.map(m => `${m.method} /api/admin/${m.path}`),
      ]);
    });
  }
  test('读取三页设备后可搜索末页学校账户，详情不会提前下载课表', async ({page, apiRequests}) => {
    const cursors: (string | null)[] = [];
    const baseDevice = (syntheticData.devices as {items: Record<string, unknown>[]}).items[0];
    const devices = Array.from({length: 5}, (_, index) => ({...baseDevice, id: `ISOLATED-PAGED-INSTALL-${index + 1}`, accountName: index === 4 ? 'last.page.school.account' : `isolated.page.account${index + 1}`}));
    await page.route('**/api/admin/**', route => {
      const request = route.request(), url = new URL(request.url());
      const path = url.pathname.slice('/api/admin/'.length);
      if (path === 'devices' && request.method() === 'GET') {
        const cursor = url.searchParams.get('cursor'); cursors.push(cursor);
        const offset = cursor === null ? 0 : Number(cursor);
        return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({items: devices.slice(offset, offset + 2), nextCursor: offset + 2 < devices.length ? String(offset + 2) : null})});
      }
      return route.fulfill({status: path in syntheticData ? 200 : 503, contentType: 'application/json', body: JSON.stringify(syntheticData[path] || {error: {message: '未实现的隔离接口'}})});
    });
    await loginWithSyntheticAccount(page); await go(page, '设备与账户');
    expect(cursors).toEqual([null, '2', '4']);
    await expect(page.locator('tbody tr')).toHaveCount(5);
    await page.getByRole('textbox', {name: '搜索记录', exact: true}).fill('last.page.school.account');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    const detail = await openDevice(page, 'ISOLATED-PAGED-INSTALL-5');
    await expect(detail).toContainText('last.page.school.account');
    await expect(detail).toContainText('ISOLATED-PAGED-INSTALL-5');
    await expect(detail.getByRole('button', {name: '查看云端课表', exact: true})).toBeVisible();
    expect(cursors).toEqual([null, '2', '4']);
    expect(apiRequests.filter(request => request.includes('/timetable'))).toEqual([]);
    expect(apiRequests.filter(request => /^(POST|PATCH|PUT|DELETE) /.test(request))).toEqual(['POST /api/admin/login']);
  });
  for (const response of ['JSON 503', 'HTML 占位页']) {
    test(`${response} 登录失败报错并保留演示状态，不读取真实业务接口`, async ({page, apiRequests}) => {
      if (response === 'HTML 占位页') await page.route('**/api/admin/login', route => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>service placeholder</title>'}));
      await page.getByRole('button', {name: '管理员登录', exact: true}).click();
      const login = page.getByRole('dialog');
      await login.getByRole('textbox', {name: '管理员账户', exact: true}).fill('isolated-admin');
      await login.getByLabel('管理员密码', {exact: true}).fill('local-test-only');
      await login.getByRole('button', {name: '登录管理后台', exact: true}).click();
      await expect(login.getByRole('alert')).toContainText('管理服务尚未接入');
      await expect(page.locator('.mode-banner')).toContainText('交互预览');
      expect(apiRequests).toEqual(['POST /api/admin/login']);
      await login.getByRole('button', {name: '继续查看界面预览', exact: true}).click();
      await go(page, '设备与账户'); await expect(rowForDevice(page, 'DEMO-INSTALL-0001')).toBeVisible();
      expect(apiRequests).toEqual(['POST /api/admin/login']);
    });
  }
  test('隔离响应的 UTC 计划编辑为北京时间，取消编辑不提交消息', async ({page, apiRequests}) => {
    await page.route('**/api/admin/**', route => {
      const path = new URL(route.request().url()).pathname.slice('/api/admin/'.length);
      return route.fulfill({status: path in syntheticData ? 200 : 503, contentType: 'application/json', body: JSON.stringify(syntheticData[path] || {error: {message: '未实现的隔离接口'}})});
    });
    await loginWithSyntheticAccount(page); await go(page, '消息推送');
    await recordWithHeading(page, 'UTC 时间验证通知').click();
    await page.getByRole('dialog').getByRole('button', {name: '编辑与预览', exact: true}).click();
    await expect(page.getByRole('dialog').getByLabel('发送时间（北京时间）')).toHaveValue('2099-01-01T16:30');
    await page.keyboard.press('Escape');
    expect(apiRequests.filter(request => /^(POST|PATCH|PUT|DELETE) /.test(request))).toEqual(['POST /api/admin/login']);
  });
  test('真实模式的Android消息提交保留平台并显示App获取状态，业务请求全隔离', async ({page}) => {
    let message: Record<string, unknown> | null = null;
    const writes: Record<string, unknown>[] = [];
    await page.route('**/api/admin/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname.slice('/api/admin/'.length);
      const fulfill = (body: unknown, status = 200) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
      if (path === 'messages' && request.method() === 'POST') {
        const body = request.postDataJSON(); writes.push(body);
        expect(body.platform).toBe('android'); expect(body.channel).toBe('notification');
        message = {...body, id: 'msg-isolated-android', revision: 1, status: 'draft', createdAt: new Date().toISOString()};
        return fulfill({message}, 201);
      }
      if (path === 'messages/msg-isolated-android/submit') {
        const body = request.postDataJSON(); writes.push(body);
        expect(body.confirmed).toBe(true); expect(body.idempotencyKey).toBeTruthy();
        message = {...message, status: 'available_in_app', recipientCount: 1, offeredCount: 0, readCount: 0};
        return fulfill({message}, 202);
      }
      if (path === 'messages' && request.method() === 'GET') return fulfill({items: message ? [message] : [], nextCursor: null});
      return fulfill(syntheticData[path] || {error: {message: '隔离接口未实现'}}, path in syntheticData ? 200 : 503);
    });
    await loginWithSyntheticAccount(page); await go(page, '消息推送');
    const composer = await newRecord(page, 'message');
    await composer.getByLabel('接收平台').selectOption('android');
    await composer.getByRole('textbox', {name: '消息标题', exact: true}).fill('隔离Android发布');
    await composer.getByRole('textbox', {name: /^消息内容/}).fill('不会发送到真实设备。');
    await composer.getByRole('button', {name: '检查发送预览', exact: true}).click();
    await expect(composer).toContainText('没有后台远程推送');
    await composer.getByRole('button', {name: '确认加入发送计划', exact: true}).click();
    const record = recordWithHeading(page, '隔离Android发布');
    await expect(record).toContainText('已发布到 App'); await record.click();
    await expect(page.getByRole('dialog')).toContainText('校验回复中提供 0');
    await expect(page.getByRole('dialog')).toContainText('已确认阅读 0');
    await expect(page.getByRole('dialog')).not.toContainText('已提交 APNs');
    expect(writes).toHaveLength(2);
  });
  test('任一读取接口 401 后清除全部私密管理记录', async ({page, apiRequests}) => {
    let expired = false;
    await page.route('**/api/admin/**', route => {
      const path = new URL(route.request().url()).pathname.slice('/api/admin/'.length), denied = expired && path === 'devices';
      return route.fulfill({status: denied ? 401 : path in syntheticData ? 200 : 503, contentType: 'application/json', body: JSON.stringify(denied ? {error: {message: '会话已过期'}} : syntheticData[path] || {error: {message: '未实现的隔离接口'}})});
    });
    await loginWithSyntheticAccount(page); await go(page, '设备与账户');
    await expect(rowForDevice(page, 'PRIVATE-INSTALL-ONLY')).toContainText('private.account.example');
    expired = true;
    await page.locator('.heading-actions').getByRole('button', {name: '刷新', exact: true}).click();
    await expect(page.getByRole('heading', {level: 1, name: '登录管理后台', exact: true})).toBeVisible(); await expect(page.getByRole('alert')).toContainText(/会话.*过期/);
    await expect(page.getByText('private.account.example', {exact: true})).toHaveCount(0);
    await expect(page.getByText('PRIVATE-INSTALL-ONLY', {exact: true})).toHaveCount(0);
    for (const text of ['隔离私密授权记录', '隔离私密公告', 'UTC 时间验证通知', 'DEMO-INSTALL-0001']) await expect(page.getByText(text, {exact: true})).toHaveCount(0);
    await expect(page.getByRole('navigation', {name: '主导航'})).toHaveCount(0);
    expect(apiRequests.filter(request => /^(POST|PATCH|PUT|DELETE) /.test(request))).toEqual(['POST /api/admin/login']);
  });
});


test.describe('默认真实后台与登录会话', () => {
  test.use({allowBusinessApi: true});
  async function sessionCookie(page: Page) {
    const url = new URL(page.url());
    await page.context().addCookies([{name: 'ams_admin', value: 'isolated-test-session', domain: url.hostname, path: '/api/admin', httpOnly: true, secure: url.protocol === 'https:', sameSite: 'Strict', expires: Date.now() / 1000 + 3600}]);
  }
  async function authenticatedApi(page: Page) {
    await page.route('**/api/admin/**', route => {
      const request = route.request(), path = new URL(request.url()).pathname.slice('/api/admin/'.length);
      const valid = request.headers()['cookie']?.includes('ams_admin=isolated-test-session');
      if (path === 'logout') return route.fulfill({status: 200, contentType: 'application/json', headers: {'set-cookie': 'ams_admin=; HttpOnly; Path=/api/admin; Max-Age=0'}, body: '{"ok":true}'});
      return route.fulfill({status: !valid ? 401 : path in syntheticData ? 200 : 503, contentType: 'application/json', body: JSON.stringify(!valid ? {message: '请先登录管理页'} : syntheticData[path] || {message: '隔离接口未实现'})});
    });
  }
  test('未登录直接显示登录页，没有连接按钮、演示数据或业务读取', async ({page, apiRequests}) => {
    await page.route('**/api/admin/profile', route => route.fulfill({status: 401, contentType: 'application/json', body: '{"message":"请先登录管理页"}'}));
    await page.goto('./');
    await expect(page.getByRole('heading', {level: 1, name: '登录管理后台', exact: true})).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', {name: '连接管理后台', exact: true})).toHaveCount(0);
    await expect(page.getByText('交互预览', {exact: true})).toHaveCount(0);
    await expect(page.getByText('DEMO-INSTALL-0001', {exact: true})).toHaveCount(0);
    expect(apiRequests.every(r => r === 'GET /api/admin/profile')).toBe(true);
    await assertNoPageOverflow(page); await assertAccessible(page);
    await page.getByRole('button', {name: '切换深色模式', exact: true}).click(); await assertAccessible(page);
    await page.screenshot({path: `test-results/session-login-${test.info().project.name}.png`, fullPage: true});
  });
  test('有效HttpOnly会话自动加载真实数据，刷新及深链接不要求重新登录', async ({page, apiRequests}) => {
    await sessionCookie(page); await authenticatedApi(page);
    await page.goto('./#activations');
    await expect(page.getByRole('heading', {level: 1, name: '激活管理', exact: true})).toBeVisible();
    await expect(page.getByText('隔离私密授权记录', {exact: true})).toBeVisible();
    await expect(page.getByText('交互预览', {exact: true})).toHaveCount(0);
    await expect(page.getByRole('button', {name: '连接管理后台', exact: true})).toHaveCount(0);
    await page.reload();
    await expect(page.getByText('隔离私密授权记录', {exact: true})).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(apiRequests.filter(r => !r.startsWith('GET '))).toEqual([]);
    const storage = await page.evaluate(() => ({...localStorage}));
    expect(JSON.stringify(storage)).not.toContain('isolated-test-session');
    await assertAccessible(page); await assertNoPageOverflow(page);
  });
  test('退出回登录页，清空真实数据且不回演示，重新打开不会复用已清Cookie', async ({page, apiRequests}) => {
    await sessionCookie(page); await authenticatedApi(page); await page.goto('./');
    await expect(page.getByRole('heading', {level: 1, name: '工作台', exact: true})).toBeVisible();
    await page.getByRole('button', {name: '退出登录', exact: true}).click();
    await expect(page.getByRole('heading', {level: 1, name: '登录管理后台', exact: true})).toBeVisible();
    await expect(page.getByText('private.account.example', {exact: true})).toHaveCount(0);
    await expect(page.getByText('交互预览', {exact: true})).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', {level: 1, name: '登录管理后台', exact: true})).toBeVisible();
    expect(apiRequests.filter(r => !r.startsWith('GET '))).toEqual(['POST /api/admin/logout']);
  });
  for (const failure of ['JSON503', 'HTML', 'network']) {
    test(`${failure}会话核验失败保留登录错误，不读业务数据或补演示`, async ({page, apiRequests}) => {
      await page.route('**/api/admin/profile', route => failure === 'network' ? route.abort('failed') : route.fulfill({status: failure === 'JSON503' ? 503 : 200, contentType: failure === 'HTML' ? 'text/html' : 'application/json', body: failure === 'HTML' ? '<html>placeholder</html>' : '{"message":"管理服务暂时不可用"}'}));
      await page.goto('./');
      await expect(page.getByRole('heading', {level: 1, name: '登录管理后台', exact: true})).toBeVisible();
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('交互预览', {exact: true})).toHaveCount(0);
      await expect(page.locator('[data-page]')).toHaveCount(0);
      expect(apiRequests.every(r => r === 'GET /api/admin/profile')).toBe(true);
    });
  }
});
