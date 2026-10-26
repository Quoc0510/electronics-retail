import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @feature [F00] Nền tảng - Cấu hình Vite cho Frontend Client (khách hàng).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Khi dev, request /api (dữ liệu) và /uploads (ảnh sản phẩm) được chuyển tiếp sang backend để tránh lỗi CORS
    proxy: { '/api': 'http://localhost:4000', '/uploads': 'http://localhost:4000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    coverage: { provider: 'v8', include: ['src/**/*.{js,jsx}'], reporter: ['text', 'lcov'] },
  },
});
