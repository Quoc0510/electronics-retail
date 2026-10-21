import { defineConfig } from 'vitest/config';

// @feature [F00] Nền tảng - Cấu hình kiểm thử backend (unit + API integration bằng Supertest).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Biến môi trường riêng cho test, không cần file .env
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
