/**
 * @feature [F10] Quản lý người dùng - Kiểm thử giao diện Admin: danh sách người dùng (tìm, lọc, phân trang),
 * khóa và mở khóa tài khoản, không khóa được chính mình (US-27).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// Dữ liệu giả
// ---------------------------------------------------------------------------
const row = (id, overrides = {}) => ({
  id,
  email: `nguoi${id}@example.com`,
  fullName: `Người dùng ${id}`,
  phone: null,
  role: 'CUSTOMER',
  isActive: true,
  points: 0,
  createdAt: '2026-10-20T03:00:00.000Z',
  orderCount: 0,
  ...overrides,
});

const selfRow = row(admin.id, {
  email: admin.email,
  fullName: admin.fullName,
  role: 'ADMIN',
});

const listPage = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  ...extra,
});

const open = (handlers = {}, route = '/nguoi-dung') => {
  tokenStorage.setTokens(adminSession);
  const paramsLog = [];
  const calls = mockServer({
    'GET /users/me': [200, admin],
    'GET /admin/users': (config) => {
      paramsLog.push(config.params);
      return [200, listPage([selfRow, row(1), row(3, { isActive: false })])];
    },
    ...handlers,
  });
  renderApp(route);
  return { calls, paramsLog };
};

// Tìm trong bảng, vì email của chính Admin cũng hiện ở thanh bên
const rowOf = async (email) =>
  (await within(await screen.findByRole('table')).findByText(email)).closest('tr');

// ---------------------------------------------------------------------------
// Danh sách (US-27 AC1)
// ---------------------------------------------------------------------------
describe('Trang người dùng (US-27 AC1)', () => {
  it('mục "Người dùng" trong menu dẫn tới trang này', async () => {
    open({}, '/');
    const nav = await screen.findByRole('navigation', { name: 'Menu quản trị' });

    await userEvent.click(within(nav).getByRole('link', { name: 'Người dùng' }));

    expect(await screen.findByRole('heading', { name: 'Người dùng' })).toBeInTheDocument();
  });

  it('hiện thông tin từng người: tên, email, điện thoại, số đơn, điểm, trạng thái', async () => {
    open({
      'GET /admin/users': [
        200,
        listPage([
          row(1, { phone: '0912345678', orderCount: 3, points: 58 }),
          row(3, { isActive: false }),
        ]),
      ],
    });

    const active = await rowOf('nguoi1@example.com');
    expect(active).toHaveTextContent('Người dùng 1');
    expect(active).toHaveTextContent('0912345678');
    expect(within(active).getAllByRole('cell')[2]).toHaveTextContent('3');
    expect(within(active).getAllByRole('cell')[3]).toHaveTextContent('58');
    expect(within(active).getByText('Hoạt động')).toBeInTheDocument();
    const locked = await rowOf('nguoi3@example.com');
    expect(locked).toHaveTextContent('Đã khóa');
    expect(within(locked).getAllByRole('cell')[1]).toHaveTextContent('–');
  });

  it('đánh dấu quản trị viên bằng nhãn riêng', async () => {
    open();

    const self = await rowOf(admin.email);
    expect(within(self).getByText('Quản trị viên', { selector: 'span' })).toBeInTheDocument();
    expect(within(await rowOf('nguoi1@example.com')).queryByText('Quản trị viên')).toBeNull();
  });

  it('tải trang đầu với page=1, pageSize=10 và không có bộ lọc', async () => {
    const { paramsLog } = open();
    await rowOf('nguoi1@example.com');

    expect(paramsLog[0]).toEqual({ page: 1, pageSize: 10 });
  });

  it('gõ từ khóa thì tìm sau khi ngừng gõ (đã cắt khoảng trắng) và về trang 1', async () => {
    const { paramsLog } = open();
    await rowOf('nguoi1@example.com');

    await userEvent.type(screen.getByLabelText('Tìm người dùng'), '  van.a  ');

    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ page: 1, pageSize: 10, search: 'van.a' }),
    );
    // Không gửi một request cho mỗi ký tự gõ
    expect(paramsLog.filter((params) => params.search).length).toBe(1);
  });

  it('lọc theo trạng thái gửi tham số status', async () => {
    const { paramsLog } = open();
    await rowOf('nguoi1@example.com');

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo trạng thái tài khoản'), 'locked');

    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ page: 1, pageSize: 10, status: 'locked' }),
    );
  });

  it('phân trang: Trang sau gửi page=2, Trang trước quay về; nút bị khóa ở hai đầu', async () => {
    const { paramsLog } = open({
      'GET /admin/users': (config) => {
        paramsLog.push(config.params);
        return [
          200,
          listPage([row(config.params.page + 10)], { total: 25, page: config.params.page }),
        ];
      },
    });
    await rowOf('nguoi11@example.com');
    expect(screen.getByText('Tổng 25 người dùng · Trang 1/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await rowOf('nguoi12@example.com');
    expect(paramsLog.at(-1).page).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
    await rowOf('nguoi13@example.com');
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Trang trước' }));
    await rowOf('nguoi12@example.com');
  });

  it('không có kết quả: báo khác nhau khi đang lọc và khi chưa có ai', async () => {
    open({ 'GET /admin/users': [200, listPage([])] });
    expect(await screen.findByText('Chưa có người dùng nào.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Tìm người dùng'), 'zzz');

    expect(await screen.findByText('Không có người dùng nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('lỗi tải danh sách: báo lỗi và Thử lại tải lại được', async () => {
    let attempts = 0;
    open({
      'GET /admin/users': () => {
        attempts += 1;
        return attempts === 1
          ? [500, apiError('INTERNAL_ERROR', 'Không tải được danh sách')]
          : [200, listPage([row(1)])];
      },
    });
    expect(await screen.findByText('Không tải được danh sách')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await rowOf('nguoi1@example.com')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Khóa / mở khóa (US-27 AC2, AC3)
// ---------------------------------------------------------------------------
describe('Khóa và mở khóa tài khoản (US-27)', () => {
  it('AC3: dòng của chính mình không có nút khóa, chỉ ghi chú "Tài khoản của bạn"', async () => {
    open();

    const self = await rowOf(admin.email);
    expect(within(self).queryByRole('button')).toBeNull();
    expect(within(self).getByText('Tài khoản của bạn')).toBeInTheDocument();
    // Người khác thì có nút
    expect(
      within(await rowOf('nguoi1@example.com')).getByRole('button', {
        name: /Khóa tài khoản nguoi1/,
      }),
    ).toBeInTheDocument();
  });

  it('khóa: hỏi xác nhận (nói rõ hậu quả), đồng ý thì PATCH isActive=false rồi tải lại danh sách', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    let locked = false;
    const { calls } = open({
      'GET /admin/users': () => [200, listPage([selfRow, row(1, { isActive: !locked })])],
      'PATCH /admin/users/1/status': () => {
        locked = true;
        return [200, row(1, { isActive: false })];
      },
    });

    await userEvent.click(
      within(await rowOf('nguoi1@example.com')).getByRole('button', {
        name: /Khóa tài khoản nguoi1/,
      }),
    );

    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toMatch(/nguoi1@example\.com.*đăng xuất khỏi mọi thiết bị/);
    await waitFor(async () =>
      expect(within(await rowOf('nguoi1@example.com')).getByText('Đã khóa')).toBeInTheDocument(),
    );
    expect(calls.find((call) => call.key === 'PATCH /admin/users/1/status').body).toEqual({
      isActive: false,
    });
    expect(
      within(await rowOf('nguoi1@example.com')).getByRole('button', { name: /Mở khóa tài khoản/ }),
    ).toBeInTheDocument();
  });

  it('khóa: không đồng ý xác nhận thì không gửi gì', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { calls } = open();

    await userEvent.click(
      within(await rowOf('nguoi1@example.com')).getByRole('button', {
        name: /Khóa tài khoản nguoi1/,
      }),
    );

    expect(calls.some((call) => call.key.startsWith('PATCH'))).toBe(false);
  });

  it('mở khóa: không cần hỏi, PATCH isActive=true', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { calls } = open({
      'PATCH /admin/users/3/status': [200, row(3, { isActive: true })],
    });

    await userEvent.click(
      within(await rowOf('nguoi3@example.com')).getByRole('button', {
        name: /Mở khóa tài khoản nguoi3/,
      }),
    );

    await waitFor(() =>
      expect(calls.find((call) => call.key === 'PATCH /admin/users/3/status').body).toEqual({
        isActive: true,
      }),
    );
    expect(confirm).not.toHaveBeenCalled();
  });

  it('máy chủ từ chối thì hiện lỗi và trạng thái trong bảng không đổi', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    open({
      'PATCH /admin/users/1/status': [
        400,
        apiError('CANNOT_LOCK_SELF', 'Bạn không thể khóa chính tài khoản của mình'),
      ],
    });

    await userEvent.click(
      within(await rowOf('nguoi1@example.com')).getByRole('button', {
        name: /Khóa tài khoản nguoi1/,
      }),
    );

    expect(
      await screen.findByText('Bạn không thể khóa chính tài khoản của mình'),
    ).toBeInTheDocument();
    expect(within(await rowOf('nguoi1@example.com')).getByText('Hoạt động')).toBeInTheDocument();
  });
});
