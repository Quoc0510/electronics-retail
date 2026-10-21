/**
 * @feature [F01] Kiểm thử trang tài khoản: sửa hồ sơ, đổi mật khẩu, sổ địa chỉ (US-04).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { apiError, customer, mockServer, renderApp, session } from '../test/utils.jsx';

const address = {
  id: 10,
  recipientName: 'Nguyễn Văn A',
  phone: '0912345678',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 1',
  ward: 'Phường Bến Nghé',
  street: '1 Lê Duẩn',
  isDefault: true,
};

// Đăng nhập sẵn rồi mở trang tài khoản
const openProfile = async (handlers = {}) => {
  tokenStorage.setTokens(session);
  const calls = mockServer({
    'GET /users/me': [200, customer],
    'GET /users/me/addresses': [200, []],
    ...handlers,
  });
  renderApp('/tai-khoan');
  await screen.findByRole('heading', { name: 'Tài khoản của tôi' });
  return calls;
};

const openTab = (name) => userEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => vi.restoreAllMocks());

describe('Thông tin cá nhân (US-04 AC1)', () => {
  it('hiện sẵn thông tin hiện tại và không cho sửa email', async () => {
    await openProfile();

    expect(screen.getByLabelText('Email')).toHaveValue('khach@example.com');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Họ và tên')).toHaveValue('Khách A');
  });

  it('lưu thay đổi, gửi đúng dữ liệu và cập nhật tên trên thanh trên cùng', async () => {
    const calls = await openProfile({
      'PATCH /users/me': (_config, body) => [200, { ...customer, ...body }],
    });

    await userEvent.clear(screen.getByLabelText('Họ và tên'));
    await userEvent.type(screen.getByLabelText('Họ và tên'), 'Trần Thị B');
    await userEvent.type(screen.getByLabelText('Số điện thoại'), '0987654321');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByRole('status', { name: '' })).toHaveTextContent('Đã lưu thay đổi');
    expect(screen.getByText('Xin chào, Trần Thị B')).toBeInTheDocument();
    expect(calls).toContainEqual({
      key: 'PATCH /users/me',
      body: { fullName: 'Trần Thị B', phone: '0987654321' },
    });
  });

  it('xóa số điện thoại thì gửi null', async () => {
    tokenStorage.setTokens(session);
    const calls = mockServer({
      'GET /users/me': [200, { ...customer, phone: '0912345678' }],
      'PATCH /users/me': (_config, body) => [200, { ...customer, ...body }],
    });
    renderApp('/tai-khoan');
    await screen.findByRole('heading', { name: 'Tài khoản của tôi' });

    await userEvent.clear(screen.getByLabelText('Số điện thoại'));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await screen.findByText('Đã lưu thay đổi');
    expect(calls.find((c) => c.key === 'PATCH /users/me').body.phone).toBeNull();
  });

  it('báo lỗi khi họ tên trống hoặc số điện thoại sai, không gọi API', async () => {
    const calls = await openProfile();

    await userEvent.clear(screen.getByLabelText('Họ và tên'));
    await userEvent.type(screen.getByLabelText('Số điện thoại'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(screen.getByText('Họ tên không được để trống')).toBeInTheDocument();
    expect(screen.getByText('Số điện thoại phải gồm 10 số và bắt đầu bằng 0')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'PATCH /users/me')).toBe(false);
  });
});

describe('Đổi mật khẩu (US-04 AC2)', () => {
  const fill = async (current, next, confirm = next) => {
    await userEvent.type(screen.getByLabelText('Mật khẩu hiện tại'), current);
    await userEvent.type(screen.getByLabelText('Mật khẩu mới'), next);
    await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu mới'), confirm);
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
  };

  it('đổi thành công thì đăng xuất và chuyển về trang đăng nhập kèm thông báo', async () => {
    const calls = await openProfile({
      'PUT /users/me/password': [204, null],
      'POST /auth/logout': [204, null],
    });
    await openTab('Đổi mật khẩu');

    await fill('Matkhau123', 'MatkhauMoi456');

    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Đổi mật khẩu thành công');
    expect(calls).toContainEqual({
      key: 'PUT /users/me/password',
      body: { currentPassword: 'Matkhau123', newPassword: 'MatkhauMoi456' },
    });
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('sai mật khẩu hiện tại: hiện thông báo của máy chủ và vẫn đăng nhập', async () => {
    await openProfile({
      'PUT /users/me/password': [400, apiError('WRONG_PASSWORD', 'Mật khẩu hiện tại không đúng')],
    });
    await openTab('Đổi mật khẩu');

    await fill('SaiMatKhau1', 'MatkhauMoi456');

    expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu hiện tại không đúng');
    expect(screen.getByText('Xin chào, Khách A')).toBeInTheDocument();
  });

  it('báo lỗi khi mật khẩu mới yếu hoặc nhập lại không khớp', async () => {
    await openProfile();
    await openTab('Đổi mật khẩu');

    await fill('Matkhau123', 'yeu');
    expect(screen.getByText('Mật khẩu phải có ít nhất 8 ký tự')).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Mật khẩu mới'));
    await userEvent.type(screen.getByLabelText('Mật khẩu mới'), 'MatkhauMoi456');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(screen.getByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument();
  });
});

describe('Sổ địa chỉ (US-04 AC3)', () => {
  it('chưa có địa chỉ thì hiện gợi ý thêm', async () => {
    await openProfile();
    await openTab('Sổ địa chỉ');

    expect(await screen.findByText(/Bạn chưa có địa chỉ nào/)).toBeInTheDocument();
  });

  it('hiện danh sách và đánh dấu địa chỉ mặc định', async () => {
    await openProfile({
      'GET /users/me/addresses': [
        200,
        [address, { ...address, id: 11, street: '2 Lê Lợi', isDefault: false }],
      ],
    });
    await openTab('Sổ địa chỉ');

    expect(await screen.findByText(/1 Lê Duẩn/)).toBeInTheDocument();
    expect(screen.getAllByText('Mặc định')).toHaveLength(1);
    expect(screen.getByText(/2 Lê Lợi/)).toBeInTheDocument();
  });

  it('thêm địa chỉ mới: kiểm tra dữ liệu rồi gửi lên máy chủ', async () => {
    let stored = [];
    const calls = await openProfile({
      'GET /users/me/addresses': () => [200, stored],
      'POST /users/me/addresses': (_config, body) => {
        stored = [{ ...body, id: 10, isDefault: true }];
        return [201, stored[0]];
      },
    });
    await openTab('Sổ địa chỉ');
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm địa chỉ mới' }));

    // Gửi trống: báo lỗi, không gọi API
    await userEvent.click(screen.getByRole('button', { name: 'Lưu địa chỉ' }));
    expect(screen.getByText('Vui lòng nhập tên người nhận')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /users/me/addresses')).toBe(false);

    await userEvent.type(screen.getByLabelText('Tên người nhận'), 'Nguyễn Văn A');
    await userEvent.type(screen.getByLabelText('Số điện thoại người nhận'), '0912345678');
    await userEvent.type(screen.getByLabelText('Tỉnh/Thành phố'), 'TP. Hồ Chí Minh');
    await userEvent.type(screen.getByLabelText('Quận/Huyện'), 'Quận 1');
    await userEvent.type(screen.getByLabelText('Phường/Xã'), 'Phường Bến Nghé');
    await userEvent.type(screen.getByLabelText('Số nhà, tên đường'), '1 Lê Duẩn');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu địa chỉ' }));

    expect(await screen.findByText(/1 Lê Duẩn/)).toBeInTheDocument();
    expect(calls.find((c) => c.key === 'POST /users/me/addresses').body).toMatchObject({
      recipientName: 'Nguyễn Văn A',
      street: '1 Lê Duẩn',
      isDefault: false,
    });
  });

  it('sửa địa chỉ: form có sẵn dữ liệu cũ và gửi PATCH', async () => {
    const calls = await openProfile({
      'GET /users/me/addresses': [200, [address]],
      'PATCH /users/me/addresses/10': (_config, body) => [200, { ...address, ...body }],
    });
    await openTab('Sổ địa chỉ');
    await userEvent.click(await screen.findByRole('button', { name: 'Sửa' }));

    expect(screen.getByLabelText('Số nhà, tên đường')).toHaveValue('1 Lê Duẩn');
    await userEvent.clear(screen.getByLabelText('Số nhà, tên đường'));
    await userEvent.type(screen.getByLabelText('Số nhà, tên đường'), '99 Nguyễn Huệ');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu địa chỉ' }));

    await screen.findByRole('button', { name: 'Thêm địa chỉ mới' });
    const sent = calls.find((c) => c.key === 'PATCH /users/me/addresses/10').body;
    expect(sent.street).toBe('99 Nguyễn Huệ');
    expect(sent).not.toHaveProperty('id'); // không gửi các trường chỉ đọc lên máy chủ
  });

  it('xóa địa chỉ chỉ khi người dùng xác nhận', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const calls = await openProfile({
      'GET /users/me/addresses': [200, [address]],
      'DELETE /users/me/addresses/10': [204, null],
    });
    await openTab('Sổ địa chỉ');
    await screen.findByText(/1 Lê Duẩn/);

    confirm.mockReturnValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    expect(calls.some((c) => c.key === 'DELETE /users/me/addresses/10')).toBe(false);

    confirm.mockReturnValueOnce(true);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
    await vi.waitFor(() =>
      expect(calls.some((c) => c.key === 'DELETE /users/me/addresses/10')).toBe(true),
    );
  });

  it('đặt địa chỉ khác làm mặc định', async () => {
    const other = { ...address, id: 11, street: '2 Lê Lợi', isDefault: false };
    const calls = await openProfile({
      'GET /users/me/addresses': [200, [address, other]],
      'PATCH /users/me/addresses/11': [200, { ...other, isDefault: true }],
    });
    await openTab('Sổ địa chỉ');
    await screen.findByText(/2 Lê Lợi/);

    const row = screen.getByText(/2 Lê Lợi/).closest('li');
    await userEvent.click(within(row).getByRole('button', { name: 'Đặt làm mặc định' }));

    await vi.waitFor(() =>
      expect(calls).toContainEqual({
        key: 'PATCH /users/me/addresses/11',
        body: { isDefault: true },
      }),
    );
  });

  it('báo lỗi khi tải địa chỉ thất bại', async () => {
    await openProfile({
      'GET /users/me/addresses': [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')],
    });
    await openTab('Sổ địa chỉ');

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
  });
});
