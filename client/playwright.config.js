import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'dotnet run --project server/Portfolio.Api --configuration Release --no-build --no-launch-profile --urls http://127.0.0.1:5080',
    cwd: root,
    url: 'http://127.0.0.1:5080/api/health',
    reuseExistingServer: !process.env.CI,
    env: { ASPNETCORE_ENVIRONMENT: 'Production', ConnectionStrings__Portfolio: '', Gmail__AppPassword: '' },
    timeout: 60000,
  },
});
