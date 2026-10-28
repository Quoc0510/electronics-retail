/**
 * @feature [F07] Quản lý đơn hàng - Kiểm thử giao diện của khách: danh sách đơn (lọc, phân trang, trạng thái biên),
 * hủy đơn có lý do và hiển thị đơn đã hủy (US-17, US-18).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import {
  apiError,
  customer,
  mockServer,
  renderApp,
  session,
  storefrontApi,
} from '../test/utils.jsx';

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
  recipientName: 'Nguyễn Văn A',
  itemCount: 3,
  items: [{ productName: `Sản phẩm ${n}`, quantity: 2, thumbnail: null }],
  moreItems: 0,
  ...overrides,
});

const page = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  ...extra,
});

const order = (overrides = {}) => ({
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
  note: null,
  cancelReason: null,
  createdAt: '2026-10-28T06:00:00.000Z',
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
    { status: 'PENDING', note: 'Đơn hàng được tạo', createdAt: '2026-10-28T06:00:00.000Z' },
  ],
  ...overrides,
});

const signIn = () => tokenStorage.setTokens(session);

const server = (extra = {}) =>
  mockServer({ ...storefrontApi, 'GET /users/me': [200, customer], ...extra });

// ---------------------------------------------------------------------------
// Danh sách đơn
// ---------------------------------------------------------------------------
describe('Trang danh sách đơn hàng (US-17 AC1)', () => {
  const openList = async (route = '/don-hang', extra = {}) => {
    signIn();
    const paramsLog = [];
    const calls = server({
      'GET /orders': (config) => {
        paramsLog.push(config.params);
        return [200, page([listItem(1), listItem(2, { status: 'COMPLETED' })])];
      },
      ...extra,
    });
    renderApp(route);
    await screen.findByRole('heading', { name: 'Đơn hàng của tôi', level: 1 });
    return { calls, paramsLog };
  };

  it('chưa đăng nhập thì chuyển tới trang đăng nhập', async () => {
    mockServer(storefrontApi);
    renderApp('/don-hang');

    expect(await screen.findByLabelText('Mật khẩu')).toBeInTheDocument();
  });

  it('hiện từng đơn: mã, trạng thái, ngày đặt, sản phẩm, tổng tiền; bấm vào để xem chi tiết', async () => {
    await openList();

    const first = await screen.findByRole('link', { name: /TS261021-ABCD/ });
    expect(first).toHaveAttribute('href', '/don-hang/TS261021-ABCD');
    expect(first).toHaveTextContent('Chờ xác nhận');
    expect(first).toHaveTextContent('Đặt lúc');
    expect(first).toHaveTextContent(/Sản phẩm 1s*× 2/);
    expect(first).toHaveTextContent('3 sản phẩm');
    expect(first).toHaveTextContent('2.030.000 ₫');
    expect(screen.getByRole('link', { name: /TS261022-ABCD/ })).toHaveTextContent('Hoàn thành');
  });

  it('báo "và n sản phẩm khác" khi đơn có nhiều hơn số sản phẩm hiển thị', async () => {
    await openList('/don-hang', {
      'GET /orders': [200, page([listItem(1, { moreItems: 4 })])],
    });

    expect(await screen.findByText('và 4 sản phẩm khác')).toBeInTheDocument();
  });

  it('mặc định gửi trang 1 với 10 đơn mỗi trang và không lọc', async () => {
    const { paramsLog } = await openList();

    await screen.findByText(/TS261021-ABCD/);
    expect(paramsLog[0]).toEqual({ pageSize: 10, page: 1 });
    expect(screen.getByRole('button', { name: 'Tất cả', pressed: true })).toBeInTheDocument();
  });

  it('bấm một trạng thái thì lọc theo trạng thái đó và về trang 1', async () => {
    const { paramsLog } = await openList('/don-hang?page=2');

    await userEvent.click(screen.getByRole('button', { name: 'Đang giao hàng' }));

    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ pageSize: 10, page: 1, status: 'SHIPPING' }),
    );
    expect(
      screen.getByRole('button', { name: 'Đang giao hàng', pressed: true }),
    ).toBeInTheDocument();
  });

  it('đọc bộ lọc và trang từ URL', async () => {
    const { paramsLog } = await openList('/don-hang?status=PENDING&page=2');

    await screen.findByText(/TS261021-ABCD/);
    expect(paramsLog[0]).toEqual({ pageSize: 10, page: 2, status: 'PENDING' });
    expect(screen.getByRole('button', { name: 'Chờ xác nhận', pressed: true })).toBeInTheDocument();
  });

  it('tham số URL sai (trạng thái lạ, page=abc) về mặc định', async () => {
    const { paramsLog } = await openList('/don-hang?status=LUNG_TUNG&page=abc');

    await screen.findByText(/TS261021-ABCD/);
    expect(paramsLog[0]).toEqual({ pageSize: 10, page: 1 });
  });

  it('phân trang bằng liên kết, giữ nguyên bộ lọc', async () => {
    await openList('/don-hang?status=COMPLETED', {
      'GET /orders': [200, page([listItem(1)], { total: 25 })],
    });

    const nav = await screen.findByRole('navigation', { name: 'Phân trang' });
    expect(within(nav).getByRole('link', { name: 'Trang 2' })).toHaveAttribute(
      'href',
      '/don-hang?status=COMPLETED&page=2',
    );
    expect(screen.getByRole('status')).toHaveTextContent('25 đơn hàng');
  });

  it('chưa có đơn nào: khung thân thiện và nút bắt đầu mua sắm', async () => {
    await openList('/don-hang', { 'GET /orders': [200, page([])] });

    expect(await screen.findByText('Bạn chưa có đơn hàng nào')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bắt đầu mua sắm' })).toHaveAttribute(
      'href',
      '/san-pham',
    );
  });

  it('lọc mà không có đơn: nói rõ trạng thái đang lọc', async () => {
    await openList('/don-hang?status=CANCELLED', { 'GET /orders': [200, page([])] });

    expect(
      await screen.findByText('Không có đơn hàng nào ở trạng thái "Đã hủy"'),
    ).toBeInTheDocument();
  });

  it('trang vượt quá số trang thì dẫn về trang đầu', async () => {
    await openList('/don-hang?page=9', {
      'GET /orders': [200, page([], { total: 12, page: 9 })],
    });

    expect(await screen.findByText('Trang này không có đơn hàng.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về trang đầu' })).toHaveAttribute('href', '/don-hang');
  });

  it('hiện khung chờ khi đang tải', async () => {
    signIn();
    server({ 'GET /orders': [200, page([listItem(1)])] });
    renderApp('/don-hang');

    expect(await screen.findByRole('status', { name: 'Đang tải đơn hàng' })).toBeInTheDocument();
    await screen.findByText(/TS261021-ABCD/);
  });

  it('lỗi tải: hiện thông báo, Thử lại tải được lại', async () => {
    signIn();
    let attempts = 0;
    server({
      'GET /orders': () => {
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

    expect(await screen.findByText(/TS261021-ABCD/)).toBeInTheDocument();
  });

  it('đặt tiêu đề tab trình duyệt', async () => {
    await openList();

    await waitFor(() => expect(document.title).toBe('Đơn hàng của tôi - TechStore'));
  });
});

describe('Menu tài khoản có lối vào đơn hàng', () => {
  it('có mục "Đơn hàng của tôi" dẫn tới /don-hang', async () => {
    signIn();
    server();
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: /Xin chào, Khách A/ }));

    expect(screen.getByRole('menuitem', { name: 'Đơn hàng của tôi' })).toHaveAttribute(
      'href',
      '/don-hang',
    );
  });
});

// ---------------------------------------------------------------------------
// Hủy đơn
// ---------------------------------------------------------------------------
describe('Hủy đơn hàng (US-18)', () => {
  const openOrder = async (current = order(), extra = {}) => {
    signIn();
    const calls = server({ 'GET /orders/TS261028-ABCD': [200, current], ...extra });
    renderApp('/don-hang/TS261028-ABCD');
    await screen.findByRole('heading', { name: /Đơn hàng TS261028-ABCD/, level: 1 });
    return calls;
  };

  const cancelledOrder = order({
    status: 'CANCELLED',
    cancelReason: 'Đặt nhầm sản phẩm',
    history: [
      { status: 'PENDING', note: 'Đơn hàng được tạo', createdAt: '2026-10-28T06:00:00.000Z' },
      {
        status: 'CANCELLED',
        note: 'Khách hàng hủy đơn: Đặt nhầm sản phẩm',
        createdAt: '2026-10-28T07:00:00.000Z',
      },
    ],
  });

  const openForm = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Hủy đơn hàng' }));
    return screen.getByRole('form', { name: 'Hủy đơn hàng' });
  };

  it('đơn chờ xác nhận có khung hủy đơn và hướng dẫn liên hệ khi đã xác nhận', async () => {
    await openOrder();

    const section = screen.getByRole('region', { name: 'Hủy đơn hàng' });
    expect(within(section).getByRole('button', { name: 'Hủy đơn hàng' })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'liên hệ cửa hàng' })).toHaveAttribute(
      'href',
      '/lien-he',
    );
  });

  it.each(['CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'])(
    'đơn đang %s thì không có nút hủy (BR-06)',
    async (status) => {
      await openOrder(order({ status }));

      expect(screen.queryByRole('button', { name: 'Hủy đơn hàng' })).not.toBeInTheDocument();
    },
  );

  it('bấm "Hủy đơn hàng" mở form lý do; chọn sẵn lý do đầu tiên', async () => {
    await openOrder();

    const form = await openForm();

    expect(
      within(form).getByRole('radio', { name: 'Muốn thay đổi địa chỉ giao hàng', checked: true }),
    ).toBeInTheDocument();
    expect(within(form).getAllByRole('radio')).toHaveLength(5);
    expect(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' })).toBeInTheDocument();
  });

  it('xác nhận hủy: gửi lý do đã chọn, đơn chuyển sang "Đã hủy" kèm lý do và lịch sử, không còn nút hủy', async () => {
    const calls = await openOrder(order(), {
      'POST /orders/TS261028-ABCD/cancel': [200, cancelledOrder],
    });
    const form = await openForm();

    await userEvent.click(within(form).getByRole('radio', { name: 'Đặt nhầm sản phẩm' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));

    expect(await screen.findByText(/Đơn hàng đã được hủy\./)).toBeInTheDocument();
    expect(screen.getByText(/Lý do: Đặt nhầm sản phẩm/)).toBeInTheDocument();
    expect(calls).toContainEqual({
      key: 'POST /orders/TS261028-ABCD/cancel',
      body: { reason: 'Đặt nhầm sản phẩm' },
    });
    expect(screen.getByText('Đã hủy', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Khách hàng hủy đơn: Đặt nhầm sản phẩm')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Hủy đơn hàng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hủy đơn hàng' })).not.toBeInTheDocument();
  });

  it('chọn "Lý do khác" thì phải tự nhập; gửi lý do đã cắt khoảng trắng', async () => {
    const calls = await openOrder(order(), {
      'POST /orders/TS261028-ABCD/cancel': [200, cancelledOrder],
    });
    const form = await openForm();

    await userEvent.click(within(form).getByRole('radio', { name: 'Lý do khác' }));
    await userEvent.type(within(form).getByLabelText('Nhập lý do'), '  Thay đổi kế hoạch  ');
    await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));

    await screen.findByText(/Đơn hàng đã được hủy\./);
    expect(calls).toContainEqual({
      key: 'POST /orders/TS261028-ABCD/cancel',
      body: { reason: 'Thay đổi kế hoạch' },
    });
  });

  it('"Lý do khác" để trống hoặc quá ngắn thì báo lỗi và không gửi', async () => {
    const calls = await openOrder();
    const form = await openForm();
    await userEvent.click(within(form).getByRole('radio', { name: 'Lý do khác' }));

    await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));
    expect(await within(form).findByRole('alert')).toHaveTextContent('Vui lòng nhập lý do hủy đơn');

    await userEvent.type(within(form).getByLabelText('Nhập lý do'), 'ab');
    await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('ít nhất 3 ký tự');
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
  });

  it('lý do quá 200 ký tự thì báo lỗi và không gửi', async () => {
    const calls = await openOrder();
    const form = await openForm();
    await userEvent.click(within(form).getByRole('radio', { name: 'Lý do khác' }));
    await userEvent.click(within(form).getByLabelText('Nhập lý do'));
    await userEvent.paste('a'.repeat(201));

    await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('tối đa 200 ký tự');
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
  });

  it('"Giữ đơn hàng" đóng form và không gửi gì', async () => {
    const calls = await openOrder();
    const form = await openForm();

    await userEvent.click(within(form).getByRole('button', { name: 'Giữ đơn hàng' }));

    expect(screen.queryByRole('form', { name: 'Hủy đơn hàng' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy đơn hàng' })).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false);
  });

  it('đơn vừa được cửa hàng xác nhận (400): báo thông báo của máy chủ, form vẫn dùng lại được', async () => {
    await openOrder(order(), {
      'POST /orders/TS261028-ABCD/cancel': [
        400,
        apiError(
          'INVALID_TRANSITION',
          'Đơn hàng đã được xử lý nên không thể tự hủy. Vui lòng liên hệ cửa hàng để được hỗ trợ',
        ),
      ],
    });
    const form = await openForm();

    await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('không thể tự hủy');
    expect(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' })).toBeEnabled();
  });

  it('đơn đã hủy mở lại sau này vẫn hiện lý do hủy', async () => {
    await openOrder(cancelledOrder);

    expect(screen.getByText(/Lý do: Đặt nhầm sản phẩm/)).toBeInTheDocument();
  });

  it('có lối quay về danh sách đơn hàng', async () => {
    await openOrder();

    expect(screen.getByRole('link', { name: 'Tất cả đơn hàng của tôi' })).toHaveAttribute(
      'href',
      '/don-hang',
    );
  });
});
