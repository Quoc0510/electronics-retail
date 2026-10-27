/**
 * @feature [F12] Chế độ tối - Lưu và áp dụng giao diện sáng/tối cho cả Client và Admin.
 * Giá trị nằm ở thuộc tính data-theme của thẻ <html> (CSS trong theme.css dựa vào đó). Trang đặt giá trị này bằng một đoạn
 * script nhỏ trong index.html TRƯỚC khi React chạy để không bị chớp nền trắng khi tải lại ở chế độ tối.
 * Thứ tự ưu tiên: lựa chọn đã lưu của người dùng, rồi cài đặt của hệ điều hành (prefers-color-scheme), cuối cùng là sáng.
 */
import { useSyncExternalStore } from 'react';

export const THEME_STORAGE_KEY = 'techstore.theme';

const listeners = new Set();

// Đọc lựa chọn đã lưu; localStorage có thể bị chặn (chế độ riêng tư) nên bọc try/catch
const readStored = () => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
};

/** Chế độ nên dùng khi mở trang: lựa chọn đã lưu, nếu chưa có thì theo hệ điều hành. */
export const resolveInitialTheme = () => {
  const stored = readStored();
  if (stored) return stored;
  const prefersDark =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return prefersDark ? 'dark' : 'light';
};

/** Đặt thuộc tính data-theme nếu trang chưa có (phòng khi script trong index.html không chạy). */
export const initTheme = () => {
  if (typeof document === 'undefined') return;
  if (!document.documentElement.dataset.theme) {
    document.documentElement.dataset.theme = resolveInitialTheme();
  }
};

export const getTheme = () =>
  typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light';

/** Đổi chế độ, lưu lại lựa chọn và báo cho mọi component đang theo dõi. */
export const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Không lưu được thì chế độ chỉ có tác dụng trong lần mở trang này
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** { theme: 'light' | 'dark', toggle } - nhiều nút đổi giao diện trên cùng trang luôn đồng bộ với nhau. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light');
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
