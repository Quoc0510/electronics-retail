/**
 * @feature [F15] Kiểm thử E2E - Cấu hình Playwright: chạy trình duyệt thật (Chromium) qua toàn bộ hệ thống đang chạy bằng Docker
 * (xem e2e/stack.mjs). Các kịch bản đi xuyên Client, Admin, backend và cơ sở dữ liệu thật, bổ sung cho test đơn vị và test tích hợp.
 *
 * Chạy: `npm run e2e:up` (một lần), `npm run e2e`, rồi `npm run e2e:down`. Báo cáo HTML ở playwright-report/, ảnh chụp và
 * trace của test lỗi ở test-results/ (cả hai đã nằm trong .gitignore).
 * Các kịch bản dùng chung một cơ sở dữ liệu và có thứ tự, nên chạy tuần tự (một worker).
 */
import { defineConfig, devices } from '@playwright/test';

export const CLIENT_URL = process.env.E2E_CLIENT_URL ?? 'http://localhost:18080';
export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:18081';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: CLIENT_URL,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
