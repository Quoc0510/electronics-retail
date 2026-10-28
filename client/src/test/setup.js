// @feature [F00] Nền tảng - Thiết lập chung cho test frontend: thêm các matcher như toBeInTheDocument()
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom chưa cài đặt window.scrollTo (Layout cuộn về đầu trang khi đổi trang) nên giả lập để không báo lỗi
beforeEach(() => {
  window.scrollTo = vi.fn();
});

// Dọn DOM và phiên đăng nhập sau mỗi test để các test không ảnh hưởng nhau
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});
