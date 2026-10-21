/**
 * @feature [F00] Nền tảng - Kiểm thử điều hướng cơ bản của Client.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';

// Giả lập API để test không cần chạy backend
vi.mock('./lib/api.js', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { status: 'ok' } }) },
}));

const renderAt = (path) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('App (Client)', () => {
  it('hiển thị trang chủ và trạng thái kết nối máy chủ', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'TechStore' })).toBeInTheDocument();
    expect(await screen.findByText('Máy chủ: ok')).toBeInTheDocument();
  });

  it('hiển thị trang 404 khi đường dẫn không tồn tại', () => {
    renderAt('/khong-co-trang-nay');
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
  });
});
