import { defineConfig } from 'vitest/config';

// @feature [F01] Cấu hình test cho package dùng chung (cần jsdom vì có localStorage và component React).
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/setup.js'],
    coverage: { provider: 'v8', include: ['src/**/*.{js,jsx}'], reporter: ['text', 'lcov'] },
  },
});
