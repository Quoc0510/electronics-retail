/**
 * @feature [F13] Đặt hàng không cần đăng nhập và điểm thành viên - Kiểm thử giao diện Client: đặt hàng khi chưa đăng nhập
 * (BR-11), trang tra cứu đơn bằng mã đơn + số điện thoại, xem và hủy đơn của khách vãng lai, hiển thị điểm thành viên (BR-15).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { GUEST_CART_KEY } from '../lib/guestCart.js';
import { getGuestOrderPhone, newRequestId, rememberGuestOrder } from '../lib/guestOrder.js';
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
const CODE = 'TS261028-ABCD';
const PHONE = '0987654321';

const line = (id, overrides = {}) => ({
  id: id + 100,
  productId: id + 100,
  quantity: 2,
  product: {
    name: `Sản phẩm ${id}`,
    slug: `san-pham-${id}`,
    price: 1000000,
    salePrice: null,
    thumbnail: null,
    brand: { name: 'Apple' },
    category: { name: 'Điện thoại' },
  },
  unitPrice: 1000000,
  lineTotal: 2000000,
  stock: 5,
  status: 'OK',
  ...overrides,
});

const makeCart = (items) => ({
  items,
  totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal: items.filter((i) => i.status === 'OK').reduce((sum, i) => sum + i.lineTotal, 0),
  canCheckout: items.length > 0 && items.every((i) => i.status === 'OK'),
});

const cart = makeCart([line(1)]); // 2 x 1.000.000 = 2.000.000 -> 2 điểm

const guestOrder = {
  id: 1,
  code: CODE,
  status: 'PENDING',
  paymentMethod: 'COD',
  paymentStatus: 'UNPAID',
  subtotal: 2000000,
  shippingFee: 30000,
  total: 2030000,
  recipientName: 'Trần Thị B',
  phone: PHONE,
  shippingAddress: '99 Bạch Đằng, Phường Thạch Thang, Hải Châu, Đà Nẵng',
  note: null,
  cancelReason: null,
  createdAt: '2026-10-28T06:00:00.000Z',
  isGuest: true,
  pointsEarned: 0,
  pointsExpected: 0,
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
      note: 'Đơn hàng được tạo (khách không đăng nhập)',
      createdAt: '2026-10-28T06:00:00.000Z',
    },
  ],
};

const memberOrder = { ...guestOrder, isGuest: false, pointsExpected: 2 };

const seedGuestCart = () =>
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify([{ productId: 101, quantity: 2 }]));

const signIn = () => tokenStorage.setTokens(session);

const guestServer = (extra = {}) =>
  mockServer({
    ...storefrontApi,
    'POST /cart/preview': [200, cart],
    'POST /orders/guest': [201, guestOrder],
    'POST /orders/lookup': [200, guestOrder],
    ...extra,
  });

const fillShipping = async (overrides = {}) => {
  const values = {
    'Tên người nhận': 'Trần Thị B',
    'Số điện thoại người nhận': PHONE,
    'Tỉnh/Thành phố': 'Đà Nẵng',
    'Quận/Huyện (nếu có)': 'Hải Châu',
    'Phường/Xã': 'Phường Thạch Thang',
    'Số nhà, tên đường': '99 Bạch Đằng',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    if (value) await userEvent.type(screen.getByLabelText(label), value);
  }
};

const place = () => userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));
const posts = (calls, key) => calls.filter((c) => c.key === key);

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// ---------------------------------------------------------------------------
// Hàm hỗ trợ ở trình duyệt
// ---------------------------------------------------------------------------
describe('lib/guestOrder', () => {
  it('requestId là UUID v4 và mỗi lần một mã khác', () => {
    const a = newRequestId();
    const b = newRequestId();

    expect(a).toMatch(UUID_V4);
    expect(b).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  it('nhớ và đọc lại số điện thoại theo mã đơn; mã khác không có', () => {
    expect(getGuestOrderPhone(CODE)).toBeNull();

    rememberGuestOrder(CODE, PHONE);

    expect(getGuestOrderPhone(CODE)).toBe(PHONE);
    expect(getGuestOrderPhone('TS261028-ZZZZ')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Đặt hàng khi chưa đăng nhập
// ---------------------------------------------------------------------------
describe('Đặt hàng khi chưa đăng nhập (BR-11)', () => {
  const openCheckout = async (extra) => {
    seedGuestCart();
    const calls = guestServer(extra);
    renderApp('/dat-hang');
    await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });
    return calls;
  };

  it('hiện form nhập địa chỉ ngay, không có sổ địa chỉ và không gọi API của thành viên', async () => {
    const calls = await openCheckout();

    expect(screen.getByLabelText('Tên người nhận')).toBeInTheDocument();
    expect(screen.queryByText('Giao tới địa chỉ khác')).not.toBeInTheDocument();
    expect(screen.getByText(/đặt hàng không cần tài khoản/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'GET /users/me/addresses')).toBe(false);
    expect(calls.some((c) => c.key === 'GET /cart')).toBe(false);
  });

  it('mời đăng nhập để tích điểm và cho biết đơn này được bao nhiêu điểm (BR-15)', async () => {
    await openCheckout();

    const aside = screen.getByRole('complementary', { name: 'Đơn hàng của bạn' });
    expect(aside).toHaveTextContent('Đơn này sẽ được 2 điểm nếu bạn là thành viên');
    expect(within(aside).getByRole('link', { name: 'đăng nhập' })).toHaveAttribute(
      'href',
      '/dang-nhap',
    );
  });

  it('form để trống: báo lỗi từng ô và không gửi đơn', async () => {
    const calls = await openCheckout();

    await place();

    expect(await screen.findByText('Vui lòng nhập tên người nhận')).toBeInTheDocument();
    expect(posts(calls, 'POST /orders/guest')).toHaveLength(0);
  });

  it('đặt thành công: gửi giỏ + địa chỉ + requestId, dọn giỏ tạm, nhớ số điện thoại, hiện khung thành công', async () => {
    const calls = await openCheckout();

    await fillShipping();
    await userEvent.type(screen.getByLabelText('Ghi chú'), '  Gọi trước khi giao  ');
    await place();

    expect(await screen.findByText('Đặt hàng thành công!')).toBeInTheDocument();
    const [sent] = posts(calls, 'POST /orders/guest');
    expect(sent.body.items).toEqual([{ productId: 101, quantity: 2 }]);
    expect(sent.body.shipping).toEqual({
      recipientName: 'Trần Thị B',
      phone: PHONE,
      province: 'Đà Nẵng',
      district: 'Hải Châu',
      ward: 'Phường Thạch Thang',
      street: '99 Bạch Đằng',
    });
    expect(sent.body.note).toBe('Gọi trước khi giao');
    expect(sent.body.requestId).toMatch(UUID_V4);
    expect(sent.body).not.toHaveProperty('addressId');
    expect(posts(calls, 'POST /orders')).toHaveLength(0);

    // Giỏ tạm đã được dọn; số điện thoại được nhớ để tải lại trang đơn vẫn xem được
    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
    expect(getGuestOrderPhone(CODE)).toBe(PHONE);
    // Khung thành công nhắc ghi lại mã + số điện thoại và mời đăng ký
    const banner = screen.getByText('Đặt hàng thành công!').closest('[role="status"]');
    expect(banner).toHaveTextContent(CODE);
    expect(banner).toHaveTextContent(PHONE);
    expect(within(banner).getByRole('link', { name: 'Đăng ký thành viên' })).toHaveAttribute(
      'href',
      '/dang-ky',
    );
    // Trang đơn xem đơn bằng mã + số điện thoại, không phải API của thành viên
    expect(posts(calls, 'POST /orders/lookup')[0].body).toEqual({ code: CODE, phone: PHONE });
    expect(calls.some((c) => c.key === `GET /orders/${CODE}`)).toBe(false);
  });

  it('không nhập quận/huyện vẫn đặt được (không bắt buộc)', async () => {
    const calls = await openCheckout();

    await fillShipping({ 'Quận/Huyện (nếu có)': '' });
    await place();

    expect(await screen.findByText('Đặt hàng thành công!')).toBeInTheDocument();
    expect(posts(calls, 'POST /orders/guest')[0].body.shipping.district).toBe('');
  });

  it('thử lại sau lỗi máy chủ gửi lại CÙNG requestId (máy chủ không tạo hai đơn)', async () => {
    let attempts = 0;
    const calls = await openCheckout({
      'POST /orders/guest': () => {
        attempts += 1;
        return attempts === 1
          ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ, vui lòng thử lại')]
          : [201, guestOrder];
      },
    });

    await fillShipping();
    await place();
    expect(await screen.findByText('Lỗi máy chủ, vui lòng thử lại')).toBeInTheDocument();
    expect(localStorage.getItem(GUEST_CART_KEY)).not.toBeNull(); // chưa đặt được thì giữ giỏ

    await place();
    expect(await screen.findByText('Đặt hàng thành công!')).toBeInTheDocument();

    const [first, second] = posts(calls, 'POST /orders/guest');
    expect(first.body.requestId).toBe(second.body.requestId);
  });

  it('hết hàng: báo rõ từng sản phẩm, giữ nguyên giỏ và trang (US-16 AC4)', async () => {
    await openCheckout({
      'POST /orders/guest': [
        409,
        apiError('CART_NOT_PURCHASABLE', 'Không thể đặt hàng: Sản phẩm 1 đã hết hàng', {
          items: [
            {
              productId: 101,
              name: 'Sản phẩm 1',
              requested: 2,
              available: 0,
              reason: 'OUT_OF_STOCK',
            },
          ],
        }),
      ],
    });

    await fillShipping();
    await place();

    const alert = await screen.findByText('Các sản phẩm sau cần bạn điều chỉnh:');
    expect(alert.closest('[role="alert"]')).toHaveTextContent('Sản phẩm 1: đã hết hàng');
    expect(localStorage.getItem(GUEST_CART_KEY)).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Đặt hàng', level: 1 })).toBeInTheDocument();
  });

  it('thành viên vẫn đặt qua giỏ tài khoản (không gửi requestId) và thấy số điểm sẽ nhận', async () => {
    signIn();
    const calls = mockServer({
      ...storefrontApi,
      'GET /users/me': [200, customer],
      'GET /cart': [200, cart],
      'GET /users/me/addresses': [200, []],
      'POST /orders': [201, memberOrder],
      [`GET /orders/${CODE}`]: [200, memberOrder],
    });
    renderApp('/dat-hang');
    await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });

    expect(
      screen.getByText('Bạn sẽ nhận 2 điểm thành viên khi đơn hoàn thành.'),
    ).toBeInTheDocument();
    await fillShipping();
    await place();

    expect(await screen.findByText('Đặt hàng thành công!')).toBeInTheDocument();
    expect(posts(calls, 'POST /orders/guest')).toHaveLength(0);
    expect(posts(calls, 'POST /orders')[0].body).not.toHaveProperty('requestId');
    // Khung thành công của thành viên cho biết điểm sẽ nhận, không mời đăng ký
    const banner = screen.getByText('Đặt hàng thành công!').closest('[role="status"]');
    expect(banner).toHaveTextContent('Bạn sẽ nhận 2 điểm thành viên');
    expect(within(banner).queryByText('Đăng ký thành viên')).not.toBeInTheDocument();
  });
});

describe('Giỏ hàng: lời mời tích điểm (BR-15)', () => {
  it('khách không đăng nhập: nút đặt hàng không đòi đăng nhập, có lời mời đăng nhập để tích điểm', async () => {
    seedGuestCart();
    guestServer();
    renderApp('/gio-hang');

    const summary = await screen.findByRole('complementary', { name: 'Tóm tắt đơn hàng' });
    expect(within(summary).getByRole('link', { name: 'Tiến hành đặt hàng' })).toHaveAttribute(
      'href',
      '/dat-hang',
    );
    expect(summary).toHaveTextContent('đặt hàng ngay mà không cần tài khoản');
    expect(summary).toHaveTextContent('Muốn tích 2 điểm thành viên cho đơn này?');
    expect(within(summary).getByRole('link', { name: 'đăng nhập' })).toBeInTheDocument();
  });

  it('thành viên: cho biết đơn này được bao nhiêu điểm', async () => {
    signIn();
    mockServer({ ...storefrontApi, 'GET /users/me': [200, customer], 'GET /cart': [200, cart] });
    renderApp('/gio-hang');

    const summary = await screen.findByRole('complementary', { name: 'Tóm tắt đơn hàng' });
    expect(summary).toHaveTextContent('Đơn này được 2 điểm thành viên khi hoàn thành.');
    expect(within(summary).queryByRole('link', { name: 'đăng nhập' })).not.toBeInTheDocument();
  });

  // Điểm tính theo tổng đã mua (BR-15): phần lẻ của các đơn trước được cộng vào đơn này
  const smallCart = makeCart([line(1, { quantity: 1, unitPrice: 600000, lineTotal: 600000 })]);

  it('thành viên đã mua 600.000 ₫: đơn 600.000 ₫ nữa vượt mốc nên được 1 điểm', async () => {
    signIn();
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, { ...customer, totalSpent: 600000 }],
      'GET /cart': [200, smallCart],
    });
    renderApp('/gio-hang');

    const summary = await screen.findByRole('complementary', { name: 'Tóm tắt đơn hàng' });
    await waitFor(() =>
      expect(summary).toHaveTextContent('Đơn này được 1 điểm thành viên khi hoàn thành.'),
    );
  });

  it('thành viên chưa đủ mốc: cho biết còn thiếu bao nhiêu (tính cả đơn này) để được điểm tiếp theo', async () => {
    signIn();
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, { ...customer, totalSpent: 0 }],
      'GET /cart': [200, smallCart],
    });
    renderApp('/gio-hang');

    const summary = await screen.findByRole('complementary', { name: 'Tóm tắt đơn hàng' });
    expect(summary).toHaveTextContent(
      'Mua thêm 400.000 ₫ nữa (tính cả đơn này) để được thêm 1 điểm',
    );
  });

  it('khách không đăng nhập với đơn dưới 1.000.000 ₫: lời mời không nhắc số điểm', async () => {
    seedGuestCart();
    guestServer({ 'POST /cart/preview': [200, smallCart] });
    renderApp('/gio-hang');

    const summary = await screen.findByRole('complementary', { name: 'Tóm tắt đơn hàng' });
    expect(summary).toHaveTextContent('Muốn tích điểm thành viên?');
    expect(summary).not.toHaveTextContent('Muốn tích 0 điểm');
  });
});

describe('Điểm cộng dồn ở trang đặt hàng (BR-15)', () => {
  it('thành viên đã mua 54.980.000 ₫ đặt thêm 600.000 ₫ thì thấy điểm kế tiếp cách bao xa', async () => {
    signIn();
    const smallCart = makeCart([line(1, { quantity: 1, unitPrice: 600000, lineTotal: 600000 })]);
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, { ...customer, totalSpent: 54980000 }],
      'GET /cart': [200, smallCart],
      'GET /users/me/addresses': [200, []],
    });
    renderApp('/dat-hang');
    await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });

    // 54.980.000 + 600.000 = 55.580.000: vượt mốc 55 triệu nên được 1 điểm
    expect(
      await screen.findByText('Bạn sẽ nhận 1 điểm thành viên khi đơn hoàn thành.'),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Trang đơn hàng cho khách vãng lai
// ---------------------------------------------------------------------------
describe('Trang đơn hàng của khách vãng lai', () => {
  it('có số điện thoại đã nhớ: xem bằng mã + số điện thoại, ghi rõ không tích điểm, có lối tra cứu đơn khác', async () => {
    rememberGuestOrder(CODE, PHONE);
    const calls = guestServer();
    renderApp(`/don-hang/${CODE}`);

    expect(
      await screen.findByRole('heading', { name: new RegExp(`Đơn hàng ${CODE}`), level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Đơn đặt khi chưa đăng nhập nên không tích điểm.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tra cứu đơn hàng khác' })).toHaveAttribute(
      'href',
      '/tra-cuu-don-hang',
    );
    expect(screen.queryByRole('link', { name: 'Tất cả đơn hàng của tôi' })).not.toBeInTheDocument();
    expect(posts(calls, 'POST /orders/lookup')[0].body).toEqual({ code: CODE, phone: PHONE });
  });

  it('hủy đơn: gửi mã + số điện thoại + lý do tới API của khách, hiện đơn đã hủy', async () => {
    rememberGuestOrder(CODE, PHONE);
    const cancelled = {
      ...guestOrder,
      status: 'CANCELLED',
      cancelReason: 'Đặt nhầm sản phẩm',
      history: [
        ...guestOrder.history,
        {
          status: 'CANCELLED',
          note: 'Khách hàng hủy đơn: Đặt nhầm sản phẩm',
          createdAt: '2026-10-28T07:00:00.000Z',
        },
      ],
    };
    const calls = guestServer({ 'POST /orders/lookup/cancel': [200, cancelled] });
    renderApp(`/don-hang/${CODE}`);
    await screen.findByRole('heading', { name: new RegExp(`Đơn hàng ${CODE}`), level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Hủy đơn hàng' }));
    const form = screen.getByRole('form', { name: 'Hủy đơn hàng' });
    await userEvent.click(within(form).getByRole('radio', { name: 'Đặt nhầm sản phẩm' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Xác nhận hủy đơn' }));

    expect(await screen.findByText(/Đơn hàng đã được hủy/)).toBeInTheDocument();
    expect(posts(calls, 'POST /orders/lookup/cancel')[0].body).toEqual({
      code: CODE,
      phone: PHONE,
      reason: 'Đặt nhầm sản phẩm',
    });
    expect(calls.some((c) => c.key === `POST /orders/${CODE}/cancel`)).toBe(false);
  });

  it('mã đơn hoặc số điện thoại không khớp (404): báo không tìm thấy và dẫn tới trang tra cứu', async () => {
    rememberGuestOrder(CODE, PHONE);
    guestServer({
      'POST /orders/lookup': [404, apiError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng')],
    });
    renderApp(`/don-hang/${CODE}`);

    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy đơn hàng' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mã đơn hoặc số điện thoại chưa đúng.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Tra cứu bằng mã đơn và số điện thoại' }),
    ).toHaveAttribute('href', '/tra-cuu-don-hang');
  });

  it('thành viên xem đơn của mình: thấy điểm dự kiến, không có dòng "không tích điểm"', async () => {
    signIn();
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, customer],
      [`GET /orders/${CODE}`]: [200, memberOrder],
    });
    renderApp(`/don-hang/${CODE}`);

    expect(
      await screen.findByText('Dự kiến nhận 2 điểm thành viên khi đơn hoàn thành'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/không tích điểm/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tất cả đơn hàng của tôi' })).toBeInTheDocument();
  });

  it('đơn thành viên đã hoàn thành: hiện số điểm đã cộng', async () => {
    signIn();
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, customer],
      [`GET /orders/${CODE}`]: [
        200,
        {
          ...memberOrder,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          pointsEarned: 2,
          pointsExpected: 0,
        },
      ],
    });
    renderApp(`/don-hang/${CODE}`);

    expect(await screen.findByText('Đã cộng 2 điểm thành viên')).toBeInTheDocument();
    expect(screen.queryByText(/Dự kiến nhận/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Trang tra cứu đơn
// ---------------------------------------------------------------------------
describe('Trang tra cứu đơn hàng', () => {
  const openLookup = (path = '/tra-cuu-don-hang', extra = {}) => {
    const calls = guestServer(extra);
    renderApp(path);
    return calls;
  };

  it('có form mã đơn + số điện thoại, ai cũng vào được, có lối tắt ở chân trang', async () => {
    openLookup();

    expect(
      await screen.findByRole('heading', { name: 'Tra cứu đơn hàng', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mã đơn hàng')).toHaveValue('');
    expect(screen.getByLabelText('Số điện thoại nhận hàng')).toBeInTheDocument();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Tra cứu đơn hàng' })).toHaveAttribute(
      'href',
      '/tra-cuu-don-hang',
    );
  });

  it('điền sẵn mã đơn từ ?code=', async () => {
    openLookup(`/tra-cuu-don-hang?code=${CODE}`);

    expect(await screen.findByLabelText('Mã đơn hàng')).toHaveValue(CODE);
  });

  it('nhập sai dạng: báo lỗi từng ô và không gửi', async () => {
    const calls = openLookup();
    await screen.findByLabelText('Mã đơn hàng');

    await userEvent.type(screen.getByLabelText('Mã đơn hàng'), 'abc');
    await userEvent.type(screen.getByLabelText('Số điện thoại nhận hàng'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));

    expect(await screen.findByText('Mã đơn hàng có dạng TS261028-AB3K')).toBeInTheDocument();
    expect(screen.getByText('Số điện thoại phải gồm 10 số và bắt đầu bằng 0')).toBeInTheDocument();
    expect(posts(calls, 'POST /orders/lookup')).toHaveLength(0);
  });

  it('tìm thấy: gõ chữ thường vẫn được, nhớ số điện thoại rồi mở trang đơn hàng', async () => {
    const calls = openLookup();
    await screen.findByLabelText('Mã đơn hàng');

    await userEvent.type(screen.getByLabelText('Mã đơn hàng'), ` ${CODE.toLowerCase()} `);
    await userEvent.type(screen.getByLabelText('Số điện thoại nhận hàng'), PHONE);
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));

    expect(
      await screen.findByRole('heading', { name: new RegExp(`Đơn hàng ${CODE}`), level: 1 }),
    ).toBeInTheDocument();
    expect(posts(calls, 'POST /orders/lookup')[0].body).toEqual({ code: CODE, phone: PHONE });
    expect(getGuestOrderPhone(CODE)).toBe(PHONE);
    // Đơn đã có trong cache nên trang đơn không hỏi lại máy chủ
    expect(posts(calls, 'POST /orders/lookup')).toHaveLength(1);
  });

  it('không tìm thấy: hiện thông báo của máy chủ, ở lại trang và không nhớ gì', async () => {
    openLookup('/tra-cuu-don-hang', {
      'POST /orders/lookup': [404, apiError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng')],
    });
    await screen.findByLabelText('Mã đơn hàng');

    await userEvent.type(screen.getByLabelText('Mã đơn hàng'), CODE);
    await userEvent.type(screen.getByLabelText('Số điện thoại nhận hàng'), '0900000000');
    await userEvent.click(screen.getByRole('button', { name: 'Tra cứu' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy đơn hàng');
    expect(getGuestOrderPhone(CODE)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tra cứu đơn hàng', level: 1 })).toBeInTheDocument();
  });

  it('gợi ý đúng chỗ xem đơn của thành viên: khách thấy lối đăng nhập, thành viên thấy Đơn hàng của tôi', async () => {
    openLookup();
    expect(await screen.findByRole('link', { name: 'đăng nhập' })).toHaveAttribute(
      'href',
      '/dang-nhap',
    );
  });

  it('thành viên đã đăng nhập: gợi ý mở Đơn hàng của tôi', async () => {
    signIn();
    mockServer({ ...storefrontApi, 'GET /users/me': [200, customer] });
    renderApp('/tra-cuu-don-hang');

    const main = await screen.findByRole('main');
    expect(await within(main).findByRole('link', { name: 'Đơn hàng của tôi' })).toHaveAttribute(
      'href',
      '/don-hang',
    );
  });

  it('đặt tiêu đề tab trình duyệt', async () => {
    openLookup();

    await waitFor(() => expect(document.title).toBe('Tra cứu đơn hàng - TechStore'));
  });
});

// ---------------------------------------------------------------------------
// Điểm thành viên trong hồ sơ
// ---------------------------------------------------------------------------
describe('Điểm thành viên trong trang tài khoản (BR-15)', () => {
  it('hiện điểm lấy từ máy chủ (không dùng bản lưu lúc đăng nhập vì điểm đổi khi đơn hoàn thành)', async () => {
    signIn();
    let calls = 0;
    mockServer({
      ...storefrontApi,
      'GET /users/me': () => {
        calls += 1;
        // Lần đầu (khôi phục phiên) 0 điểm; sau đó đơn được hoàn thành nên máy chủ trả 1.235 điểm
        return [200, { ...customer, points: calls === 1 ? 0 : 1235 }];
      },
    });
    renderApp('/tai-khoan');

    const badge = await screen.findByLabelText('Điểm thành viên');
    await waitFor(() => expect(badge).toHaveTextContent(/1\.235/));
    expect(badge).toHaveTextContent('điểm thành viên');
  });

  it('hiện tổng đã mua, còn thiếu bao nhiêu để được điểm tiếp theo và quy tắc 1.000.000 ₫ = 1 điểm', async () => {
    signIn();
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, { ...customer, points: 54, totalSpent: 54980000 }],
    });
    renderApp('/tai-khoan');

    const heading = await screen.findByRole('heading', { name: 'Tài khoản của tôi' });
    const card = heading.closest('div').parentElement;
    await waitFor(() => expect(card).toHaveTextContent('Đã mua 54.980.000 ₫'));
    expect(card).toHaveTextContent('mua thêm 20.000 ₫ để được thêm 1 điểm');
    expect(card).toHaveTextContent('mỗi 1.000.000 ₫ tiền hàng được 1 điểm');
  });
});
