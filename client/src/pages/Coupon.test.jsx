/**
 * @feature [F09] Mã giảm giá - Kiểm thử giao diện Client: ô nhập mã ở trang đặt hàng (US-25 AC1 đến AC4), tiền giảm, phí ship và
 * điểm thành viên tính trên tiền hàng sau giảm (BR-14, BR-05, BR-15), gửi mã kèm đơn và hiển thị mã trên trang đơn hàng.
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
const makeCart = (subtotal) => ({
  items: [
    {
      id: 1,
      productId: 101,
      quantity: 1,
      product: {
        name: 'Sản phẩm 1',
        slug: 'san-pham-1',
        price: subtotal,
        salePrice: null,
        thumbnail: null,
        brand: { name: 'Apple' },
        category: { name: 'Điện thoại' },
      },
      unitPrice: subtotal,
      lineTotal: subtotal,
      stock: 5,
      status: 'OK',
    },
  ],
  totalQuantity: 1,
  subtotal,
  canCheckout: true,
});

const placedOrder = {
  id: 1,
  code: 'TS261030-ABCD',
  status: 'PENDING',
  paymentMethod: 'COD',
  paymentStatus: 'UNPAID',
  subtotal: 2000000,
  discount: 200000,
  couponCode: 'GIAM10',
  shippingFee: 30000,
  total: 1830000,
  recipientName: 'Người nhận B',
  phone: '0922222222',
  shippingAddress: '2 Hùng Vương, Hà Nội',
  note: null,
  createdAt: '2026-10-30T06:00:00.000Z',
  isGuest: false,
  pointsEarned: 0,
  pointsExpected: 1,
  items: [
    {
      id: 1,
      productId: 101,
      productName: 'Sản phẩm 1',
      productSku: 'SKU-1',
      unitPrice: 2000000,
      quantity: 1,
      lineTotal: 2000000,
      slug: 'san-pham-1',
      thumbnail: null,
    },
  ],
  history: [
    { status: 'PENDING', note: 'Đơn hàng được tạo', createdAt: '2026-10-30T06:00:00.000Z' },
  ],
};

const address = {
  id: 2,
  recipientName: 'Người nhận B',
  phone: '0922222222',
  province: 'Hà Nội',
  district: 'Ba Đình',
  ward: 'Phường Điện Biên',
  street: '2 Hùng Vương',
  isDefault: true,
};

// Mã giả: GIAM10 giảm 10%, các mã khác báo lỗi theo tên
// Tiền hàng của giỏ giả (một dòng, sản phẩm 101); máy chủ thật tự tính từ giá trong CSDL, ở đây mô phỏng bằng biến này
let cartSubtotal = 2000000;

const previewHandler = (config, body) => {
  const bySubtotal = { PERCENT: Math.floor((cartSubtotal * 10) / 100) };
  if (body.code === 'GIAM10') {
    return [
      200,
      { code: 'GIAM10', type: 'PERCENT', value: 10, minOrder: 0, discount: bySubtotal.PERCENT },
    ];
  }
  if (body.code === 'GIAM600K') {
    return [200, { code: 'GIAM600K', type: 'FIXED', value: 600000, minOrder: 0, discount: 600000 }];
  }
  if (body.code === 'GIAM500K') {
    return [200, { code: 'GIAM500K', type: 'FIXED', value: 500000, minOrder: 0, discount: 500000 }];
  }
  if (body.code === 'PHUKIEN') {
    // Mã chỉ áp dụng cho một số sản phẩm: giảm trên phần được áp dụng (500.000 ₫) chứ không phải cả giỏ
    return [
      200,
      {
        code: 'PHUKIEN',
        type: 'PERCENT',
        value: 10,
        minOrder: 0,
        minPoints: 0,
        scoped: true,
        eligibleSubtotal: 500000,
        discount: 50000,
      },
    ];
  }
  if (body.code === 'CANDIEM') {
    return [
      400,
      apiError(
        'COUPON_MIN_POINTS',
        body.items
          ? 'Mã này dành cho thành viên có từ 50 điểm trở lên. Hãy đăng nhập để dùng mã'
          : '',
        { minPoints: 50, points: null },
      ),
    ];
  }
  if (body.code === 'CANDIEMTV') {
    return [
      400,
      apiError(
        'COUPON_MIN_POINTS',
        'Bạn cần có từ 50 điểm thành viên để dùng mã này (hiện có 3 điểm)',
        { minPoints: 50, points: 3 },
      ),
    ];
  }
  if (body.code === 'HETHAN') {
    return [400, apiError('COUPON_EXPIRED', 'Mã giảm giá đã hết hạn')];
  }
  return [404, apiError('COUPON_NOT_FOUND', 'Mã giảm giá không tồn tại')];
};

const openCheckout = async (subtotal = 2000000, extra = {}) => {
  cartSubtotal = subtotal;
  tokenStorage.setTokens(session);
  const calls = mockServer({
    ...storefrontApi,
    'GET /users/me': [200, customer],
    'GET /cart': [200, makeCart(subtotal)],
    'GET /users/me/addresses': [200, [address]],
    'POST /coupons/preview': previewHandler,
    'POST /coupons/auto': [200, { coupon: null }], // mặc định không có mã tự động áp dụng
    'POST /orders': [201, placedOrder],
    'GET /orders/TS261030-ABCD': [200, placedOrder],
    ...extra,
  });
  renderApp('/dat-hang');
  await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });
  return calls;
};

const summary = () => screen.getByRole('complementary', { name: 'Đơn hàng của bạn' });
const codeInput = () => screen.getByLabelText('Mã giảm giá');

const applyCode = async (code) => {
  await userEvent.type(codeInput(), code);
  await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
};

const orders = (calls) => calls.filter((c) => c.key === 'POST /orders');

// ---------------------------------------------------------------------------
describe('Ô nhập mã giảm giá ở trang đặt hàng (US-25)', () => {
  it('hiện ô nhập mã ở bước riêng, mặc định chưa áp mã nào', async () => {
    await openCheckout();

    expect(screen.getByRole('heading', { name: /Mã giảm giá/ })).toBeInTheDocument();
    expect(codeInput()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Áp dụng' })).toBeDisabled();
    expect(within(summary()).queryByText(/Mã giảm giá \(/)).not.toBeInTheDocument();
  });

  it('mã hợp lệ: hiện ngay số tiền giảm và tổng mới (AC1)', async () => {
    const calls = await openCheckout(2000000);
    await applyCode('giam10');

    expect(await screen.findByText(/Đã áp dụng mã/)).toHaveTextContent(
      'Đã áp dụng mã GIAM10: giảm 200.000 ₫',
    );
    const preview = calls.find((c) => c.key === 'POST /coupons/preview');
    // Gửi giỏ hàng (không gửi số tiền): máy chủ tự biết giá, danh mục, thương hiệu của từng món; mã đã tự chuyển in hoa
    expect(preview.body).toEqual({ code: 'GIAM10', items: [{ productId: 101, quantity: 1 }] });

    expect(within(summary()).getByText('Mã giảm giá (GIAM10)')).toBeInTheDocument();
    expect(within(summary()).getByText('-200.000 ₫')).toBeInTheDocument();
    // 2.000.000 - 200.000 + 30.000 phí ship
    expect(within(summary()).getByText('1.830.000 ₫')).toBeInTheDocument();
  });

  it('nhấn Enter trong ô mã chỉ áp mã, không gửi đơn hàng', async () => {
    const calls = await openCheckout();
    await userEvent.type(codeInput(), 'GIAM10{Enter}');

    expect(await screen.findByText(/Đã áp dụng mã/)).toBeInTheDocument();
    expect(orders(calls)).toHaveLength(0);
  });

  it('mã sai hoặc hết hạn: nói đúng lý do, không giảm tiền (AC2)', async () => {
    await openCheckout();
    await applyCode('HETHAN');

    expect(await screen.findByText('Mã giảm giá đã hết hạn')).toBeInTheDocument();
    expect(within(summary()).queryByText(/Mã giảm giá \(/)).not.toBeInTheDocument();
    expect(within(summary()).getByText('2.030.000 ₫')).toBeInTheDocument();
  });

  it('mã không tồn tại báo rõ; xóa mã để nhập lại', async () => {
    await openCheckout();
    await applyCode('KHONGCO');

    expect(await screen.findByText('Mã giảm giá không tồn tại')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa mã KHONGCO' }));
    expect(screen.queryByText('Mã giảm giá không tồn tại')).not.toBeInTheDocument();
    expect(codeInput()).toHaveValue('');
  });

  it('bỏ mã thì tổng tiền trở lại như cũ', async () => {
    await openCheckout();
    await applyCode('GIAM10');
    await screen.findByText(/Đã áp dụng mã/);

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ mã' }));
    expect(screen.queryByText(/Đã áp dụng mã/)).not.toBeInTheDocument();
    expect(within(summary()).getByText('2.030.000 ₫')).toBeInTheDocument();
    expect(codeInput()).toBeInTheDocument();
  });

  it('đang áp một mã thì không còn ô nhập mã thứ hai (AC4: mỗi đơn một mã)', async () => {
    await openCheckout();
    await applyCode('GIAM10');
    await screen.findByText(/Đã áp dụng mã/);

    expect(screen.queryByLabelText('Mã giảm giá')).not.toBeInTheDocument();
  });
});

describe('Mã có điều kiện phụ (phạm vi, điểm tối thiểu)', () => {
  it('mã chỉ áp dụng cho một số sản phẩm: ghi rõ và chỉ giảm trên phần được áp dụng', async () => {
    await openCheckout(2000000);
    await applyCode('phukien');

    expect(await screen.findByText(/Đã áp dụng mã/)).toHaveTextContent(
      'giảm 50.000 ₫ (chỉ áp dụng cho một số sản phẩm trong giỏ)',
    );
    // 2.000.000 - 50.000 + 30.000, không phải trừ 10% của cả giỏ
    expect(within(summary()).getByText('-50.000 ₫')).toBeInTheDocument();
    expect(within(summary()).getByText('1.980.000 ₫')).toBeInTheDocument();
  });

  it('thành viên chưa đủ điểm: báo số điểm cần và có, không có nút đăng nhập', async () => {
    await openCheckout();
    await applyCode('candiemtv');

    expect(
      await screen.findByText('Bạn cần có từ 50 điểm thành viên để dùng mã này (hiện có 3 điểm)'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Đăng nhập để dùng mã này' }),
    ).not.toBeInTheDocument();
    expect(within(summary()).queryByText(/Mã giảm giá \(/)).not.toBeInTheDocument();
  });

  it('khách chưa đăng nhập gặp mã cần điểm: báo lý do và mời đăng nhập, giỏ hàng giữ nguyên', async () => {
    cartSubtotal = 2000000;
    localStorage.setItem('techstore.guestCart', JSON.stringify([{ productId: 101, quantity: 1 }]));
    mockServer({
      ...storefrontApi,
      'POST /cart/preview': [200, makeCart(2000000)],
      'POST /coupons/preview': previewHandler,
    });
    renderApp('/dat-hang');
    await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });
    await applyCode('candiem');

    expect(
      await screen.findByText(
        'Mã này dành cho thành viên có từ 50 điểm trở lên. Hãy đăng nhập để dùng mã',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Đăng nhập để dùng mã này' })).toHaveAttribute(
      'href',
      '/dang-nhap',
    );
    expect(JSON.parse(localStorage.getItem('techstore.guestCart'))).toEqual([
      { productId: 101, quantity: 1 },
    ]);
  });
});

describe('Tiền hàng sau giảm quyết định phí ship và điểm (BR-14)', () => {
  it('phí ship tính trên tiền hàng sau giảm: 5,2 triệu giảm 500 nghìn thì phải trả phí', async () => {
    await openCheckout(5200000);
    expect(within(summary()).getByText('Miễn phí')).toBeInTheDocument();

    await applyCode('GIAM500K');
    await screen.findByText(/Đã áp dụng mã/);
    expect(within(summary()).queryByText('Miễn phí')).not.toBeInTheDocument();
    expect(within(summary()).getByText('30.000 ₫')).toBeInTheDocument();
    // 5.200.000 - 500.000 + 30.000
    expect(within(summary()).getByText('4.730.000 ₫')).toBeInTheDocument();
  });

  it('điểm thành viên tính trên tiền hàng sau giảm', async () => {
    await openCheckout(1500000);
    expect(
      screen.getByText('Bạn sẽ nhận 1 điểm thành viên khi đơn hoàn thành.'),
    ).toBeInTheDocument();

    await applyCode('GIAM600K'); // còn 900.000 đ nên chưa đủ 1 điểm
    await screen.findByText(/Đã áp dụng mã/);
    expect(screen.queryByText(/Bạn sẽ nhận/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Mua thêm 100\.000 ₫ nữa \(tính cả đơn này\) để được thêm 1 điểm/),
    ).toBeInTheDocument();
  });
});

describe('Đặt hàng có mã giảm giá', () => {
  it('gửi mã đã áp dụng kèm đơn rồi chuyển tới trang đơn hàng hiện mã và tiền giảm', async () => {
    const calls = await openCheckout(2000000);
    await applyCode('GIAM10');
    await screen.findByText(/Đã áp dụng mã/);

    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 2, couponCode: 'GIAM10' });

    expect(await screen.findByText('Mã giảm giá (GIAM10)')).toBeInTheDocument();
    expect(screen.getByText('-200.000 ₫')).toBeInTheDocument();
  });

  it('mã đang lỗi thì KHÔNG gửi kèm đơn', async () => {
    const calls = await openCheckout();
    await applyCode('HETHAN');
    await screen.findByText('Mã giảm giá đã hết hạn');

    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 2 });
  });

  it('máy chủ từ chối mã lúc đặt (vừa hết lượt): báo lỗi và kiểm tra lại mã', async () => {
    let previews = 0;
    const calls = await openCheckout(2000000, {
      'POST /coupons/preview': (config, body) => {
        previews += 1;
        // Lần đầu còn lượt; sau khi đặt thất bại thì đã hết lượt
        return previews === 1
          ? previewHandler(config, body)
          : [400, apiError('COUPON_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng')];
      },
      'POST /orders': [400, apiError('COUPON_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng')],
    });
    await applyCode('GIAM10');
    await screen.findByText(/Đã áp dụng mã/);

    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));

    const messages = await screen.findAllByText('Mã giảm giá đã hết lượt sử dụng');
    expect(messages.length).toBeGreaterThan(0);
    expect(screen.queryByText(/Đã áp dụng mã/)).not.toBeInTheDocument();
    expect(within(summary()).getByText('2.030.000 ₫')).toBeInTheDocument();
  });

  it('khách chưa đăng nhập cũng dùng được mã và gửi mã kèm đơn', async () => {
    localStorage.setItem('techstore.guestCart', JSON.stringify([{ productId: 101, quantity: 1 }]));
    const calls = mockServer({
      ...storefrontApi,
      'POST /cart/preview': [200, makeCart(2000000)],
      'POST /coupons/preview': previewHandler,
      'POST /orders/guest': [201, { ...placedOrder, isGuest: true, pointsExpected: 0 }],
      'GET /orders/TS261030-ABCD': [200, placedOrder],
      'POST /orders/lookup': [200, { ...placedOrder, isGuest: true }],
    });
    renderApp('/dat-hang');
    await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });

    await applyCode('GIAM10');
    await screen.findByText(/Đã áp dụng mã/);
    expect(within(summary()).getByText('1.830.000 ₫')).toBeInTheDocument();

    const fields = {
      'Tên người nhận': 'Trần Thị B',
      'Số điện thoại người nhận': '0987654321',
      'Tỉnh/Thành phố': 'Đà Nẵng',
      'Phường/Xã': 'Phường Thạch Thang',
      'Số nhà, tên đường': '99 Bạch Đằng',
    };
    for (const [label, value] of Object.entries(fields)) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));

    await waitFor(() => expect(calls.some((c) => c.key === 'POST /orders/guest')).toBe(true));
    const guest = calls.find((c) => c.key === 'POST /orders/guest');
    expect(guest.body.couponCode).toBe('GIAM10');
  });
});

describe('Mã tự động áp dụng ở trang đặt hàng (US-25 AC10)', () => {
  const autoQuote = (overrides = {}) => ({
    code: 'TUDONG',
    type: 'PERCENT',
    value: 10,
    minOrder: 0,
    minPoints: 0,
    scoped: false,
    eligibleSubtotal: 2000000,
    discount: 200000,
    ...overrides,
  });
  // Xem trước của mã tự động: dùng lại hàm giả của các mã khác nhưng thêm mã TUDONG
  const previewWithAuto = (config, body) =>
    body.code === 'TUDONG' ? [200, autoQuote()] : previewHandler(config, body);

  const openWithAuto = (coupon = autoQuote(), extra = {}) =>
    openCheckout(2000000, {
      'POST /coupons/auto': [200, { coupon }],
      'POST /coupons/preview': previewWithAuto,
      ...extra,
    });

  it('tự điền mã giảm nhiều nhất khi vào trang: hiện "tự động áp dụng", giảm giá và tổng mới', async () => {
    const calls = await openWithAuto();

    const box = await screen.findByText(/Đã tự động áp dụng mã/);
    expect(box).toHaveTextContent('Đã tự động áp dụng mã TUDONG: giảm 200.000 ₫');
    expect(within(summary()).getByText('Mã giảm giá (TUDONG)')).toBeInTheDocument();
    expect(within(summary()).getByText('-200.000 ₫')).toBeInTheDocument();
    expect(within(summary()).getByText('1.830.000 ₫')).toBeInTheDocument(); // 2.000.000 - 200.000 + 30.000
    // Khách không phải gõ gì: chỉ gửi giỏ hàng để máy chủ tìm mã
    const request = calls.find((call) => call.key === 'POST /coupons/auto');
    expect(request.body).toEqual({ items: [{ productId: 101, quantity: 1 }] });
    expect(screen.queryByLabelText('Mã giảm giá')).not.toBeInTheDocument();
  });

  it('gửi mã tự động kèm đơn khi đặt hàng', async () => {
    const calls = await openWithAuto();
    await screen.findByText(/Đã tự động áp dụng mã/);

    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 2, couponCode: 'TUDONG' });
  });

  it('không có mã tự động nào: giữ nguyên ô nhập mã như trước', async () => {
    await openWithAuto(null);
    expect(await screen.findByLabelText('Mã giảm giá')).toHaveValue('');
    expect(screen.queryByText(/Đã tự động áp dụng/)).not.toBeInTheDocument();
    expect(within(summary()).getByText('2.030.000 ₫')).toBeInTheDocument();
  });

  it('khách bỏ mã thì mã bị gỡ, hiện lại ô nhập và KHÔNG bị tự điền lại', async () => {
    const calls = await openWithAuto();
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ mã' }));

    expect(await screen.findByLabelText('Mã giảm giá')).toBeInTheDocument();
    expect(screen.queryByText(/Đã tự động áp dụng/)).not.toBeInTheDocument();
    expect(within(summary()).queryByText(/Mã giảm giá \(/)).not.toBeInTheDocument();
    expect(within(summary()).getByText('2.030.000 ₫')).toBeInTheDocument();
    // Đặt hàng sau khi bỏ mã thì không gửi mã nào
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 2 });
  });

  it('bỏ mã tự động thì mã đó vẫn được gợi ý ngay trên ô nhập, không bị mất', async () => {
    await openWithAuto();
    expect(screen.queryByText(/Mã dành cho bạn/)).not.toBeInTheDocument(); // đang áp thì không cần gợi ý
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ mã' }));

    const hint = await screen.findByText(/Mã dành cho bạn/);
    expect(hint).toHaveTextContent('Mã dành cho bạn: TUDONG, giảm 200.000 ₫');
    expect(screen.getByLabelText('Mã giảm giá')).toBeInTheDocument();
    expect(within(summary()).queryByText(/Mã giảm giá \(/)).not.toBeInTheDocument();
  });

  it('bấm "Dùng mã này" áp lại mã vừa bỏ và đặt hàng gửi mã đó', async () => {
    const calls = await openWithAuto();
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ mã' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Dùng mã này' }));

    expect(await screen.findByText(/Đã tự động áp dụng mã/)).toHaveTextContent('TUDONG');
    expect(screen.queryByText(/Mã dành cho bạn/)).not.toBeInTheDocument();
    expect(within(summary()).getByText('1.830.000 ₫')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body.couponCode).toBe('TUDONG');
  });

  it('đang dùng mã khác do khách nhập thì không gợi ý; gỡ mã đó đi thì gợi ý hiện lại', async () => {
    await openWithAuto();
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ mã' }));
    await applyCode('giam500k');
    await screen.findByText(/Đã áp dụng mã/);
    expect(screen.queryByText(/Mã dành cho bạn/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ mã' }));
    expect(await screen.findByText(/Mã dành cho bạn/)).toHaveTextContent('TUDONG');
  });

  it('không có mã tự động thì không có dòng gợi ý', async () => {
    await openWithAuto(null);
    await screen.findByLabelText('Mã giảm giá');
    expect(screen.queryByText(/Mã dành cho bạn/)).not.toBeInTheDocument();
  });

  it('bỏ mã tự động rồi tự nhập mã khác thì dùng mã khách nhập', async () => {
    const calls = await openWithAuto();
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ mã' }));
    await applyCode('giam500k');

    const box = await screen.findByText(/Đã áp dụng mã/);
    expect(box).toHaveTextContent('Đã áp dụng mã GIAM500K: giảm 500.000 ₫'); // mã khách tự nhập, không phải "tự động"
    expect(within(summary()).getByText('Mã giảm giá (GIAM500K)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body.couponCode).toBe('GIAM500K');
    // Mã tự động chỉ được hỏi một lần, không hỏi lại sau khi khách đã chọn
    expect(calls.filter((call) => call.key === 'POST /coupons/auto')).toHaveLength(1);
  });

  it('máy chủ không trả lời được phần tự động: im lặng, vẫn nhập tay và đặt hàng bình thường', async () => {
    const calls = await openCheckout(2000000, {
      'POST /coupons/auto': [500, apiError('INTERNAL_ERROR', 'Máy chủ gặp sự cố')],
    });

    expect(await screen.findByLabelText('Mã giảm giá')).toBeInTheDocument();
    expect(screen.queryByText('Máy chủ gặp sự cố')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));
    expect(orders(calls)[0].body).toEqual({ addressId: 2 });
  });

  it('mã tự động vừa hết lượt lúc đặt hàng: báo lỗi của máy chủ và cho khách bỏ mã hoặc đổi mã', async () => {
    let previews = 0;
    const calls = await openWithAuto(autoQuote(), {
      'POST /coupons/preview': (config, body) => {
        previews += 1;
        return previews === 1
          ? previewWithAuto(config, body)
          : [400, apiError('COUPON_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng')];
      },
      'POST /orders': [400, apiError('COUPON_EXHAUSTED', 'Mã giảm giá đã hết lượt sử dụng')],
    });
    await screen.findByText(/Đã tự động áp dụng mã/);
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(orders(calls)).toHaveLength(1));

    expect((await screen.findAllByText('Mã giảm giá đã hết lượt sử dụng')).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText(/Đã tự động áp dụng/)).not.toBeInTheDocument();
    expect(within(summary()).getByText('2.030.000 ₫')).toBeInTheDocument();
    // Khách xóa mã lỗi để đặt tiếp không kèm mã
    await userEvent.click(screen.getByRole('button', { name: 'Xóa mã TUDONG' }));
    // Thông báo lỗi của ô mã biến mất; còn lại đúng một thông báo là lỗi của lần đặt hàng vừa rồi
    expect(screen.getAllByText('Mã giảm giá đã hết lượt sử dụng')).toHaveLength(1);
  });

  it('khách chưa đăng nhập cũng được tự áp dụng và gửi mã kèm đơn khách', async () => {
    cartSubtotal = 2000000;
    localStorage.setItem('techstore.guestCart', JSON.stringify([{ productId: 101, quantity: 1 }]));
    const calls = mockServer({
      ...storefrontApi,
      'POST /cart/preview': [200, makeCart(2000000)],
      'POST /coupons/auto': [200, { coupon: autoQuote() }],
      'POST /coupons/preview': previewWithAuto,
      'POST /orders/guest': [201, { ...placedOrder, isGuest: true }],
      'GET /orders/TS261030-ABCD': [200, placedOrder],
      'POST /orders/lookup': [200, { ...placedOrder, isGuest: true }],
    });
    renderApp('/dat-hang');
    await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });
    // Khách vãng lai: xem trước giỏ, hỏi mã tự động rồi xem trước mã, ba lần gọi nối tiếp nên chờ lâu hơn mặc định
    // (Mã nằm trong thẻ <strong> nên tìm theo phần chữ bên ngoài rồi kiểm tra toàn bộ nội dung)
    expect(
      await screen.findByText(/Đã tự động áp dụng mã/, {}, { timeout: 4000 }),
    ).toHaveTextContent('Đã tự động áp dụng mã TUDONG');

    const fields = {
      'Tên người nhận': 'Trần Thị B',
      'Số điện thoại người nhận': '0987654321',
      'Tỉnh/Thành phố': 'Đà Nẵng',
      'Phường/Xã': 'Phường Thạch Thang',
      'Số nhà, tên đường': '99 Bạch Đằng',
    };
    for (const [label, value] of Object.entries(fields)) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
    await userEvent.click(screen.getByRole('button', { name: /Xác nhận đặt hàng/ }));
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /orders/guest')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /orders/guest').body.couponCode).toBe('TUDONG');
  });
});
