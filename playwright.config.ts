import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000', browserName: 'chromium', headless: true, launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}, viewport: {width:1440,height:1050} },
  reporter: 'list',
});
