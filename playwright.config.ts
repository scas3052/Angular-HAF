import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = __dirname;
const hasOriginal = existsSync(path.resolve(root, '../HAF-Website/index.html'));

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  expect: { timeout: 15000 },
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4201',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: [
    { command: 'npm run start -- --host 127.0.0.1 --port 4201 --open=false', cwd: root,
      url: 'http://127.0.0.1:4201', reuseExistingServer: !process.env['CI'], timeout: 120000 },
    ...(hasOriginal ? [{ command: 'node scripts/serve-legacy.mjs', cwd: root,
      url: 'http://127.0.0.1:4173', reuseExistingServer: false, timeout: 15000 }] : [])
  ]
});