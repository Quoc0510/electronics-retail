/**
 * @feature [F01] Kiểm thử trang đăng nhập (US-02) và đăng ký (US-01) của Client.
 */
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { api, tokenStorage } from '../lib/api.js';
import { apiError, mockServer, renderApp, session } from '../test/utils.jsx';

const health = { 'GET /health': [200, { status: 'ok' }] };

describe('Trang đăng nhập', () => {
  it('báo lỗi từng ô và không gọi API khi để trống', async () => {
    const calls = mockServer(health);
    renderApp('/dang-nhap');

    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Vui lòng nhập email')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /auth/login')).toBe(false);
  });

  it('báo lỗi khi email sai định dạng', async () => {
    mockServer(health);
    renderApp('/dang-nhap');

    await userEvent.type(screen.getByLabelText('Email'), 'khong-phai-email');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(screen.getByText('Email không đúng định dạng')).toBeInTheDocument();
  });

  it('đăng nhập thành công: gửi đúng dữ liệu, lưu token, về trang chủ và hiện tên', async () => {
    const calls = mockServer({ ...health, 'POST /auth/login': [200, session] });
    renderApp('/dang-nhap');

    await userEvent.type(screen.getByLabelText('Email'), '  khach@example.com ');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Matkhau123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByText('Xin chào, Khách A')).toBeInTheDocument();
    // Chuyển về trang chủ xảy ra ngay sau khi có user nên phải chờ thay vì kiểm tra tức thì
    expect(await screen.findByRole('heading', { name: 'TechStore' })).toBeInTheDocument();
    expect(calls).toContainEqual({
      key: 'POST /auth/login',
      body: { email: 'khach@example.com', password: 'Matkhau123' },
    });
    expect(tokenStorage.getRefreshToken()).toBe('refresh-1');
  });

  it('sai mật khẩu: hiện thông báo của máy chủ và không lưu token', async () => {
    mockServer({
      ...health,
      'POST /auth/login': [401, apiError('INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng')],
    });
    renderApp('/dang-nhap');

    await userEvent.type(screen.getByLabelText('Email'), 'khach@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'SaiMatKhau1');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng');
    expect(tokenStorage.getAccessToken()).toBeNull();
  });

  it('tài khoản bị khóa: hiện thông báo từ máy chủ', async () => {
    mockServer({
      ...health,
      'POST /auth/login': [
        403,
        apiError('ACCOUNT_LOCKED', 'Tài khoản đã bị khóa, vui lòng liên hệ cửa hàng'),
      ],
    });
    renderApp('/dang-nhap');

    await userEvent.type(screen.getByLabelText('Email'), 'khach@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Matkhau123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tài khoản đã bị khóa');
  });

  it('quá số lần thử: hiện thông báo giới hạn (US-02 AC4)', async () => {
    mockServer({
      ...health,
      'POST /auth/login': [
        429,
        apiError('RATE_LIMITED', 'Bạn đăng nhập sai quá nhiều lần, hãy thử lại sau'),
      ],
    });
    renderApp('/dang-nhap');

    await userEvent.type(screen.getByLabelText('Email'), 'khach@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Matkhau123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('sai quá nhiều lần');
  });

  it('mất kết nối máy chủ: hiện thông báo thân thiện', async () => {
    mockServer(health);
    // Ghi đè bằng adapter báo lỗi mạng (không có phản hồi từ máy chủ)
    api.defaults.adapter = () =>
      Promise.reject(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));
    renderApp('/dang-nhap');

    await userEvent.type(screen.getByLabelText('Email'), 'khach@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Matkhau123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối được máy chủ');
  });

  it('đã đăng nhập mà vào /dang-nhap thì chuyển về trang chủ', async () => {
    tokenStorage.setTokens(session);
    mockServer({ ...health, 'GET /users/me': [200, session.user] });
    renderApp('/dang-nhap');

    expect(await screen.findByRole('heading', { name: 'TechStore' })).toBeInTheDocument();
  });

  it('có liên kết sang trang đăng ký', () => {
    mockServer(health);
    renderApp('/dang-nhap');

    expect(screen.getByRole('link', { name: 'Đăng ký ngay' })).toHaveAttribute('href', '/dang-ky');
  });
});

describe('Trang đăng ký', () => {
  const fillValid = async (overrides = {}) => {
    const values = {
      'Họ và tên': 'Nguyễn Văn A',
      Email: 'khach@example.com',
      'Mật khẩu': 'Matkhau123',
      'Nhập lại mật khẩu': 'Matkhau123',
      ...overrides,
    };
    for (const [label, value] of Object.entries(values)) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
  };

  it('báo lỗi khi để trống các ô bắt buộc', async () => {
    mockServer(health);
    renderApp('/dang-ky');

    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(screen.getByText('Vui lòng nhập họ tên')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập email')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu phải có ít nhất 8 ký tự')).toBeInTheDocument();
  });

  it('từ chối mật khẩu không có chữ số (US-01 AC2)', async () => {
    mockServer(health);
    renderApp('/dang-ky');

    await fillValid({ 'Mật khẩu': 'Matkhaucuatoi', 'Nhập lại mật khẩu': 'Matkhaucuatoi' });
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(screen.getByText('Mật khẩu phải có ít nhất một chữ số')).toBeInTheDocument();
  });

  it('báo lỗi khi nhập lại mật khẩu không khớp', async () => {
    mockServer(health);
    renderApp('/dang-ky');

    await fillValid({ 'Nhập lại mật khẩu': 'Khac12345' });
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(screen.getByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument();
  });

  it('báo lỗi khi số điện thoại sai định dạng', async () => {
    mockServer(health);
    renderApp('/dang-ky');

    await fillValid({ 'Số điện thoại (không bắt buộc)': '123' });
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(screen.getByText('Số điện thoại phải gồm 10 số và bắt đầu bằng 0')).toBeInTheDocument();
  });

  it('đăng ký thành công: không gửi trường phone khi để trống, tự đăng nhập luôn', async () => {
    const calls = mockServer({ ...health, 'POST /auth/register': [201, session] });
    renderApp('/dang-ky');

    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(await screen.findByText('Xin chào, Khách A')).toBeInTheDocument();
    expect(calls).toContainEqual({
      key: 'POST /auth/register',
      body: { fullName: 'Nguyễn Văn A', email: 'khach@example.com', password: 'Matkhau123' },
    });
  });

  it('gửi kèm số điện thoại khi có nhập', async () => {
    const calls = mockServer({ ...health, 'POST /auth/register': [201, session] });
    renderApp('/dang-ky');

    await fillValid({ 'Số điện thoại (không bắt buộc)': '0912345678' });
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await screen.findByText('Xin chào, Khách A');
    expect(calls.find((c) => c.key === 'POST /auth/register').body.phone).toBe('0912345678');
  });

  it('email đã tồn tại: hiện thông báo của máy chủ (US-01 AC4)', async () => {
    mockServer({
      ...health,
      'POST /auth/register': [409, apiError('EMAIL_TAKEN', 'Email này đã được đăng ký')],
    });
    renderApp('/dang-ky');

    await fillValid();
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email này đã được đăng ký');
  });

  it('máy chủ báo lỗi theo ô: hiện ngay dưới ô đó', async () => {
    mockServer({
      ...health,
      'POST /auth/register': [
        400,
        apiError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', {
          email: ['Email không đúng định dạng'],
        }),
      ],
    });
    renderApp('/dang-ky');

    await fillValid({ Email: 'a@b.co' });
    await userEvent.click(screen.getByRole('button', { name: 'Đăng ký' }));

    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription(
      'Email không đúng định dạng',
    );
  });
});
