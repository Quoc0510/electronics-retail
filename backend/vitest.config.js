import { defineConfig } from 'vitest/config';

// @feature [F00] Nền tảng - Cấu hình kiểm thử backend (unit + API integration bằng Supertest).
//
// Test tích hợp chạy trên PostgreSQL THẬT nhưng ở schema riêng "test", tách khỏi dữ liệu dev (schema "public").
// Local: cần `npm run db:up`. CI: đặt TEST_DATABASE_URL trỏ tới service PostgreSQL của pipeline.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://electronics:electronics_dev@localhost:54320/electronics_retail?schema=test';

// globalSetup chạy ở tiến trình chính nên cần đặt biến môi trường ở đây
process.env.DATABASE_URL = TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['./tests/globalSetup.js'],
    // Các file test dùng chung một database nên phải chạy lần lượt, tránh xóa dữ liệu của nhau
    fileParallelism: false,
    // Biến môi trường riêng cho test, không cần file .env
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_ACCESS_SECRET: 'khoa-bi-mat-chi-dung-cho-test-khong-dung-o-dau-khac-0123456789',
      LOGIN_RATE_LIMIT: '1000',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
