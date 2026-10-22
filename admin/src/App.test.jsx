/**
 * @feature [F01] Kiểm thử đăng nhập và phân quyền của trang Admin (US-02, US-05 AC2).
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from './lib/api.js';
import {
  admin,
  adminSession,
  apiError,
  customer,
  customerSession,
  mockServer,
  renderApp,
} from './test/utils.jsx';

const health = { 'GET /health': [200, { status: 'ok' }] };

const signIn = async (email = 'admin@example.com', password = 'Matkhau123') => {
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Mật khẩu'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
};

describe('Chặn truy cập khi chưa đăng nhập (US-05 AC2)', () => {
  it('vào trang tổng quan khi chưa đăng nhập thì chuyển sang trang đăng nhập', () => {
    mockServer(health);
    renderApp('/');

    expect(screen.getByRole('heading', { name: 'TechStore Admin' })).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập để quản lý cửa hàng')).toBeInTheDocument();
  });

  it('đường dẫn không tồn tại cũng yêu cầu đăng nhập trước', () => {
    mockServer(health);
    renderApp('/khong-co-trang-nay');

    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});

describe('Đăng nhập quản trị', () => {
  it('báo lỗi từng ô và không gọi API khi để trống', async () => {
    const calls = mockServer(health);
    renderApp('/dang-nhap');

    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Vui lòng nhập email')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /auth/login')).toBe(false);
  });

  it('quản trị viên đăng nhập thành công và vào trang tổng quan', async () => {
    mockServer({ ...health, 'POST /auth/login': [200, adminSession] });
    renderApp('/dang-nhap');

    await signIn();

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(screen.getByText(/Xin chào Quản trị viên/)).toBeInTheDocument();
    expect(tokenStorage.getRefreshToken()).toBe('refresh-1');
  });

  it('đăng nhập xong quay lại đúng trang đang định vào', async () => {
    mockServer({ ...health, 'POST /auth/login': [200, adminSession] });
    renderApp('/khong-co-trang-nay');

    await signIn();

    // Trang không tồn tại nằm trong khu vực đã đăng nhập nên hiện 404 của Admin
    expect(await screen.findByRole('heading', { name: '404' })).toBeInTheDocument();
  });

  it('khách hàng đăng nhập bị từ chối, không lưu token và phiên bị thu hồi ở backend', async () => {
    const calls = mockServer({
      ...health,
      'POST /auth/login': [200, customerSession],
      'POST /auth/logout': [204, null],
    });
    renderApp('/dang-nhap');

    await signIn('khach@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tài khoản này không có quyền quản trị',
    );
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(calls).toContainEqual({ key: 'POST /auth/logout', body: { refreshToken: 'refresh-2' } });
    expect(screen.queryByRole('heading', { name: 'Tổng quan' })).not.toBeInTheDocument();
  });

  it('sai mật khẩu: hiện thông báo của máy chủ', async () => {
    mockServer({
      ...health,
      'POST /auth/login': [401, apiError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng')],
    });
    renderApp('/dang-nhap');

    await signIn('admin@example.com', 'SaiMatKhau1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng');
  });

  it('đã đăng nhập mà vào /dang-nhap thì chuyển về trang tổng quan', async () => {
    tokenStorage.setTokens(adminSession);
    mockServer({ ...health, 'GET /users/me': [200, admin] });
    renderApp('/dang-nhap');

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
  });
});

describe('Khôi phục phiên và đăng xuất', () => {
  it('còn phiên quản trị thì tự đăng nhập lại khi tải trang', async () => {
    tokenStorage.setTokens(adminSession);
    mockServer({ ...health, 'GET /users/me': [200, admin] });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Tổng quan' })).toBeInTheDocument();
    expect(await screen.findByText('Máy chủ: ok')).toBeInTheDocument();
  });

  it('phiên còn lại là của khách hàng thì bị thu hồi và về trang đăng nhập (US-05 AC2)', async () => {
    tokenStorage.setTokens(customerSession);
    const calls = mockServer({
      ...health,
      'GET /users/me': [200, customer],
      'POST /auth/logout': [204, null],
    });
    renderApp('/');

    expect(await screen.findByText('Đăng nhập để quản lý cửa hàng')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /auth/logout')).toBe(true);
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('đăng xuất thu hồi token và quay về trang đăng nhập', async () => {
    tokenStorage.setTokens(adminSession);
    const calls = mockServer({
      ...health,
      'GET /users/me': [200, admin],
      'POST /auth/logout': [204, null],
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));

    expect(await screen.findByText('Đăng nhập để quản lý cửa hàng')).toBeInTheDocument();
    expect(calls).toContainEqual({ key: 'POST /auth/logout', body: { refreshToken: 'refresh-1' } });
  });

  it('hiện thông báo khi không kết nối được máy chủ ở trang tổng quan', async () => {
    tokenStorage.setTokens(adminSession);
    mockServer({
      'GET /users/me': [200, admin],
      'GET /health': [500, apiError('INTERNAL_ERROR', 'Lỗi')],
    });
    renderApp('/');

    expect(await screen.findByText('Không kết nối được máy chủ')).toBeInTheDocument();
  });
});
