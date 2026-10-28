/**
 * @feature [F07][F13] Quản lý đơn hàng - Kiểm thử giao diện Admin: danh sách đơn (lọc, tìm, phân trang), chi tiết đơn,
 * đổi trạng thái theo luồng hợp lệ, hủy đơn có lý do, in phiếu và thẻ đơn chờ xác nhận ở trang tổng quan (US-19, US-20).
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
const listItem = (n, overrides = {}) => ({
  id: n,
  code: `TS26102${n}-ABCD`,
  status: 'PENDING',
  paymentStatus: 'UNPAID',
  total: 2030000,
  createdAt: '2026-10-28T06:00:00.000Z',
  recipientName: `Người nhận ${n}`,
  itemCount: 3,
  items: [{ productName: `Sản phẩm ${n}`, quantity: 2, thumbnail: null }],
  moreItems: 0,
  customer: { id: n, fullName: `Khách ${n}`, email: `khach${n}@example.com` },
  ...overrides,
});

const page = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  ...extra,
});

const detail = (overrides = {}) => ({
  id: 1,
  code: 'TS261028-ABCD',
  status: 'PENDING',
  paymentMethod: 'COD',
  paymentStatus: 'UNPAID',
  subtotal: 2000000,
  shippingFee: 30000,
  total: 2030000,
  recipientName: 'Nguyễn Văn A',
  phone: '0912345678',
  shippingAddress: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  note: 'Gọi trước khi giao',
  cancelReason: null,
  createdAt: '2026-10-28T06:00:00.000Z',
  customer: { id: 5, fullName: 'Khách Hàng A', email: 'khach@example.com', phone: null },
  allowedNext: ['CONFIRMED', 'CANCELLED'],
  items: [
    {
      id: 1,
      productId: 101,
      productName: 'Sản phẩm 1',
      productSku: 'SKU-1',
      unitPrice: 1000000,
      quantity: 2,
      lineTotal: 2000000,
      slug: 'san-pham-1',
      thumbnail: null,
    },
  ],
  history: [
    {
      status: 'PENDING',
      note: 'Đơn hàng được tạo',
      createdAt: '2026-10-28T06:00:00.000Z',
      changedBy: { fullName: 'Khách Hàng A', role: 'CUSTOMER' },
    },
  ],
  ...overrides,
});

const signIn = () => tokenStorage.setTokens(adminSession);

const base = { 'GET /users/me': [200, admin], 'GET /health': [200, { status: 'ok' }] };

// ---------------------------------------------------------------------------
// Danh sách đơn
// ---------------------------------------------------------------------------
describe('Trang danh sách đơn hàng (US-19 AC1)', () => {
  const openList = async (extra = {}) => {
    signIn();
    const paramsLog = [];
    const calls = mockServer({
      ...base,
      'GET /admin/orders': (config) => {
        paramsLog.push(config.params);
        return [
          200,
          page([listItem(1), listItem(2, { status: 'SHIPPING', paymentStatus: 'UNPAID' })]),
        ];
      },
      ...extra,
    });
    renderApp('/don-hang');
    await screen.findByRole('heading', { name: 'Đơn hàng', level: 1 });
    return { calls, paramsLog };
  };

  it('có mục Đơn hàng trong menu và hiện bảng đơn với đủ cột', async () => {
    await openList();

    expect(
      within(screen.getByRole('navigation', { name: 'Menu quản trị' })).getByRole('link', {
        name: 'Đơn hàng',
      }),
    ).toHaveAttribute('aria-current', 'page');
    const link = await screen.findByRole('link', { name: 'TS261021-ABCD' });
    expect(link).toHaveAttribute('href', '/don-hang/TS261021-ABCD');
    const row = link.closest('tr');
    expect(row).toHaveTextContent('Người nhận 1');
    expect(row).toHaveTextContent('khach1@example.com');
    expect(row).toHaveTextContent('3 sản phẩm');
    expect(row).toHaveTextContent('2.030.000 ₫');
    expect(row).toHaveTextContent('Chờ xác nhận');
    expect(row).toHaveTextContent('Chưa thanh toán');
    expect(screen.getByText('Đang giao hàng', { selector: 'span' })).toBeInTheDocument();
  });

  it('mặc định gửi trang 1, 10 đơn mỗi trang, không lọc', async () => {
    const { paramsLog } = await openList();

    await screen.findByRole('link', { name: 'TS261021-ABCD' });
    expect(paramsLog[0]).toEqual({ page: 1, pageSize: 10 });
  });

  it('chọn trạng thái thì lọc theo trạng thái đó', async () => {
    const { paramsLog } = await openList();

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo trạng thái'), 'Đã xác nhận');

    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ page: 1, pageSize: 10, status: 'CONFIRMED' }),
    );
  });

  it('gõ từ khóa thì tìm sau khi ngừng gõ và về trang 1', async () => {
    const { paramsLog } = await openList();

    await userEvent.type(screen.getByLabelText('Tìm đơn hàng'), '  ts2610  ');

    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ page: 1, pageSize: 10, search: 'ts2610' }),
    );
  });

  it('phân trang: bấm Trang sau sang trang kế tiếp, nút Trang trước dùng được', async () => {
    await openList({
      'GET /admin/orders': (config) => [
        200,
        page([listItem(1)], { total: 25, page: config.params.page }),
      ],
    });
    await screen.findByText('Tổng 25 đơn hàng · Trang 1/3');

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));

    expect(await screen.findByText('Tổng 25 đơn hàng · Trang 2/3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeEnabled();
  });

  it('chưa có đơn: báo chưa có; có lọc mà không khớp: báo không khớp bộ lọc', async () => {
    await openList({ 'GET /admin/orders': [200, page([])] });
    expect(await screen.findByText('Chưa có đơn hàng nào.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo trạng thái'), 'Đã hủy');
    expect(await screen.findByText('Không có đơn hàng nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('lỗi tải: hiện thông báo, Thử lại tải được lại', async () => {
    signIn();
    let attempts = 0;
    mockServer({
      ...base,
      'GET /admin/orders': () => {
        attempts += 1;
        return attempts === 1
          ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')]
          : [200, page([listItem(1)])];
      },
    });
    renderApp('/don-hang');

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Lỗi máy chủ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByRole('link', { name: 'TS261021-ABCD' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Chi tiết và xử lý đơn
// ---------------------------------------------------------------------------
describe('Trang chi tiết đơn hàng', () => {
  const openDetail = async (current = detail(), extra = {}) => {
    signIn();
    const calls = mockServer({
      ...base,
      'GET /admin/orders/TS261028-ABCD': [200, current],
      ...extra,
    });
    renderApp('/don-hang/TS261028-ABCD');
    await screen.findByRole('heading', { name: 'Đơn TS261028-ABCD', level: 1 });
    return calls;
  };

  it('hiện khách hàng, địa chỉ, ghi chú, thanh toán, sản phẩm, tổng tiền và lịch sử kèm người thực hiện', async () => {
    await openDetail();

    expect(screen.getByText('Khách Hàng A')).toBeInTheDocument();
    expect(screen.getByText('khach@example.com')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A · 0912345678')).toBeInTheDocument();
    expect(
      screen.getByText('12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'),
    ).toBeInTheDocument();
    expect(screen.getByText('Ghi chú của khách: Gọi trước khi giao')).toBeInTheDocument();
    expect(screen.getByText(/Thanh toán khi nhận hàng \(COD\)/)).toBeInTheDocument();
    expect(screen.getByText('Chưa thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm 1')).toBeInTheDocument();
    expect(screen.getByText('Mã: SKU-1')).toBeInTheDocument();
    expect(screen.getByText('2.030.000 ₫')).toBeInTheDocument();
    const history = screen.getByRole('heading', { name: 'Lịch sử đơn hàng' }).closest('section');
    expect(history).toHaveTextContent('Chờ xác nhận');
    expect(history).toHaveTextContent('Khách Hàng A');
    expect(history).toHaveTextContent('Đơn hàng được tạo');
  });

  it('chỉ hiện nút của bước hợp lệ: đơn chờ xác nhận có "Xác nhận đơn" và "Hủy đơn"', async () => {
    await openDetail();

    expect(screen.getByRole('button', { name: 'Xác nhận đơn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy đơn' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bắt đầu giao hàng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hoàn thành/ })).not.toBeInTheDocument();
  });

  it.each([
    ['CONFIRMED', ['SHIPPING', 'CANCELLED'], ['Bắt đầu giao hàng', 'Hủy đơn']],
    ['SHIPPING', ['COMPLETED'], ['Hoàn thành (đã thu tiền)']],
  ])('đơn đang %s: hiện đúng các nút tiếp theo', async (status, allowedNext, labels) => {
    await openDetail(detail({ status, allowedNext }));

    for (const label of labels)
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xác nhận đơn' })).not.toBeInTheDocument();
  });

  it.each(['COMPLETED', 'CANCELLED'])(
    'đơn đã %s thì không có nút xử lý, chỉ báo đã kết thúc',
    async (status) => {
      await openDetail(detail({ status, allowedNext: [], cancelReason: null }));

      expect(screen.getByText(/không thể đổi trạng thái/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Hủy đơn' })).not.toBeInTheDocument();
    },
  );

  it('bấm "Xác nhận đơn": gửi trạng thái mới và hiện đơn đã cập nhật (nút bước kế tiếp, lịch sử)', async () => {
    const confirmed = detail({
      status: 'CONFIRMED',
      allowedNext: ['SHIPPING', 'CANCELLED'],
      history: [
        ...detail().history,
        {
          status: 'CONFIRMED',
          note: null,
          createdAt: '2026-10-28T07:00:00.000Z',
          changedBy: { fullName: 'Quản trị viên', role: 'ADMIN' },
        },
      ],
    });
    const calls = await openDetail(detail(), {
      'PATCH /admin/orders/TS261028-ABCD/status': [200, confirmed],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đơn' }));

    expect(await screen.findByRole('button', { name: 'Bắt đầu giao hàng' })).toBeInTheDocument();
    expect(calls).toContainEqual({
      key: 'PATCH /admin/orders/TS261028-ABCD/status',
      body: { status: 'CONFIRMED' },
    });
    expect(screen.queryByRole('button', { name: 'Xác nhận đơn' })).not.toBeInTheDocument();
    const history = screen.getByRole('heading', { name: 'Lịch sử đơn hàng' }).closest('section');
    expect(history).toHaveTextContent('Quản trị viên');
  });

  it('ghi chú nhập trước được gửi kèm (đã cắt khoảng trắng) và ô ghi chú được làm trống', async () => {
    const calls = await openDetail(detail(), {
      'PATCH /admin/orders/TS261028-ABCD/status': [
        200,
        detail({ status: 'CONFIRMED', allowedNext: ['SHIPPING'] }),
      ],
    });

    await userEvent.type(screen.getByLabelText(/Ghi chú vào lịch sử/), '  Đã gọi xác nhận  ');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đơn' }));

    await screen.findByRole('button', { name: 'Bắt đầu giao hàng' });
    expect(calls).toContainEqual({
      key: 'PATCH /admin/orders/TS261028-ABCD/status',
      body: { status: 'CONFIRMED', note: 'Đã gọi xác nhận' },
    });
    expect(screen.getByLabelText(/Ghi chú vào lịch sử/)).toHaveValue('');
  });

  it('hoàn thành đơn: hiện "Đã thanh toán" (BR-08) và hết nút xử lý', async () => {
    const done = detail({ status: 'COMPLETED', paymentStatus: 'PAID', allowedNext: [] });
    await openDetail(detail({ status: 'SHIPPING', allowedNext: ['COMPLETED'] }), {
      'PATCH /admin/orders/TS261028-ABCD/status': [200, done],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Hoàn thành (đã thu tiền)' }));

    expect(await screen.findByText('Đã thanh toán')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Hoàn thành (đã thu tiền)' }),
    ).not.toBeInTheDocument();
  });

  it('máy chủ từ chối bước sai (400): hiện lý do và các nút vẫn dùng lại được', async () => {
    await openDetail(detail(), {
      'PATCH /admin/orders/TS261028-ABCD/status': [
        400,
        apiError('INVALID_TRANSITION', 'Không thể chuyển đơn hàng từ "CANCELLED" sang "CONFIRMED"'),
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đơn' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể chuyển đơn hàng');
    expect(screen.getByRole('button', { name: 'Xác nhận đơn' })).toBeEnabled();
  });

  describe('hủy đơn', () => {
    const cancelled = detail({
      status: 'CANCELLED',
      allowedNext: [],
      cancelReason: 'Hết hàng thực tế tại kho',
      history: [
        ...detail().history,
        {
          status: 'CANCELLED',
          note: 'Cửa hàng hủy đơn: Hết hàng thực tế tại kho',
          createdAt: '2026-10-28T07:00:00.000Z',
          changedBy: { fullName: 'Quản trị viên', role: 'ADMIN' },
        },
      ],
    });

    it('bấm "Hủy đơn" mở form bắt buộc lý do; để trống thì báo lỗi và không gửi', async () => {
      const calls = await openDetail();

      await userEvent.click(screen.getByRole('button', { name: 'Hủy đơn' }));
      const form = screen.getByRole('form', { name: 'Hủy đơn' });
      await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));

      expect(await within(form).findByRole('alert')).toHaveTextContent(
        'Vui lòng nhập lý do hủy đơn',
      );
      expect(calls.some((c) => c.key.startsWith('PATCH'))).toBe(false);

      await userEvent.type(within(form).getByLabelText('Lý do hủy đơn'), 'ab');
      await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));
      expect(within(form).getByRole('alert')).toHaveTextContent('ít nhất 3 ký tự');
    });

    it('gửi lý do (đã cắt khoảng trắng), đơn chuyển sang Đã hủy kèm lý do và lịch sử', async () => {
      const calls = await openDetail(detail(), {
        'PATCH /admin/orders/TS261028-ABCD/status': [200, cancelled],
      });

      await userEvent.click(screen.getByRole('button', { name: 'Hủy đơn' }));
      const form = screen.getByRole('form', { name: 'Hủy đơn' });
      await userEvent.type(
        within(form).getByLabelText('Lý do hủy đơn'),
        '  Hết hàng thực tế tại kho  ',
      );
      await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));

      expect(await screen.findByText(/Đơn đã hủy\./)).toBeInTheDocument();
      expect(calls).toContainEqual({
        key: 'PATCH /admin/orders/TS261028-ABCD/status',
        body: { status: 'CANCELLED', note: 'Hết hàng thực tế tại kho' },
      });
      expect(screen.getByText('Cửa hàng hủy đơn: Hết hàng thực tế tại kho')).toBeInTheDocument();
      expect(screen.queryByRole('form', { name: 'Hủy đơn' })).not.toBeInTheDocument();
    });

    it('"Không hủy" đóng form và không gửi gì', async () => {
      const calls = await openDetail();

      await userEvent.click(screen.getByRole('button', { name: 'Hủy đơn' }));
      await userEvent.click(screen.getByRole('button', { name: 'Không hủy' }));

      expect(screen.queryByRole('form', { name: 'Hủy đơn' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Xác nhận đơn' })).toBeInTheDocument();
      expect(calls.some((c) => c.key.startsWith('PATCH'))).toBe(false);
    });
  });

  it('in phiếu: nút gọi hộp thoại in của trình duyệt; có đầu phiếu cửa hàng dành riêng cho bản in', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await openDetail();

    await userEvent.click(screen.getByRole('button', { name: 'In phiếu' }));

    expect(print).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Phiếu đơn hàng')).toBeInTheDocument();
    // Thanh bên, các nút xử lý và lịch sử bị ẩn khi in bằng lớp print:hidden
    expect(screen.getByRole('navigation', { name: 'Menu quản trị' }).closest('aside')).toHaveClass(
      'print:hidden',
    );
    expect(screen.getByRole('button', { name: 'In phiếu' })).toHaveClass('print:hidden');
  });

  it('mã không tồn tại (404) hoặc sai định dạng (400): báo không tìm thấy kèm lối về danh sách', async () => {
    signIn();
    mockServer({
      ...base,
      'GET /admin/orders/TS261028-ZZZZ': [
        404,
        apiError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng'),
      ],
    });
    renderApp('/don-hang/TS261028-ZZZZ');

    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy đơn hàng' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về danh sách đơn hàng' })).toHaveAttribute(
      'href',
      '/don-hang',
    );
  });

  it('lỗi máy chủ: báo lỗi, Thử lại tải được lại', async () => {
    signIn();
    let attempts = 0;
    mockServer({
      ...base,
      'GET /admin/orders/TS261028-ABCD': () => {
        attempts += 1;
        return attempts <= 2 ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] : [200, detail()];
      },
    });
    renderApp('/don-hang/TS261028-ABCD');

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Lỗi máy chủ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByRole('heading', { name: 'Đơn TS261028-ABCD' })).toBeInTheDocument();
  });

  it('đặt tiêu đề tab trình duyệt theo mã đơn', async () => {
    await openDetail();

    await waitFor(() => expect(document.title).toBe('Đơn TS261028-ABCD - TechStore Admin'));
  });
});

// ---------------------------------------------------------------------------
// Tổng quan
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// [F13] Đơn của khách không đăng nhập và điểm thành viên
// ---------------------------------------------------------------------------
describe('Đơn của khách không đăng nhập (F13)', () => {
  const guestDetail = (overrides = {}) =>
    detail({
      customer: null,
      isGuest: true,
      pointsEarned: 0,
      pointsExpected: 0,
      history: [
        {
          status: 'PENDING',
          note: 'Đơn hàng được tạo (khách không đăng nhập)',
          createdAt: '2026-10-28T06:00:00.000Z',
          changedBy: null,
        },
      ],
      ...overrides,
    });

  const openDetail = async (current) => {
    signIn();
    mockServer({ ...base, 'GET /admin/orders/TS261028-ABCD': [200, current] });
    renderApp('/don-hang/TS261028-ABCD');
    await screen.findByRole('heading', { name: 'Đơn TS261028-ABCD', level: 1 });
  };

  it('danh sách ghi "Khách không đăng nhập" thay vì email', async () => {
    signIn();
    mockServer({
      ...base,
      'GET /admin/orders': [
        200,
        page([
          listItem(1, { customer: undefined, isGuest: true }),
          listItem(2, { isGuest: false }),
        ]),
      ],
    });
    renderApp('/don-hang');

    const guestRow = (await screen.findByRole('link', { name: 'TS261021-ABCD' })).closest('tr');
    const memberRow = screen.getByRole('link', { name: 'TS261022-ABCD' }).closest('tr');
    expect(guestRow).toHaveTextContent('Người nhận 1');
    expect(guestRow).toHaveTextContent('Khách không đăng nhập');
    expect(memberRow).toHaveTextContent('khach2@example.com');
    expect(memberRow).not.toHaveTextContent('Khách không đăng nhập');
  });

  it('chi tiết không vỡ khi không có tài khoản: ghi rõ không tích điểm, vẫn có địa chỉ và số điện thoại giao hàng', async () => {
    await openDetail(guestDetail());

    const card = screen.getByRole('heading', { name: 'Khách hàng' }).closest('section');
    expect(card).toHaveTextContent('Khách không đăng nhập');
    expect(card).toHaveTextContent('không tích điểm');
    expect(screen.getByText('Nguyễn Văn A · 0912345678')).toBeInTheDocument();
    // Vẫn xử lý đơn như bình thường
    expect(screen.getByRole('button', { name: 'Xác nhận đơn' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy đơn' })).toBeInTheDocument();
  });

  it('thành viên: hiện điểm hiện có và điểm đơn này sẽ cộng khi hoàn thành (BR-15)', async () => {
    await openDetail(
      detail({
        customer: {
          id: 5,
          fullName: 'Khách Hàng A',
          email: 'khach@example.com',
          phone: null,
          points: 120,
        },
        isGuest: false,
        pointsEarned: 0,
        pointsExpected: 200,
      }),
    );

    const card = screen.getByRole('heading', { name: 'Khách hàng' }).closest('section');
    expect(card).toHaveTextContent('Điểm thành viên hiện có: 120');
    expect(card).toHaveTextContent('Đơn này sẽ cộng 200 điểm khi hoàn thành');
    expect(card).not.toHaveTextContent('không tích điểm');
  });

  it('đơn thành viên đã hoàn thành: hiện số điểm đã cộng', async () => {
    await openDetail(
      detail({
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        allowedNext: [],
        customer: {
          id: 5,
          fullName: 'Khách Hàng A',
          email: 'khach@example.com',
          phone: null,
          points: 320,
        },
        isGuest: false,
        pointsEarned: 200,
        pointsExpected: 0,
      }),
    );

    const card = screen.getByRole('heading', { name: 'Khách hàng' }).closest('section');
    expect(card).toHaveTextContent('Đơn này đã cộng 200 điểm');
    expect(card).not.toHaveTextContent('sẽ cộng');
  });
});

describe('Trang tổng quan: đơn chờ xác nhận', () => {
  it('hiện số đơn chờ xác nhận (lấy tổng bằng pageSize=1) và dẫn tới danh sách đơn', async () => {
    signIn();
    const paramsLog = [];
    mockServer({
      ...base,
      'GET /admin/products': [200, { items: [], page: 1, pageSize: 1, total: 4 }],
      'GET /admin/categories': [200, []],
      'GET /admin/brands': [200, []],
      'GET /admin/orders': (config) => {
        paramsLog.push(config.params);
        return [200, page([], { total: 7 })];
      },
    });
    renderApp('/');

    const card = await screen.findByRole('link', { name: /Đơn chờ xác nhận/ });
    expect(await within(card).findByText('7')).toBeInTheDocument();
    expect(card).toHaveAttribute('href', '/don-hang');
    expect(paramsLog[0]).toEqual({ status: 'PENDING', pageSize: 1 });
  });
});
