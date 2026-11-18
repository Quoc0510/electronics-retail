/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Kiểm thử giao diện Client: ô chọn tỉnh và phường/xã theo danh mục GHN,
 * phí lấy từ GHN theo địa chỉ, miễn phí theo ngưỡng của cửa hàng, báo lỗi khi GHN không giao tới, phí ước tính khi GHN sự cố,
 * và lùi về ô nhập tay khi không tải được danh mục (US-37). Backend giả, GHN thật không bị gọi.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GUEST_CART_KEY } from '../lib/guestCart.js';
import { apiError, mockServer, renderApp, storefrontApi } from '../test/utils.jsx';

const GHN_CONFIG = { provider: 'GHN', fallbackFee: 30000, freeThreshold: 5000000 };
const PROVINCES = {
  items: [
    { id: 1000001, name: 'Hồ Chí Minh' },
    { id: 1000002, name: 'Đà Nẵng' },
  ],
};
const WARDS = {
  items: [
    { id: 1, name: 'Phường Sài Gòn' },
    { id: 2, name: 'Phường Bến Thành' },
  ],
};

const makeCart = (unitPrice = 1000000, quantity = 2) => {
  const lineTotal = unitPrice * quantity;
  return {
    items: [
      {
        id: 101,
        productId: 101,
        quantity,
        product: {
          name: 'Sản phẩm 1',
          slug: 'san-pham-1',
          price: unitPrice,
          salePrice: null,
          thumbnail: null,
          brand: { name: 'Apple' },
          category: { name: 'Điện thoại' },
        },
        unitPrice,
        lineTotal,
        stock: 5,
        status: 'OK',
      },
    ],
    totalQuantity: quantity,
    subtotal: lineTotal,
    canCheckout: true,
  };
};

const placedOrder = {
  id: 1,
  code: 'TS261118-ABCD',
  status: 'PENDING',
  paymentMethod: 'COD',
  paymentStatus: 'UNPAID',
  subtotal: 2000000,
  discount: 0,
  shippingFee: 25000,
  total: 2025000,
  recipientName: 'Trần Thị B',
  phone: '0987654321',
  shippingAddress: '72 Lê Thánh Tôn, Phường Sài Gòn, Hồ Chí Minh',
  note: null,
  cancelReason: null,
  createdAt: '2026-11-18T06:00:00.000Z',
  isGuest: true,
  pointsEarned: 0,
  pointsExpected: 0,
  items: [],
  history: [],
};

const ghnServer = (extra = {}, cart = makeCart()) => {
  localStorage.setItem(
    GUEST_CART_KEY,
    JSON.stringify([{ productId: 101, quantity: cart.totalQuantity }]),
  );
  return mockServer({
    ...storefrontApi,
    'POST /cart/preview': [200, cart],
    'GET /shipping/config': [200, GHN_CONFIG],
    'GET /shipping/provinces': [200, PROVINCES],
    'GET /shipping/provinces/1000001/wards': [200, WARDS],
    'POST /shipping/quote': [
      200,
      { ...GHN_CONFIG, fee: 25000, source: 'GHN', expectedDeliveryTime: null },
    ],
    'POST /orders/guest': [201, placedOrder],
    ...extra,
  });
};

const openCheckout = async () => {
  renderApp('/dat-hang');
  await screen.findByRole('heading', { name: 'Đặt hàng', level: 1 });
};

// Ban đầu là ô nhập tay, đổi thành ô chọn có tìm kiếm khi biết cửa hàng bật GHN và đã tải xong danh mục tỉnh
const provinceBox = async () => {
  await waitFor(() =>
    expect(screen.getByLabelText('Tỉnh/Thành phố')).toHaveAttribute('role', 'combobox'),
  );
  return screen.getByLabelText('Tỉnh/Thành phố');
};

// Mở ô, rồi bấm vào mục có tên đó trong danh sách
const choose = async (box, name) => {
  await userEvent.click(box);
  await userEvent.click(await screen.findByRole('option', { name }));
};

// Chọn tỉnh rồi phường/xã (ô phường/xã chỉ dùng được sau khi tải danh mục của tỉnh)
const pickAddress = async (ward = 'Phường Sài Gòn') => {
  await choose(await provinceBox(), 'Hồ Chí Minh');
  const wardBox = screen.getByLabelText('Phường/Xã');
  await waitFor(() => expect(wardBox).toBeEnabled());
  await choose(wardBox, ward);
};

const feeRow = () => screen.getByText('Phí vận chuyển').closest('div');

describe('Trang đặt hàng khi bật Giao Hàng Nhanh', () => {
  it('tỉnh và phường/xã là ô chọn theo danh mục GHN, không còn ô quận/huyện', async () => {
    ghnServer();
    await openCheckout();

    await provinceBox();
    expect(screen.queryByLabelText('Quận/Huyện (nếu có)')).not.toBeInTheDocument();
    // Chưa chọn tỉnh thì chưa chọn được phường/xã
    expect(screen.getByLabelText('Phường/Xã')).toBeDisabled();
  });

  it('chưa có địa chỉ thì chưa tính phí và không gọi GHN', async () => {
    const calls = ghnServer();
    await openCheckout();
    await provinceBox();

    expect(feeRow()).toHaveTextContent('Chọn địa chỉ để tính');
    expect(calls.some((c) => c.key === 'POST /shipping/quote')).toBe(false);
  });

  it('chọn xong tỉnh và phường/xã thì gửi giỏ + địa chỉ lên API, hiện phí GHN và cộng vào tổng', async () => {
    const calls = ghnServer();
    await openCheckout();

    await pickAddress();

    await waitFor(() => expect(feeRow()).toHaveTextContent('25.000'));
    expect(calls.find((c) => c.key === 'POST /shipping/quote').body).toEqual({
      items: [{ productId: 101, quantity: 2 }],
      province: 'Hồ Chí Minh',
      ward: 'Phường Sài Gòn',
    });
    expect(screen.getByText('Tổng thanh toán').closest('div')).toHaveTextContent('2.025.000');
  });

  it('phường/xã tìm được bằng cách gõ, kể cả gõ không dấu; không khớp thì báo không có kết quả', async () => {
    ghnServer();
    await openCheckout();
    await choose(await provinceBox(), 'Hồ Chí Minh');
    const wardBox = screen.getByLabelText('Phường/Xã');
    await waitFor(() => expect(wardBox).toBeEnabled());

    await userEvent.click(wardBox);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await userEvent.type(wardBox, 'ben thanh'); // không dấu

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Phường Bến Thành' })).toBeInTheDocument();

    await userEvent.clear(wardBox);
    await userEvent.type(wardBox, 'xyz');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByText('Không có kết quả phù hợp')).toBeInTheDocument();
  });

  it('chọn phường/xã bằng bàn phím: mũi tên xuống rồi Enter, không gửi form', async () => {
    const calls = ghnServer();
    await openCheckout();
    await choose(await provinceBox(), 'Hồ Chí Minh');
    const wardBox = screen.getByLabelText('Phường/Xã');
    await waitFor(() => expect(wardBox).toBeEnabled());

    await userEvent.click(wardBox);
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(wardBox).toHaveValue('Phường Bến Thành');
    expect(calls.some((c) => c.key === 'POST /orders/guest')).toBe(false);
  });

  it('đổi tỉnh thì phường/xã đã chọn bị xóa', async () => {
    ghnServer({
      'GET /shipping/provinces/1000002/wards': [
        200,
        { items: [{ id: 9, name: 'Phường Hải Châu' }] },
      ],
    });
    await openCheckout();
    await pickAddress();

    await choose(await provinceBox(), 'Đà Nẵng');

    await waitFor(() => expect(screen.getByLabelText('Phường/Xã')).toHaveValue(''));
  });

  it('tiền hàng sau giảm đạt ngưỡng của cửa hàng thì miễn phí dù GHN báo phí', async () => {
    ghnServer({}, makeCart(3000000, 2)); // 6.000.000 đ
    await openCheckout();

    await pickAddress();

    await waitFor(() => expect(feeRow()).toHaveTextContent('Miễn phí'));
    expect(screen.getByText('Tổng thanh toán').closest('div')).toHaveTextContent('6.000.000');
  });

  it('GHN không giao tới địa chỉ: báo lỗi, không có phí và khóa nút đặt hàng', async () => {
    ghnServer({
      'POST /shipping/quote': [
        422,
        apiError('SHIPPING_UNAVAILABLE', 'Giao Hàng Nhanh chưa hỗ trợ giao tới địa chỉ này'),
      ],
    });
    await openCheckout();

    await pickAddress();

    expect(await screen.findByRole('alert')).toHaveTextContent('chưa hỗ trợ giao tới địa chỉ này');
    expect(feeRow()).toHaveTextContent('Không giao được');
    expect(screen.getByRole('button', { name: 'Xác nhận đặt hàng' })).toBeDisabled();
  });

  it('GHN sự cố (phí cố định thay thế) thì ghi "ước tính" nhưng vẫn đặt được', async () => {
    ghnServer({
      'POST /shipping/quote': [
        200,
        { ...GHN_CONFIG, fee: 30000, source: 'FALLBACK', expectedDeliveryTime: null },
      ],
    });
    await openCheckout();

    await pickAddress();

    await waitFor(() => expect(feeRow()).toHaveTextContent('30.000'));
    expect(feeRow()).toHaveTextContent('(ước tính)');
    expect(screen.getByRole('button', { name: 'Xác nhận đặt hàng' })).toBeEnabled();
  });

  it('đặt hàng gửi tên tỉnh và phường/xã đúng như danh mục GHN, quận/huyện để trống', async () => {
    const calls = ghnServer();
    await openCheckout();
    await userEvent.type(screen.getByLabelText('Tên người nhận'), 'Trần Thị B');
    await userEvent.type(screen.getByLabelText('Số điện thoại người nhận'), '0987654321');
    await pickAddress();
    await userEvent.type(screen.getByLabelText('Số nhà, tên đường'), '72 Lê Thánh Tôn');
    await waitFor(() => expect(feeRow()).toHaveTextContent('25.000'));

    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đặt hàng' }));

    await waitFor(() => expect(calls.some((c) => c.key === 'POST /orders/guest')).toBe(true));
    expect(calls.find((c) => c.key === 'POST /orders/guest').body.shipping).toEqual({
      recipientName: 'Trần Thị B',
      phone: '0987654321',
      province: 'Hồ Chí Minh',
      district: '',
      ward: 'Phường Sài Gòn',
      street: '72 Lê Thánh Tôn',
    });
  });

  it('không tải được danh mục tỉnh thì quay về ô nhập tay như cũ', async () => {
    ghnServer({ 'GET /shipping/provinces': [502, apiError('SHIPPING_UNAVAILABLE', 'Lỗi')] });
    await openCheckout();

    const province = await screen.findByLabelText('Tỉnh/Thành phố');
    await waitFor(() => expect(province).not.toHaveAttribute('role', 'combobox'));
    expect(screen.getByLabelText('Quận/Huyện (nếu có)')).toBeInTheDocument();
  });
});

describe('Giỏ hàng khi bật Giao Hàng Nhanh', () => {
  it('phí phụ thuộc địa chỉ nên báo "Tính khi đặt hàng" và tổng là tạm tính', async () => {
    ghnServer();
    renderApp('/gio-hang');

    expect(await screen.findByText('Tính khi đặt hàng')).toBeInTheDocument();
    expect(screen.getByText('Tạm tính (chưa gồm phí vận chuyển)')).toBeInTheDocument();
  });
});

describe('Cửa hàng không đặt ngưỡng miễn phí (freeThreshold = 0)', () => {
  it('giỏ hàng không hiện gợi ý mua thêm để được miễn phí', async () => {
    ghnServer({
      'GET /shipping/config': [200, { ...GHN_CONFIG, provider: 'FIXED', freeThreshold: 0 }],
    });
    renderApp('/gio-hang');

    expect(await screen.findByText('Phí vận chuyển')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/miễn phí vận chuyển/i)).not.toBeInTheDocument());
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
