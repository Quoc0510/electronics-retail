/**
 * @feature [F00][F01] Kiểm thử điều hướng, thanh trên cùng và khôi phục phiên của Client.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from './lib/api.js';
import { apiError, customer, mockServer, renderApp, session } from './test/utils.jsx';

const health = { 'GET /health': [200, { status: 'ok' }] };

describe('Trang chủ và điều hướng', () => {
  it('hiển thị trang chủ, trạng thái máy chủ và nút Đăng nhập/Đăng ký khi chưa đăng nhập', async () => {
    mockServer(health);
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'TechStore' })).toBeInTheDocument();
    expect(await screen.findByText('Máy chủ: ok')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng ký' })).toBeInTheDocument();
  });

  it('hiển thị trang 404 khi đường dẫn không tồn tại', () => {
    mockServer(health);
    renderApp('/khong-co-trang-nay');

    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
  });

  it('báo không kết nối được máy chủ khi API lỗi', async () => {
    mockServer({ 'GET /health': [500, apiError('INTERNAL_ERROR', 'Lỗi')] });
    renderApp('/');

    expect(await screen.findByText('Không kết nối được máy chủ')).toBeInTheDocument();
  });
});

describe('Trang yêu cầu đăng nhập (US-14 AC1)', () => {
  it('chưa đăng nhập vào /tai-khoan thì bị chuyển sang trang đăng nhập', () => {
    mockServer(health);
    renderApp('/tai-khoan');

    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('đăng nhập xong quay lại đúng trang đang định vào', async () => {
    mockServer({
      ...health,
      'POST /auth/login': [200, session],
      'GET /users/me/addresses': [200, []],
    });
    renderApp('/tai-khoan');

    await userEvent.type(screen.getByLabelText('Email'), 'khach@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Matkhau123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument();
  });
});

describe('Khôi phục phiên đăng nhập (US-03)', () => {
  it('còn refresh token thì tự đăng nhập lại khi tải trang, không bị đẩy về trang đăng nhập', async () => {
    tokenStorage.setTokens(session);
    mockServer({
      ...health,
      'GET /users/me': [200, customer],
      'GET /users/me/addresses': [200, []],
    });
    renderApp('/tai-khoan');

    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument();
    expect(screen.getByText('Xin chào, Khách A')).toBeInTheDocument();
  });

  it('access token hết hạn thì tự làm mới và người dùng không nhận ra', async () => {
    tokenStorage.setTokens({ accessToken: 'het-han', refreshToken: 'refresh-1' });
    let refreshed = false;
    const calls = mockServer({
      ...health,
      'POST /auth/refresh': () => {
        refreshed = true;
        return [200, { accessToken: 'moi', refreshToken: 'refresh-2' }];
      },
      'GET /users/me': () =>
        refreshed ? [200, customer] : [401, apiError('INVALID_TOKEN', 'Hết hạn')],
    });
    renderApp('/');

    expect(await screen.findByText('Xin chào, Khách A')).toBeInTheDocument();
    expect(calls.filter((c) => c.key === 'POST /auth/refresh')).toHaveLength(1);
    expect(tokenStorage.getRefreshToken()).toBe('refresh-2');
  });

  it('phiên hết hạn hẳn thì về trạng thái chưa đăng nhập', async () => {
    tokenStorage.setTokens({ accessToken: 'het-han', refreshToken: 'het-han' });
    mockServer({
      ...health,
      'POST /auth/refresh': [401, apiError('INVALID_TOKEN', 'Phiên không hợp lệ')],
      'GET /users/me': [401, apiError('INVALID_TOKEN', 'Hết hạn')],
    });
    renderApp('/');

    expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});

describe('Đăng xuất', () => {
  it('gọi API thu hồi token, xóa phiên và hiện lại nút Đăng nhập', async () => {
    tokenStorage.setTokens(session);
    const calls = mockServer({
      ...health,
      'GET /users/me': [200, customer],
      'POST /auth/logout': [204, null],
    });
    renderApp('/');
    await userEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));

    expect(await screen.findByRole('link', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(calls).toContainEqual({ key: 'POST /auth/logout', body: { refreshToken: 'refresh-1' } });
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});
