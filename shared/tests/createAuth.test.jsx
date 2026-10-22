/**
 * @feature [F01] Kiểm thử AuthProvider dùng chung: đăng nhập, đăng ký, khôi phục phiên, đăng xuất, chặn vai trò.
 * Dùng axios giả (vi.fn) và localStorage thật của jsdom.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAuth, createTokenStorage, getErrorMessage } from '../src/index.js';

const customer = { id: 1, email: 'khach@example.com', fullName: 'Khách A', role: 'CUSTOMER' };
const admin = { id: 2, email: 'admin@example.com', fullName: 'Quản trị', role: 'ADMIN' };
const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1' };

let api;
let storage;
let failureHandler;

// Dựng ứng dụng thử: hiển thị user hiện tại và các nút gọi hàm của useAuth
const setup = (options = {}) => {
  const { AuthProvider, useAuth } = createAuth({
    api,
    storage,
    setAuthFailureHandler: (handler) => {
      failureHandler = handler;
    },
    ...options,
  });

  function Probe() {
    const auth = useAuth();
    return (
      <div>
        <p data-testid="state">
          {auth.initializing ? 'initializing' : auth.user ? `user:${auth.user.email}` : 'anonymous'}
        </p>
        <button
          onClick={() =>
            auth.login('a@b.com', 'Matkhau123').catch((e) => (document.title = getErrorMessage(e)))
          }
        >
          login
        </button>
        <button onClick={() => auth.register({ email: 'a@b.com' })}>register</button>
        <button onClick={() => auth.logout()}>logout</button>
        <button onClick={() => auth.logout('Đổi mật khẩu thành công')}>logout-with-notice</button>
        <button onClick={auth.clearNotice}>clear-notice</button>
        <p data-testid="notice">{auth.notice}</p>
      </div>
    );
  }

  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  localStorage.clear();
  document.title = '';
  storage = createTokenStorage('test.auth');
  api = { get: vi.fn(), post: vi.fn() };
});

describe('createAuth', () => {
  it('ban đầu là chưa đăng nhập khi không có token', () => {
    setup();

    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('đăng nhập thành công lưu token và user', async () => {
    api.post.mockResolvedValue({ data: { user: customer, ...tokens } });
    setup();

    await userEvent.click(screen.getByText('login'));

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('user:khach@example.com'),
    );
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'a@b.com',
      password: 'Matkhau123',
    });
    expect(storage.getRefreshToken()).toBe('refresh-1');
  });

  it('đăng ký thành công tự đăng nhập luôn (US-01 AC3)', async () => {
    api.post.mockResolvedValue({ data: { user: customer, ...tokens } });
    setup();

    await userEvent.click(screen.getByText('register'));

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('user:khach@example.com'),
    );
    expect(api.post).toHaveBeenCalledWith('/auth/register', { email: 'a@b.com' });
  });

  it('đăng nhập thất bại thì không lưu gì', async () => {
    api.post.mockRejectedValue(new Error('Network Error'));
    setup();

    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(document.title).toMatch(/Không kết nối/));
    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('khôi phục phiên khi tải lại trang nếu còn refresh token', async () => {
    storage.setTokens(tokens);
    api.get.mockResolvedValue({ data: customer });
    setup();

    expect(screen.getByTestId('state')).toHaveTextContent('initializing');
    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('user:khach@example.com'),
    );
    expect(api.get).toHaveBeenCalledWith('/users/me');
  });

  it('khôi phục phiên thất bại (mạng lỗi) vẫn thoát trạng thái đang tải và giữ token', async () => {
    storage.setTokens(tokens);
    api.get.mockRejectedValue(new Error('Network Error'));
    setup();

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(storage.getRefreshToken()).toBe('refresh-1');
  });

  it('đăng xuất thu hồi refresh token ở backend và xóa phiên', async () => {
    api.post.mockResolvedValue({ data: { user: customer, ...tokens } });
    setup();
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:'));

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(api.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-1' });
    expect(storage.getRefreshToken()).toBeNull();
  });

  it('đăng xuất kèm thông báo thì giữ thông báo cho trang đăng nhập, xóa được khi đã đọc', async () => {
    api.post.mockResolvedValue({ data: { user: customer, ...tokens } });
    setup();
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:'));

    await userEvent.click(screen.getByText('logout-with-notice'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('notice')).toHaveTextContent('Đổi mật khẩu thành công');

    await userEvent.click(screen.getByText('clear-notice'));
    expect(screen.getByTestId('notice')).toBeEmptyDOMElement();
  });

  it('đăng xuất vẫn xóa phiên ở máy này dù backend lỗi', async () => {
    api.post
      .mockResolvedValueOnce({ data: { user: customer, ...tokens } })
      .mockRejectedValueOnce(new Error('Network Error'));
    setup();
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:'));

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
  });

  it('khi phiên hết hạn (createApiClient báo) thì về trạng thái chưa đăng nhập', async () => {
    api.post.mockResolvedValue({ data: { user: customer, ...tokens } });
    setup();
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('user:'));

    failureHandler();

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(storage.getRefreshToken()).toBeNull();
  });
});

describe('createAuth với isAllowed (Admin chỉ cho ADMIN)', () => {
  const adminOnly = {
    isAllowed: (user) => user.role === 'ADMIN',
    notAllowedMessage: 'Không có quyền quản trị',
  };

  it('khách hàng đăng nhập bị từ chối, phiên bị thu hồi và không lưu token', async () => {
    api.post.mockResolvedValue({ data: { user: customer, ...tokens } });
    setup(adminOnly);

    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(document.title).toBe('Không có quyền quản trị'));
    expect(screen.getByTestId('state')).toHaveTextContent('anonymous');
    expect(api.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-1' });
    expect(storage.getAccessToken()).toBeNull();
  });

  it('quản trị viên đăng nhập bình thường', async () => {
    api.post.mockResolvedValue({ data: { user: admin, ...tokens } });
    setup(adminOnly);

    await userEvent.click(screen.getByText('login'));

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('user:admin@example.com'),
    );
  });

  it('phiên cũ của khách hàng bị thu hồi khi mở trang Admin', async () => {
    storage.setTokens(tokens);
    api.get.mockResolvedValue({ data: customer });
    api.post.mockResolvedValue({});
    setup(adminOnly);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));
    expect(api.post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-1' });
    expect(storage.getRefreshToken()).toBeNull();
  });
});
