/**
 * @feature [F06] Đặt hàng - Kiểm thử giao diện đặt hàng của Client: trang /dat-hang (địa chỉ, tóm tắt, xác nhận, chống bấm đúp,
 * lỗi hết hàng) và trang /don-hang/:code (khung thành công, chi tiết, lịch sử) (US-16).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import {
  apiError,
  customer,
  emptyCart,
  mockServer,
  renderApp,
  session,
  storefrontApi,
} from '../test/utils.jsx';

// ---------------------------------------------------------------------------
// Dữ liệu giả
// ---------------------------------------------------------------------------
const line = (id, overrides = {}) => ({
  id,
  productId: id + 100,
  quantity: 1,
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
  lineTotal: 1000000,
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

const addresses = [
  {
    id: 1,
    recipientName: 'Người nhận A',
    phone: '0911111111',
    province: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    ward: 'Phường Bến Nghé',
    street: '1 Lê Lợi',
    isDefault: false,
  },
  {
    id: 2,
    recipientName: 'Người nhận B',
    phone: '0922222222',
    province: 'Hà Nội',
    district: 'Ba Đình',
    ward: 'Phường Điện Biên',
    street: '2 Hùng Vương',
    isDefault: true,
  },
];

const placedOrder = {
  id: 1,
  code: 'TS261028-ABCD',
  status: 'PENDING',
  paymentMethod: 'COD',
  paymentStatus: 'UNPAID',
  subtotal: 2000000,
  shippingFee: 30000,
  total: 2030000,
  recipientName: 'Người nhận B',
  phone: '0922222222',
  shippingAddress: '2 Hùng Vương, Phường Điện Biên, Ba Đình, Hà Nội',
  note: 'Gọi trước khi giao',
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
};

const signIn = () => tokenStorage.setTokens(session);

// Máy chủ giả cho trang đặt hàng; extra ghi đè từng handler
const checkoutServer = (cart, extra = {}) =>
  mockServer({
    ...storefrontApi,
    'GET /users/me': [200, customer],
    'GET /cart': [200, cart],
    'GET /users/me/addresses': [200, addresses],
    'POST /orders': [201, placedOrder],
    'GET /orders/TS261028-ABCD': [200, placedOrder],
    ...extra,
  });

const openCheckout = async (
  cart = makeCart([line(1, { quantity: 2, lineTotal: 2000000 })]),
  extra,
) => {
  signIn();
  const calls = checkoutServer(cart, extra);
  renderApp('/dat-hang');
  await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });
  return calls;
};

const orders = (calls) => calls.filter((c) => c.key === 'POST /orders');

const fillNewAddress = async (overrides = {}) => {
  const values = {
    'Tên người nhận': 'Trần Thị B',
    'Số điện thoại người nhận': '0987654321',
    'Tỉnh/Thành phố': 'Đà Nẵng',
    'Quận/Huyện (nếu có)': 'Hải Châu',
    'Phường/Xã': 'Phường Thạch Thang',
    'Số nhà, tên đường': '99 Bạch Đằng',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await userEvent.clear(input);
    if (value) await userEvent.type(input, value);
  }
};

// ---------------------------------------------------------------------------
// Trang đặt hàng
// ---------------------------------------------------------------------------
describe('Trang đặt hàng - hiển thị', () => {
  it('chưa đăng nhập vẫn vào được trang đặt hàng, không bị chuyển tới đăng nhập (BR-11, F13)', async () => {
    localStorage.setItem('techstore.guestCart', JSON.stringify([{ productId: 101, quantity: 2 }]));
    mockServer({
      ...storefrontApi,
      'POST /cart/preview': [200, makeCart([line(1, { quantity: 2, lineTotal: 2000000 })])],
    });
    renderApp('/dat-hang');

    expect(await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 })).toBeInTheDocument();
    expect(screen.queryByLabelText('Mật khẩu')).not.toBeInTheDocument();
  });

  it('hiện khung chờ khi đang tải rồi hiện trang', async () => {
    signIn();
    checkoutServer(makeCart([line(1)]));
    renderApp('/dat-hang');

    expect(
      await screen.findByRole('status', { name: 'Đang tải trang đặt hàng' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 })).toBeInTheDocument();
  });

  it('tóm tắt: từng sản phẩm, tạm tính, phí vận chuyển 30.000 ₫ và tổng thanh toán (AC2)', async () => {
    await openCheckout();

    const summary = screen.getByRole('complementary', { name: 'Đơn hàng của bạn' });
    expect(within(summary).getByText('Sản phẩm 1')).toBeInTheDocument();
    expect(within(summary).getByText('1.000.000 ₫ × 2')).toBeInTheDocument();
    const amounts = within(summary)
      .getAllByText(/₫/)
      .map((el) => el.textContent);
    expect(amounts).toContain('2.000.000 ₫'); // tạm tính (cũng là thành tiền dòng)
    expect(amounts).toContain('30.000 ₫'); // phí vận chuyển
    expect(amounts).toContain('2.030.000 ₫'); // tổng
  });

  it('từ 5 triệu thì miễn phí vận chuyển', async () => {
    await openCheckout(makeCart([line(1, { quantity: 5, lineTotal: 5000000 })]));

    const summary = screen.getByRole('complementary', { name: 'Đơn hàng của bạn' });
    expect(within(summary).getByText('Miễn phí')).toBeInTheDocument();
  });

  it('chỉ có phương thức thanh toán khi nhận hàng (COD)', async () => {
    await openCheckout();

    // Chân trang cũng ghi cam kết COD nên chỉ tìm trong vùng nội dung chính
    expect(
      within(screen.getByRole('main')).getByText('Thanh toán khi nhận hàng (COD)'),
    ).toBeInTheDocument();
  });

  it('giỏ trống thì không cho đặt, gợi ý tiếp tục mua sắm', async () => {
    signIn();
    checkoutServer(emptyCart);
    renderApp('/dat-hang');

    expect(await screen.findByText('Giỏ hàng của bạn đang trống')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tiếp tục mua sắm' })).toHaveAttribute(
      'href',
      '/san-pham',
    );
  });

  it('giỏ có sản phẩm cần xử lý thì khóa nút xác nhận và dẫn về giỏ hàng', async () => {
    await openCheckout(makeCart([line(1), line(2, { status: 'OUT_OF_STOCK', stock: 0 })]));

    expect(screen.getByRole('button', { name: 'Xác nhận đặt hàng' })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Quay lại giỏ hàng để chỉnh sửa' })).toHaveAttribute(
      'href',
      '/gio-hang',
    );
  });

  it('lỗi tải giỏ: hiện thông báo, Thử lại tải được lại', async () => {
    signIn();
    let attempts = 0;
    checkoutServer(makeCart([line(1)]), {
      'GET /cart': () => {
        attempts += 1;
        return attempts === 1
          ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')]
          : [200, makeCart([line(1)])];
      },
    });
    renderApp('/dat-hang');

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Lỗi máy chủ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 })).toBeInTheDocument();
  });
});

describe('Trang đặt hàng - địa chỉ giao hàng (AC1)', () => {
  it('có địa chỉ đã lưu: địa chỉ mặc định được chọn sẵn, không hiện form nhập', async () => {
    await openCheckout();

    expect(screen.getByRole('radio', { name: /Người nhận B/, checked: true })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Người nhận A/, checked: false })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tên người nhận')).not.toBeInTheDocument();
  });

  it('không có địa chỉ mặc định thì chọn địa chỉ đầu tiên', async () => {
    await openCheckout(undefined, {
      'GET /users/me/addresses': [200, addresses.map((a) => ({ ...a, isDefault: false }))],
    });

    expect(screen.getByRole('radio', { name: /Người nhận A/, checked: true })).toBeInTheDocument();
  });

  it('đặt bằng địa chỉ đã lưu: gửi addressId (không gửi địa chỉ nhập tay)', async () => {
    const calls = await openCheckout();

    await userEvent.click(screen.getByRole('radio', { name: /Người nhận A/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 1 });
  });

  it('chọn "Giao tới địa chỉ khác" thì hiện form; gửi địa chỉ đã cắt khoảng trắng', async () => {
    const calls = await openCheckout();

    await userEvent.click(screen.getByRole('radio', { name: 'Giao tới địa chỉ khác' }));
    await fillNewAddress({
      'Tên người nhận': '  Trần Thị B  ',
      'Số nhà, tên đường': ' 99 Bạch Đằng ',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({
      shipping: {
        recipientName: 'Trần Thị B',
        phone: '0987654321',
        province: 'Đà Nẵng',
        district: 'Hải Châu',
        ward: 'Phường Thạch Thang',
        street: '99 Bạch Đằng',
      },
    });
  });

  it('chưa có địa chỉ nào: mở sẵn form nhập', async () => {
    await openCheckout(undefined, { 'GET /users/me/addresses': [200, []] });

    expect(screen.getByLabelText('Tên người nhận')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Giao tới địa chỉ khác/ })).not.toBeInTheDocument();
  });

  it('form để trống: báo lỗi từng ô và không gửi đơn', async () => {
    const calls = await openCheckout(undefined, { 'GET /users/me/addresses': [200, []] });

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    expect(await screen.findByText('Vui lòng nhập tên người nhận')).toBeInTheDocument();
    expect(screen.getByText('Số điện thoại phải gồm 10 số và bắt đầu bằng 0')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập tỉnh/thành phố')).toBeInTheDocument();
    // Quận/huyện không bắt buộc (nhiều địa phương đã bỏ cấp này)
    expect(screen.queryByText('Vui lòng nhập quận/huyện')).not.toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập phường/xã')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập số nhà, tên đường')).toBeInTheDocument();
    expect(orders(calls)).toHaveLength(0);
  });

  it('số điện thoại sai thì báo lỗi ở ô đó', async () => {
    const calls = await openCheckout(undefined, { 'GET /users/me/addresses': [200, []] });

    await fillNewAddress({ 'Số điện thoại người nhận': '12345' });
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    expect(
      await screen.findByText('Số điện thoại phải gồm 10 số và bắt đầu bằng 0'),
    ).toBeInTheDocument();
    expect(orders(calls)).toHaveLength(0);
  });

  it('không tải được sổ địa chỉ thì báo và vẫn cho nhập địa chỉ mới', async () => {
    await openCheckout(undefined, {
      'GET /users/me/addresses': [500, apiError('INTERNAL_ERROR', 'Lỗi')],
    });

    expect(screen.getByText(/Không tải được sổ địa chỉ/)).toBeInTheDocument();
    expect(screen.getByLabelText('Tên người nhận')).toBeInTheDocument();
  });
});

describe('Trang đặt hàng - ghi chú', () => {
  it('ghi chú được cắt khoảng trắng và gửi kèm; ghi chú rỗng thì không gửi', async () => {
    const calls = await openCheckout();

    await userEvent.type(screen.getByLabelText('Ghi chú'), '  Gọi trước khi giao  ');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 2, note: 'Gọi trước khi giao' });
  });

  it('chỉ có dấu cách thì coi như không có ghi chú', async () => {
    const calls = await openCheckout();

    await userEvent.type(screen.getByLabelText('Ghi chú'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 2 });
  });

  it('ghi chú quá 500 ký tự thì báo lỗi và không gửi', async () => {
    const calls = await openCheckout();

    await userEvent.click(screen.getByLabelText('Ghi chú'));
    await userEvent.paste('a'.repeat(501));
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    expect(await screen.findByText('Ghi chú tối đa 500 ký tự')).toBeInTheDocument();
    expect(orders(calls)).toHaveLength(0);
  });
});

describe('Trang đặt hàng - xác nhận', () => {
  it('đặt thành công: chuyển tới trang đơn hàng kèm khung thành công và mã đơn (AC3)', async () => {
    await openCheckout();

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    expect(await screen.findByText('Đặt hàng thành công!')).toBeInTheDocument();
    expect(screen.getAllByText('TS261028-ABCD').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Đơn hàng/, level: 1 })).toBeInTheDocument();
  });

  it('đặt thành công thì giỏ ở đầu trang về 0 ngay', async () => {
    await openCheckout(makeCart([line(1, { quantity: 2, lineTotal: 2000000 })]));
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (2)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    await screen.findByText('Đặt hàng thành công!');
    expect(screen.getByRole('link', { name: 'Giỏ hàng (0)' })).toBeInTheDocument();
  });

  it('bấm đúp chỉ gửi một đơn: nút bị khóa trong lúc đang gửi (AC6)', async () => {
    const calls = await openCheckout();
    const button = screen.getByRole('button', { name: 'Xác nhận đặt hàng' });

    await userEvent.dblClick(button);

    await screen.findByText('Đặt hàng thành công!');
    expect(orders(calls)).toHaveLength(1);
  });

  it('hết hàng: báo rõ từng sản phẩm, dẫn về giỏ hàng, giữ nguyên trang (AC4)', async () => {
    await openCheckout(undefined, {
      'POST /orders': [
        409,
        apiError('CART_NOT_PURCHASABLE', 'Không thể đặt hàng: Sản phẩm 1 chỉ còn 1 (bạn đặt 2)', {
          items: [
            {
              productId: 101,
              name: 'Sản phẩm 1',
              requested: 2,
              available: 1,
              reason: 'INSUFFICIENT_STOCK',
            },
            {
              productId: 102,
              name: 'Sản phẩm 2',
              requested: 1,
              available: 0,
              reason: 'OUT_OF_STOCK',
            },
            {
              productId: 103,
              name: 'Sản phẩm 3',
              requested: 1,
              available: 0,
              reason: 'UNAVAILABLE',
            },
          ],
        }),
      ],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    const alerts = await screen.findAllByRole('alert');
    const detail = alerts.find((el) => el.textContent.includes('cần bạn điều chỉnh'));
    expect(detail).toHaveTextContent('Sản phẩm 1: chỉ còn 1 (bạn đặt 2)');
    expect(detail).toHaveTextContent('Sản phẩm 2: đã hết hàng');
    expect(detail).toHaveTextContent('Sản phẩm 3: không còn được bán');
    expect(within(detail).getByRole('link', { name: 'Quay lại giỏ hàng' })).toHaveAttribute(
      'href',
      '/gio-hang',
    );
    expect(screen.getByRole('heading', { name: 'Đặt hàng', level: 1 })).toBeInTheDocument();
  });

  it('hết hàng thì tải lại giỏ để lấy trạng thái mới', async () => {
    const calls = await openCheckout(undefined, {
      'POST /orders': [
        409,
        apiError('CART_NOT_PURCHASABLE', 'Không thể đặt hàng: hết hàng', { items: [] }),
      ],
    });
    const before = calls.filter((c) => c.key === 'GET /cart').length;

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    await waitFor(() =>
      expect(calls.filter((c) => c.key === 'GET /cart').length).toBeGreaterThan(before),
    );
  });

  it('lỗi máy chủ khác: hiện thông báo chung, nút dùng lại được', async () => {
    await openCheckout(undefined, {
      'POST /orders': [500, apiError('INTERNAL_ERROR', 'Đã có lỗi xảy ra, vui lòng thử lại sau')],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Đã có lỗi xảy ra');
    expect(screen.getByRole('button', { name: 'Xác nhận đặt hàng' })).toBeEnabled();
  });

  it('giỏ trống do đã đặt ở nơi khác (EMPTY_CART): báo thông báo của máy chủ', async () => {
    await openCheckout(undefined, {
      'POST /orders': [400, apiError('EMPTY_CART', 'Giỏ hàng của bạn đang trống')],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Giỏ hàng của bạn đang trống');
  });
});

// ---------------------------------------------------------------------------
// Nút đặt hàng ở trang giỏ
// ---------------------------------------------------------------------------
describe('Nút đặt hàng ở trang giỏ hàng', () => {
  it('đã đăng nhập, giỏ mua được: dẫn tới /dat-hang', async () => {
    signIn();
    checkoutServer(makeCart([line(1)]));
    renderApp('/gio-hang');

    expect(await screen.findByRole('link', { name: 'Tiến hành đặt hàng' })).toHaveAttribute(
      'href',
      '/dat-hang',
    );
  });

  it('có dòng cần xử lý thì nút bị khóa', async () => {
    signIn();
    checkoutServer(makeCart([line(1, { status: 'UNAVAILABLE' })]));
    renderApp('/gio-hang');

    expect(await screen.findByRole('button', { name: 'Tiến hành đặt hàng' })).toBeDisabled();
  });

  it('khách chưa đăng nhập: nút vẫn là "Tiến hành đặt hàng" và dẫn tới /dat-hang (F13)', async () => {
    localStorage.setItem('techstore.guestCart', JSON.stringify([{ productId: 101, quantity: 1 }]));
    mockServer({
      ...storefrontApi,
      'POST /cart/preview': [200, makeCart([line(1)])],
    });
    renderApp('/gio-hang');

    expect(await screen.findByRole('link', { name: 'Tiến hành đặt hàng' })).toHaveAttribute(
      'href',
      '/dat-hang',
    );
  });
});

// ---------------------------------------------------------------------------
// Trang đơn hàng
// ---------------------------------------------------------------------------
describe('Trang đơn hàng', () => {
  const openOrder = async (extra = {}, path = '/don-hang/TS261028-ABCD') => {
    signIn();
    checkoutServer(emptyCart, extra);
    renderApp(path);
  };

  it('hiện mã đơn, trạng thái, thời gian đặt, địa chỉ, ghi chú, sản phẩm, tổng tiền', async () => {
    await openOrder();

    expect(
      await screen.findByRole('heading', { name: /Đơn hàng TS261028-ABCD/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Chờ xác nhận', { selector: 'span' })).toBeInTheDocument();
    // Giờ Việt Nam hiển thị trước ngày; lấy giờ UTC giữa ngày để đúng với mọi múi giờ gần Việt Nam
    expect(screen.getByText(/Đặt lúc .*28\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText('Người nhận B · 0922222222')).toBeInTheDocument();
    expect(screen.getByText('2 Hùng Vương, Phường Điện Biên, Ba Đình, Hà Nội')).toBeInTheDocument();
    expect(screen.getByText('Ghi chú: Gọi trước khi giao')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sản phẩm 1' })).toHaveAttribute(
      'href',
      '/san-pham/san-pham-1',
    );
    expect(screen.getByText('Mã: SKU-1')).toBeInTheDocument();
    const totals = screen.getByRole('region', { name: 'Tổng tiền' });
    expect(totals).toHaveTextContent('2.030.000 ₫');
    expect(totals).toHaveTextContent('30.000 ₫');
  });

  it('thanh toán COD chưa thanh toán (BR-08) và lịch sử trạng thái', async () => {
    await openOrder();

    await screen.findByRole('heading', { name: /Đơn hàng/, level: 1 });
    expect(screen.getByRole('region', { name: 'Tổng tiền' })).toHaveTextContent(
      'Thanh toán khi nhận hàng (COD) · Chưa thanh toán',
    );
    const history = screen.getByRole('region', { name: 'Lịch sử đơn hàng' });
    expect(history).toHaveTextContent('Chờ xác nhận');
    expect(history).toHaveTextContent('Đơn hàng được tạo');
  });

  it('khung "Đặt hàng thành công" chỉ hiện ngay sau khi đặt, không hiện khi mở lại đơn sau này', async () => {
    await openOrder();

    await screen.findByRole('heading', { name: /Đơn hàng/, level: 1 });
    expect(screen.queryByText('Đặt hàng thành công!')).not.toBeInTheDocument();
  });

  it('miễn phí vận chuyển và đơn đã thanh toán hiển thị đúng', async () => {
    await openOrder({
      'GET /orders/TS261028-ABCD': [
        200,
        {
          ...placedOrder,
          shippingFee: 0,
          total: 2000000,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
          note: null,
        },
      ],
    });

    await screen.findByRole('heading', { name: /Đơn hàng/, level: 1 });
    const totals = screen.getByRole('region', { name: 'Tổng tiền' });
    expect(totals).toHaveTextContent('Miễn phí');
    expect(totals).toHaveTextContent('Đã thanh toán');
    expect(screen.getByText('Hoàn thành', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText(/Ghi chú:/)).not.toBeInTheDocument();
  });

  it('đơn không tồn tại hoặc của người khác: báo không tìm thấy', async () => {
    await openOrder({
      'GET /orders/TS261028-ABCD': [404, apiError('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng')],
    });

    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy đơn hàng' }),
    ).toBeInTheDocument();
  });

  it('mã đơn sai định dạng (400) cũng báo không tìm thấy', async () => {
    await openOrder(
      { 'GET /orders/abc': [400, apiError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ')] },
      '/don-hang/abc',
    );

    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy đơn hàng' }),
    ).toBeInTheDocument();
  });

  it('lỗi máy chủ: hiện thông báo, Thử lại tải được lại', async () => {
    let attempts = 0;
    await openOrder({
      'GET /orders/TS261028-ABCD': () => {
        attempts += 1;
        return attempts <= 2
          ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')]
          : [200, placedOrder];
      },
    });

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Lỗi máy chủ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(
      await screen.findByRole('heading', { name: /Đơn hàng TS261028-ABCD/ }),
    ).toBeInTheDocument();
  });

  it('chưa đăng nhập và chưa nhớ số điện thoại của đơn: chuyển tới trang tra cứu, điền sẵn mã đơn (F13)', async () => {
    mockServer(storefrontApi);
    renderApp('/don-hang/TS261028-ABCD');

    expect(
      await screen.findByRole('heading', { name: 'Tra cứu đơn hàng', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mã đơn hàng')).toHaveValue('TS261028-ABCD');
  });

  it('đặt tiêu đề tab trình duyệt theo mã đơn', async () => {
    await openOrder();

    await waitFor(() => expect(document.title).toBe('Đơn hàng TS261028-ABCD - TechStore'));
  });
});
