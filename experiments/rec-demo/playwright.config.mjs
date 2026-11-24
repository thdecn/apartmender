import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', timeout: 180000, expect: { timeout: 90000 },
  workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4178', viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure' },
  webServer: { command: 'npm run serve', url: 'http://127.0.0.1:4178/apartmender/rec-demo/', reuseExistingServer: false },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } }],
});
