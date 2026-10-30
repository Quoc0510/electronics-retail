/**
 * @feature [F09] Quản lý mã giảm giá - Kiểm thử giao diện Admin: danh sách mã (trạng thái, tìm, lọc), tạo mã, sửa mã và
 * bật/tắt mã (US-24).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

const coupon = (id, overrides = {}) => ({
  id,
  code: `MA${id}`,
  type: 'PERCENT',
  value: 10,
  minOrder: 0,
  startsAt: '2026-10-01T03:00:00.000Z',
  endsAt: '2026-12-01T03:00:00.000Z',
  maxUses: 100,
  usedCount: 4,
  isActive: true,
  state: 'RUNNING',
  createdAt: '2026-10-01T03:00:00.000Z',
  ...overrides,
});

const listPage = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  ...extra,
});

const open = (handlers = {}, route = '/ma-giam-gia') => {
  tokenStorage.setTokens(adminSession);
  const paramsLog = [];
  const calls = mockServer({
    'GET /users/me': [200, admin],
    'GET /admin/coupons': (config) => {
      paramsLog.push(config.params);
      return [
        200,
        listPage([
          coupon(1),
          coupon(2, { type: 'FIXED', value: 200000, minOrder: 1000000, state: 'EXHAUSTED' }),
          coupon(3, { isActive: false, state: 'DISABLED' }),
        ]),
      ];
    },
    ...handlers,
  });
  renderApp(route);
  return { calls, paramsLog };
};

const rowOf = async (code) =>
  (await within(await screen.findByRole('table')).findByText(code)).closest('tr');

const fill = async (label, value) => {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  if (value) await userEvent.type(input, value);
};

describe('Trang mã giảm giá (US-24)', () => {
  it('mục "Mã giảm giá" trong menu dẫn tới trang này', async () => {
    open({}, '/');
    const nav = await screen.findByRole('navigation', { name: 'Menu quản trị' });

    await userEvent.click(within(nav).getByRole('link', { name: 'Mã giảm giá' }));

    expect(
      await screen.findByRole('heading', { name: 'Mã giảm giá', level: 1 }),
    ).toBeInTheDocument();
  });

  it('hiện mức giảm, đơn tối thiểu, số lượt đã dùng và trạng thái của từng mã', async () => {
    open();

    const percent = await rowOf('MA1');
    expect(within(percent).getByText('10%')).toBeInTheDocument();
    expect(within(percent).getByText('Không')).toBeInTheDocument(); // chưa có đơn tối thiểu
    expect(within(percent).getByText('4/100')).toBeInTheDocument();
    expect(within(percent).getByText('Đang chạy')).toBeInTheDocument();

    const fixed = await rowOf('MA2');
    expect(within(fixed).getByText('200.000 ₫')).toBeInTheDocument();
    expect(within(fixed).getByText('1.000.000 ₫')).toBeInTheDocument();
    expect(within(fixed).getByText('Hết lượt')).toBeInTheDocument();

    expect(within(await rowOf('MA3')).getByText('Đã tắt')).toBeInTheDocument();
  });

  it('chưa có mã nào thì báo trống; có lọc mà không khớp thì báo khác', async () => {
    open({ 'GET /admin/coupons': [200, listPage([])] });
    expect(await screen.findByText('Chưa có mã giảm giá nào.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo bật tắt'), 'off');
    expect(await screen.findByText('Không có mã nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('tìm theo mã và lọc bật/tắt gửi đúng tham số, quay về trang 1', async () => {
    const { paramsLog } = open();
    await screen.findByRole('table');

    await userEvent.type(screen.getByLabelText('Tìm mã giảm giá'), 'khai');
    await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ search: 'khai', page: 1 }));

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo bật tắt'), 'on');
    await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ search: 'khai', status: 'on' }));
  });

  it('lỗi tải danh sách có nút Thử lại', async () => {
    let attempts = 0;
    open({
      'GET /admin/coupons': () => {
        attempts += 1;
        return attempts === 1
          ? [500, apiError('INTERNAL_ERROR', 'Máy chủ gặp sự cố')]
          : [200, listPage([coupon(1)])];
      },
    });

    expect(await screen.findByText('Máy chủ gặp sự cố')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await rowOf('MA1')).toBeInTheDocument();
  });
});

describe('Tạo mã giảm giá (US-24 AC1)', () => {
  it('điền đủ thông tin thì gửi đúng dữ liệu và đóng form', async () => {
    const { calls } = open({
      'POST /admin/coupons': [201, coupon(9, { code: 'KHAITRUONG' })],
    });
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: /Thêm mã giảm giá/ }));
    await fill('Mã giảm giá', 'KHAITRUONG');
    await fill('Mức giảm (%)', '15');
    await fill('Đơn tối thiểu (₫)', '500000');
    await fill('Số lượt dùng tối đa', '50');
    await fill('Bắt đầu', '2026-11-01T08:00');
    await fill('Kết thúc', '2026-11-30T23:00');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mã' }));

    await waitFor(() => expect(calls.some((c) => c.key === 'POST /admin/coupons')).toBe(true));
    const sent = calls.find((c) => c.key === 'POST /admin/coupons').body;
    expect(sent).toMatchObject({
      code: 'KHAITRUONG',
      type: 'PERCENT',
      value: 15,
      minOrder: 500000,
      maxUses: 50,
    });
    // Ngày gửi lên là giờ chuẩn quốc tế (ISO) và ngày kết thúc sau ngày bắt đầu
    expect(new Date(sent.endsAt) > new Date(sent.startsAt)).toBe(true);
    expect(sent.startsAt).toMatch(/Z$/);
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Thêm mã giảm giá' })).not.toBeInTheDocument(),
    );
  });

  it('chọn giảm số tiền thì nhãn đổi sang ₫', async () => {
    open();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /Thêm mã giảm giá/ }));

    expect(screen.getByLabelText('Mức giảm (%)')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Loại giảm'), 'FIXED');
    expect(screen.getByLabelText('Số tiền giảm (₫)')).toBeInTheDocument();
  });

  it('kiểm tra dữ liệu trước khi gửi: mã, mức giảm, lượt, thời hạn', async () => {
    const { calls } = open();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /Thêm mã giảm giá/ }));

    await fill('Mã giảm giá', 'a b');
    await fill('Mức giảm (%)', '150');
    await fill('Số lượt dùng tối đa', '0');
    await fill('Bắt đầu', '2026-11-10T08:00');
    await fill('Kết thúc', '2026-11-01T08:00');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mã' }));

    expect(await screen.findByText(/Mã gồm 3-30 ký tự/)).toBeInTheDocument();
    expect(screen.getByText('Giảm theo phần trăm không được quá 100%')).toBeInTheDocument();
    expect(screen.getByText('Số lượt tối đa phải là số nguyên từ 1')).toBeInTheDocument();
    expect(screen.getByText('Ngày kết thúc phải sau ngày bắt đầu')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /admin/coupons')).toBe(false);
  });

  it('mã trùng: hiện lỗi từ máy chủ và giữ form để sửa', async () => {
    open({
      'POST /admin/coupons': [409, apiError('COUPON_EXISTS', 'Mã giảm giá này đã tồn tại')],
    });
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /Thêm mã giảm giá/ }));
    await fill('Mã giảm giá', 'MA1');
    await fill('Mức giảm (%)', '10');
    await userEvent.click(screen.getByRole('button', { name: 'Tạo mã' }));

    expect(await screen.findByText('Mã giảm giá này đã tồn tại')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Thêm mã giảm giá' })).toBeInTheDocument();
  });

  it('nút Hủy đóng form mà không gửi gì', async () => {
    const { calls } = open();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /Thêm mã giảm giá/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));

    expect(screen.queryByRole('form', { name: 'Thêm mã giảm giá' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /admin/coupons')).toBe(false);
  });
});

describe('Sửa và bật/tắt mã giảm giá (US-24 AC2)', () => {
  it('sửa mã: điền sẵn giá trị cũ, không đổi được mã, gửi PATCH rồi đóng form', async () => {
    const { calls } = open({ 'PATCH /admin/coupons/1': [200, coupon(1, { value: 20 })] });
    await userEvent.click(
      await within(await rowOf('MA1')).findByRole('button', { name: 'Sửa mã MA1' }),
    );

    const form = screen.getByRole('form', { name: 'Sửa mã MA1' });
    expect(within(form).getByLabelText('Mã giảm giá')).toBeDisabled();
    expect(within(form).getByLabelText('Mức giảm (%)')).toHaveValue('10');
    expect(within(form).getByLabelText('Số lượt dùng tối đa')).toHaveValue('100');
    expect(within(form).getByText(/Đã dùng 4 lượt/)).toBeInTheDocument();

    await fill('Mức giảm (%)', '20');
    await userEvent.click(within(form).getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /admin/coupons/1')).toBe(true));
    const sent = calls.find((c) => c.key === 'PATCH /admin/coupons/1').body;
    expect(sent).toMatchObject({ type: 'PERCENT', value: 20, maxUses: 100 });
    expect(sent).not.toHaveProperty('code'); // mã không đổi được
    await waitFor(() =>
      expect(screen.queryByRole('form', { name: 'Sửa mã MA1' })).not.toBeInTheDocument(),
    );
  });

  it('đặt lượt tối đa thấp hơn số đã dùng: hiện lỗi của máy chủ', async () => {
    open({
      'PATCH /admin/coupons/1': [
        409,
        apiError('COUPON_MAX_USES_TOO_LOW', 'Số lượt tối đa không được nhỏ hơn số lượt đã dùng'),
      ],
    });
    await userEvent.click(
      await within(await rowOf('MA1')).findByRole('button', { name: 'Sửa mã MA1' }),
    );
    await fill('Số lượt dùng tối đa', '2');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(
      await screen.findByText('Số lượt tối đa không được nhỏ hơn số lượt đã dùng'),
    ).toBeInTheDocument();
  });

  it('tắt mã đang bật gửi isActive=false; bật lại mã đã tắt gửi isActive=true', async () => {
    const { calls } = open({
      'PATCH /admin/coupons/1': [200, coupon(1, { isActive: false })],
      'PATCH /admin/coupons/3': [200, coupon(3)],
    });

    await userEvent.click(
      await within(await rowOf('MA1')).findByRole('button', { name: 'Tắt mã MA1' }),
    );
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /admin/coupons/1')).toBe(true));
    expect(calls.find((c) => c.key === 'PATCH /admin/coupons/1').body).toEqual({ isActive: false });

    await userEvent.click(
      await within(await rowOf('MA3')).findByRole('button', { name: 'Bật mã MA3' }),
    );
    await waitFor(() => expect(calls.some((c) => c.key === 'PATCH /admin/coupons/3')).toBe(true));
    expect(calls.find((c) => c.key === 'PATCH /admin/coupons/3').body).toEqual({ isActive: true });
  });

  it('tắt mã bị lỗi thì báo lỗi', async () => {
    open({
      'PATCH /admin/coupons/1': [500, apiError('INTERNAL_ERROR', 'Không cập nhật được mã')],
    });
    await userEvent.click(
      await within(await rowOf('MA1')).findByRole('button', { name: 'Tắt mã MA1' }),
    );

    expect(await screen.findByText('Không cập nhật được mã')).toBeInTheDocument();
  });
});
