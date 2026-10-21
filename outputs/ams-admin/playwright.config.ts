import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: './test',
  testMatch: 'browser.spec.ts',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 35_000,
  expect: {timeout: 6_000},
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.AMS_ADMIN_BASE_URL || 'http://127.0.0.1:4319/admin/',
    channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    locale: 'zh-CN',
    timezoneId: 'America/Los_Angeles',
  },
  projects: [
    {name: 'desktop', use: {viewport: {width: 1440, height: 1000}}},
    {name: 'mobile-390', use: {viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}},
  ],
});
