/**
 * @feature [F12] Kiểm thử chế độ tối: chọn chế độ ban đầu, lưu lựa chọn, đồng bộ giữa các nút và nút ThemeToggle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  THEME_STORAGE_KEY,
  ThemeToggle,
  getTheme,
  initTheme,
  resolveInitialTheme,
  setTheme,
} from '../src/index.js';

const mockSystemTheme = (dark) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: dark });
};

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  mockSystemTheme(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveInitialTheme', () => {
  it('theo hệ điều hành khi người dùng chưa chọn', () => {
    mockSystemTheme(true);
    expect(resolveInitialTheme()).toBe('dark');
    mockSystemTheme(false);
    expect(resolveInitialTheme()).toBe('light');
  });

  it('lựa chọn đã lưu được ưu tiên hơn hệ điều hành', () => {
    mockSystemTheme(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(resolveInitialTheme()).toBe('light');

    mockSystemTheme(false);
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('giá trị lạ đã lưu bị bỏ qua và quay về theo hệ điều hành', () => {
    mockSystemTheme(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'tim-tim');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('môi trường không có matchMedia thì dùng chế độ sáng', () => {
    window.matchMedia = undefined;
    expect(resolveInitialTheme()).toBe('light');
  });

  it('localStorage bị chặn (ném lỗi) thì không lỗi và dùng hệ điều hành', () => {
    mockSystemTheme(true);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(resolveInitialTheme()).toBe('dark');
  });
});

describe('initTheme, getTheme, setTheme', () => {
  it('initTheme đặt data-theme nếu chưa có và không ghi đè nếu đã có', () => {
    mockSystemTheme(true);
    initTheme();
    expect(document.documentElement.dataset.theme).toBe('dark');

    document.documentElement.dataset.theme = 'light';
    initTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('getTheme đọc từ thẻ <html>; chưa đặt thì là sáng', () => {
    expect(getTheme()).toBe('light');
    document.documentElement.dataset.theme = 'dark';
    expect(getTheme()).toBe('dark');
  });

  it('setTheme đổi thẻ <html> và lưu lựa chọn', () => {
    setTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('không lưu được thì vẫn đổi chế độ cho lần mở trang này', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => setTheme('dark')).not.toThrow();
    expect(getTheme()).toBe('dark');
  });
});

describe('ThemeToggle', () => {
  it('nhãn nói rõ việc sẽ làm; bấm thì đổi chế độ, nhãn và lưu lại', async () => {
    document.documentElement.dataset.theme = 'light';
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole('button', { name: 'Chuyển sang chế độ tối' }));
    expect(getTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Chuyển sang chế độ sáng' }));
    expect(getTheme()).toBe('light');
    expect(screen.getByRole('button', { name: 'Chuyển sang chế độ tối' })).toBeInTheDocument();
  });

  it('nhiều nút trên cùng trang luôn đồng bộ với nhau', async () => {
    document.documentElement.dataset.theme = 'light';
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    );

    await userEvent.click(screen.getAllByRole('button', { name: 'Chuyển sang chế độ tối' })[0]);

    expect(screen.getAllByRole('button', { name: 'Chuyển sang chế độ sáng' })).toHaveLength(2);
  });

  it('nhận thêm class từ nơi dùng', () => {
    render(<ThemeToggle className="text-red-500" />);
    expect(screen.getByRole('button')).toHaveClass('text-red-500');
  });
});
