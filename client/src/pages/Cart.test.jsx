/**
 * @feature [F05] Giỏ hàng - Kiểm thử giao diện giỏ hàng của Client: biểu tượng giỏ, nút thêm vào giỏ (thẻ và trang chi tiết),
 * bộ chọn số lượng, trang /gio-hang (sửa, xóa, trạng thái dòng, phí vận chuyển) và quy tắc phí BR-05 (US-14, US-15).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { amountToFreeShipping, shippingFee } from '../lib/shipping.js';
import QuantityStepper from '../components/cart/QuantityStepper.jsx';
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

// Dựng giỏ đúng như backend tính: tổng tiền chỉ cộng dòng OK, canCheckout khi mọi dòng đều OK
const makeCart = (items) => ({
  items,
  totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
  subtotal: items.filter((i) => i.status === 'OK').reduce((sum, i) => sum + i.lineTotal, 0),
  canCheckout: items.length > 0 && items.every((i) => i.status === 'OK'),
});

const signIn = () => tokenStorage.setTokens(session);

// Máy chủ giả có trạng thái giỏ: PATCH/DELETE đổi giỏ thật rồi trả về giỏ mới như backend
const cartServer = (initialItems, extra = {}) => {
  let items = initialItems;
  const handlers = { ...storefrontApi, 'GET /users/me': [200, customer], ...extra };
  handlers['GET /cart'] = () => [200, makeCart(items)];
  for (const item of initialItems) {
    handlers[`PATCH /cart/items/${item.id}`] =
      extra[`PATCH /cart/items/${item.id}`] ??
      ((_config, body) => {
        items = items.map((i) =>
          i.id === item.id
            ? { ...i, quantity: body.quantity, lineTotal: i.unitPrice * body.quantity }
            : i,
        );
        return [200, makeCart(items)];
      });
    handlers[`DELETE /cart/items/${item.id}`] =
      extra[`DELETE /cart/items/${item.id}`] ??
      (() => {
        items = items.filter((i) => i.id !== item.id);
        return [200, makeCart(items)];
      });
  }
  return mockServer(handlers);
};

const openCart = async (items, extra) => {
  signIn();
  const calls = cartServer(items, extra);
  renderApp('/gio-hang');
  await screen.findByRole('heading', { name: 'Giỏ hàng', level: 1 });
  // Tiêu đề hiện ngay, nội dung chỉ có sau khi giỏ tải xong
  await waitFor(() =>
    expect(screen.queryByRole('status', { name: 'Đang tải giỏ hàng' })).not.toBeInTheDocument(),
  );
  return calls;
};

const product = (overrides = {}) => ({
  id: 7,
  name: 'iPhone 15',
  slug: 'iphone-15',
  price: 20000000,
  salePrice: null,
  inStock: true,
  thumbnail: null,
  category: { name: 'Điện thoại', slug: 'dien-thoai' },
  brand: { name: 'Apple', slug: 'apple' },
  ...overrides,
});

const detail = (overrides = {}) => ({
  ...product(),
  sku: 'IP15',
  description: null,
  specs: {},
  images: [],
  ...overrides,
});

const productPageHandlers = (extra = {}) => ({
  ...storefrontApi,
  'GET /users/me': [200, customer],
  'GET /products/iphone-15': [200, detail()],
  ...extra,
});

// ---------------------------------------------------------------------------
// Quy tắc phí vận chuyển (BR-05)
// ---------------------------------------------------------------------------
describe('Phí vận chuyển (BR-05)', () => {
  it('cố định 30.000 đ, miễn phí từ 5.000.000 đ, giỏ trống thì không có phí', () => {
    expect(shippingFee(1000000)).toBe(30000);
    expect(shippingFee(4999999)).toBe(30000);
    expect(shippingFee(5000000)).toBe(0);
    expect(shippingFee(12000000)).toBe(0);
    expect(shippingFee(0)).toBe(0);
  });

  it('số tiền còn thiếu để được miễn phí', () => {
    expect(amountToFreeShipping(1000000)).toBe(4000000);
    expect(amountToFreeShipping(5000000)).toBe(0);
    expect(amountToFreeShipping(9000000)).toBe(0);
    expect(amountToFreeShipping(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bộ chọn số lượng
// ---------------------------------------------------------------------------
describe('QuantityStepper', () => {
  const setup = (props = {}) => {
    const onChange = vi.fn();
    render(<QuantityStepper value={2} onChange={onChange} max={5} label="iPhone" {...props} />);
    return onChange;
  };

  it('nút + và − đổi ngay một đơn vị', async () => {
    const onChange = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Giảm số lượng' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('khóa nút − ở mức tối thiểu và nút + ở mức tối đa', () => {
    setup({ value: 1 });
    expect(screen.getByRole('button', { name: 'Giảm số lượng' })).toBeDisabled();
  });

  it('khóa nút + khi đạt tối đa (tồn kho)', () => {
    setup({ value: 5 });
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled();
  });

  it('gõ số rồi rời ô hoặc nhấn Enter thì áp dụng', async () => {
    const onChange = setup();
    const input = screen.getByRole('textbox', { name: 'Số lượng' });

    await userEvent.clear(input);
    await userEvent.type(input, '4{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(4);

    await userEvent.clear(input);
    await userEvent.type(input, '3');
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('số lớn hơn tối đa bị đưa về tối đa; số nhỏ hơn 1 bị đưa về 1', async () => {
    const onChange = setup();
    const input = screen.getByRole('textbox', { name: 'Số lượng' });

    await userEvent.clear(input);
    await userEvent.type(input, '99{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(5);
    expect(input).toHaveValue('5');

    await userEvent.clear(input);
    await userEvent.type(input, '0{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('ô rỗng hoặc ký tự không phải số: bỏ ký tự lạ, rỗng thì quay lại giá trị cũ và không gửi gì', async () => {
    const onChange = setup();
    const input = screen.getByRole('textbox', { name: 'Số lượng' });

    await userEvent.clear(input);
    await userEvent.type(input, 'a1b');
    expect(input).toHaveValue('1');

    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue('2');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gõ đúng giá trị hiện tại thì không gọi onChange; bị khóa thì mọi điều khiển vô hiệu', async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole('textbox', { name: 'Số lượng' }));
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disabled khóa cả hai nút và ô nhập; nhóm có nhãn theo sản phẩm', () => {
    setup({ disabled: true });

    expect(screen.getByRole('group', { name: 'Số lượng iPhone' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Giảm số lượng' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Số lượng' })).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Biểu tượng giỏ trên đầu trang (US-14 AC4)
// ---------------------------------------------------------------------------
describe('Biểu tượng giỏ trên đầu trang', () => {
  it('chưa đăng nhập: không gọi API giỏ, không có số lượng và dẫn tới /gio-hang', () => {
    const calls = mockServer(storefrontApi);
    renderApp('/');

    const link = screen.getByRole('link', { name: 'Giỏ hàng (0)' });
    expect(link).toHaveAttribute('href', '/gio-hang');
    expect(calls.some((c) => c.key === 'GET /cart')).toBe(false);
  });

  it('đã đăng nhập: hiện tổng số lượng của giỏ', async () => {
    signIn();
    cartServer([line(1, { quantity: 2 }), line(2, { quantity: 3 })]);
    renderApp('/');

    const link = await screen.findByRole('link', { name: 'Giỏ hàng (5)' });
    expect(link).toHaveTextContent('5');
  });

  it('số rất lớn hiện 99+', async () => {
    signIn();
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, customer],
      'GET /cart': [200, { ...emptyCart, totalQuantity: 150 }],
    });
    renderApp('/');

    expect(await screen.findByRole('link', { name: 'Giỏ hàng (150)' })).toHaveTextContent('99+');
  });
});

// ---------------------------------------------------------------------------
// Thêm vào giỏ từ thẻ sản phẩm và trang chi tiết (US-14)
// ---------------------------------------------------------------------------
describe('Thêm vào giỏ từ thẻ sản phẩm', () => {
  const listHandlers = (items, extra = {}) => ({
    ...storefrontApi,
    'GET /users/me': [200, customer],
    'GET /brands': [200, []],
    'GET /products': [200, { items, page: 1, pageSize: 12, total: items.length }],
    ...extra,
  });

  it('đã đăng nhập: bấm nút thì gửi sản phẩm lên giỏ và số lượng ở đầu trang cập nhật', async () => {
    signIn();
    const calls = mockServer(
      listHandlers([product()], {
        'POST /cart/items': [200, makeCart([line(1, { productId: 7, quantity: 1 })])],
      }),
    );
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' }));

    expect(calls).toContainEqual({ key: 'POST /cart/items', body: { productId: 7, quantity: 1 } });
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (1)' })).toBeInTheDocument();
  });

  it('chưa đăng nhập: chuyển tới trang đăng nhập và không gọi API giỏ (US-14 AC1)', async () => {
    const calls = mockServer(listHandlers([product()]));
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' }));

    expect(await screen.findByLabelText('Mật khẩu')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /cart/items')).toBe(false);
  });

  it('hết hàng thì nút bị khóa', async () => {
    signIn();
    mockServer(listHandlers([product({ inStock: false })]));
    renderApp('/san-pham');

    expect(await screen.findByRole('button', { name: 'iPhone 15 đã hết hàng' })).toBeDisabled();
  });

  it('vượt tồn kho: hiện đúng thông báo của máy chủ ngay trên thẻ (AC3)', async () => {
    signIn();
    mockServer(
      listHandlers([product()], {
        'POST /cart/items': [
          409,
          apiError(
            'INSUFFICIENT_STOCK',
            'Chỉ còn 2 sản phẩm trong kho, bạn đã có 2 sản phẩm này trong giỏ',
          ),
        ],
      }),
    );
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ còn 2 sản phẩm trong kho');
    expect(screen.getByRole('link', { name: 'Giỏ hàng (0)' })).toBeInTheDocument();
  });
});

describe('Thêm vào giỏ từ trang chi tiết', () => {
  it('chọn số lượng rồi thêm: gửi đúng số lượng và báo "Đã thêm vào giỏ"', async () => {
    signIn();
    const calls = mockServer(
      productPageHandlers({
        'POST /cart/items': [200, makeCart([line(1, { productId: 7, quantity: 3 })])],
      }),
    );
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));

    expect(calls).toContainEqual({ key: 'POST /cart/items', body: { productId: 7, quantity: 3 } });
    expect(await screen.findByRole('button', { name: 'Đã thêm vào giỏ' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (3)' })).toBeInTheDocument();
  });

  it('trạng thái "Đã thêm" tự trở lại nút bình thường sau vài giây', async () => {
    signIn();
    mockServer(
      productPageHandlers({ 'POST /cart/items': [200, makeCart([line(1, { productId: 7 })])] }),
    );
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));
    await screen.findByRole('button', { name: 'Đã thêm vào giỏ' });

    expect(
      await screen.findByRole('button', { name: 'Thêm vào giỏ' }, { timeout: 3500 }),
    ).toBeInTheDocument();
  });

  it('vượt tồn kho: hiện rõ số còn lại, nút vẫn dùng được', async () => {
    signIn();
    mockServer(
      productPageHandlers({
        'POST /cart/items': [409, apiError('INSUFFICIENT_STOCK', 'Chỉ còn 3 sản phẩm trong kho')],
      }),
    );
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ còn 3 sản phẩm trong kho');
    expect(screen.getByRole('button', { name: 'Thêm vào giỏ' })).toBeEnabled();
  });

  it('lỗi mạng: hiện thông báo thân thiện', async () => {
    signIn();
    mockServer(
      productPageHandlers({ 'POST /cart/items': [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] }),
    );
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
  });

  it('hết hàng: không có bộ chọn số lượng, nút Hết hàng bị khóa', async () => {
    signIn();
    mockServer({
      ...productPageHandlers(),
      'GET /products/iphone-15': [200, detail({ inStock: false })],
    });
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    expect(screen.getByRole('button', { name: 'Hết hàng' })).toBeDisabled();
    expect(screen.queryByRole('group', { name: /Số lượng/ })).not.toBeInTheDocument();
  });

  it('chưa đăng nhập: bấm thêm thì sang trang đăng nhập, đăng nhập xong quay lại đúng sản phẩm (AC1)', async () => {
    const calls = mockServer({
      ...productPageHandlers(),
      'POST /auth/login': [200, session],
    });
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));
    await userEvent.type(await screen.findByLabelText('Email'), 'khach@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Matkhau123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(await screen.findByRole('heading', { name: 'iPhone 15', level: 1 })).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /cart/items')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Trang giỏ hàng (US-15)
// ---------------------------------------------------------------------------
describe('Trang giỏ hàng', () => {
  it('chưa đăng nhập thì chuyển tới trang đăng nhập (BR-11)', async () => {
    mockServer(storefrontApi);
    renderApp('/gio-hang');

    expect(await screen.findByLabelText('Mật khẩu')).toBeInTheDocument();
  });

  it('đặt tiêu đề tab trình duyệt', async () => {
    await openCart([line(1)]);
    await waitFor(() => expect(document.title).toBe('Giỏ hàng - TechStore'));
  });

  it('giỏ trống: gợi ý quay lại mua sắm (AC3)', async () => {
    await openCart([]);

    expect(await screen.findByText('Giỏ hàng của bạn đang trống')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tiếp tục mua sắm' })).toHaveAttribute(
      'href',
      '/san-pham',
    );
  });

  it('hiện khung chờ khi đang tải', async () => {
    signIn();
    cartServer([line(1)]);
    renderApp('/gio-hang');

    expect(await screen.findByRole('status', { name: 'Đang tải giỏ hàng' })).toBeInTheDocument();
    await screen.findByText('Sản phẩm 1');
  });

  it('lỗi tải giỏ: hiện thông báo và nút Thử lại tải được lại', async () => {
    signIn();
    let attempts = 0;
    mockServer({
      ...storefrontApi,
      'GET /users/me': [200, customer],
      'GET /cart': () => {
        attempts += 1;
        return attempts === 1
          ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')]
          : [200, makeCart([line(1)])];
      },
    });
    renderApp('/gio-hang');

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Lỗi máy chủ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Sản phẩm 1')).toBeInTheDocument();
  });

  it('hiện từng dòng: tên (liên kết tới sản phẩm), hãng, đơn giá, thành tiền', async () => {
    await openCart([
      line(1, {
        quantity: 2,
        unitPrice: 18000000,
        lineTotal: 36000000,
        product: { ...line(1).product, price: 20000000, salePrice: 18000000 },
      }),
    ]);

    const item = within(screen.getByRole('main')).getByRole('listitem');
    expect(within(item).getByRole('link', { name: 'Sản phẩm 1' })).toHaveAttribute(
      'href',
      '/san-pham/san-pham-1',
    );
    expect(within(item).getByText('Apple')).toBeInTheDocument();
    expect(within(item).getByText('18.000.000 ₫')).toBeInTheDocument();
    expect(within(item).getByText('20.000.000 ₫')).toHaveClass('line-through');
    expect(within(item).getByText('36.000.000 ₫')).toBeInTheDocument(); // thành tiền
    expect(within(item).getByRole('textbox', { name: 'Số lượng' })).toHaveValue('2');
  });

  describe('tóm tắt đơn hàng và phí vận chuyển (BR-05)', () => {
    const summary = () => screen.getByRole('complementary', { name: 'Tóm tắt đơn hàng' });

    it('dưới 5 triệu: cộng phí 30.000 ₫ và gợi ý số tiền còn thiếu để miễn phí', async () => {
      await openCart([line(1, { quantity: 2, lineTotal: 2000000 })]);

      expect(within(summary()).getByText('Tạm tính (2 sản phẩm)')).toBeInTheDocument();
      const rows = within(summary())
        .getAllByText(/₫/)
        .map((el) => el.textContent);
      expect(rows).toContain('2.000.000 ₫'); // tạm tính
      expect(rows).toContain('30.000 ₫'); // phí vận chuyển
      expect(rows).toContain('2.030.000 ₫'); // tổng cộng
      expect(
        within(summary()).getByText(/Mua thêm 3\.000\.000 ₫ để được miễn phí vận chuyển/),
      ).toBeInTheDocument();
      expect(within(summary()).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    });

    it('từ 5 triệu: miễn phí vận chuyển', async () => {
      await openCart([line(1, { quantity: 5, lineTotal: 5000000 })]);

      expect(within(summary()).getByText('Miễn phí')).toBeInTheDocument();
      expect(
        within(summary()).getByText('Đơn hàng của bạn được miễn phí vận chuyển'),
      ).toBeInTheDocument();
      expect(within(summary()).getAllByText('5.000.000 ₫').length).toBeGreaterThan(0);
    });

    it('nút Đặt hàng bị khóa cho tới khi có F06', async () => {
      await openCart([line(1)]);

      expect(within(summary()).getByRole('button', { name: 'Đặt hàng' })).toBeDisabled();
      expect(within(summary()).getByText(/sắp ra mắt/)).toBeInTheDocument();
    });
  });

  describe('sửa số lượng (AC1, AC2)', () => {
    it('bấm + thì gửi số lượng mới và tổng tiền cập nhật ngay theo giỏ máy chủ trả về', async () => {
      const calls = await openCart([line(1, { quantity: 1 })]);

      await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));

      await waitFor(() =>
        expect(calls).toContainEqual({ key: 'PATCH /cart/items/1', body: { quantity: 2 } }),
      );
      expect(await screen.findByText('Tạm tính (2 sản phẩm)')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Số lượng' })).toHaveValue('2');
      expect(screen.getByRole('link', { name: 'Giỏ hàng (2)' })).toBeInTheDocument();
    });

    it('bấm − giảm một đơn vị; ở mức 1 thì nút − bị khóa', async () => {
      const calls = await openCart([line(1, { quantity: 2 })]);

      await userEvent.click(screen.getByRole('button', { name: 'Giảm số lượng' }));

      await waitFor(() =>
        expect(calls).toContainEqual({ key: 'PATCH /cart/items/1', body: { quantity: 1 } }),
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Giảm số lượng' })).toBeDisabled(),
      );
    });

    it('không cho vượt tồn kho: nút + khóa khi đạt tồn kho; gõ số lớn bị đưa về tồn kho', async () => {
      const calls = await openCart([line(1, { quantity: 4, stock: 5 })]);

      const input = screen.getByRole('textbox', { name: 'Số lượng' });
      await userEvent.clear(input);
      await userEvent.type(input, '50{Enter}');

      await waitFor(() =>
        expect(calls).toContainEqual({ key: 'PATCH /cart/items/1', body: { quantity: 5 } }),
      );
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled(),
      );
      expect(calls.filter((c) => c.key === 'PATCH /cart/items/1')).toHaveLength(1);
    });

    it('máy chủ từ chối (409): hiện lý do ngay dưới dòng và giữ nguyên số lượng cũ', async () => {
      await openCart([line(1, { quantity: 1 })], {
        'PATCH /cart/items/1': [
          409,
          apiError('INSUFFICIENT_STOCK', 'Chỉ còn 1 sản phẩm trong kho'),
        ],
      });

      await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ còn 1 sản phẩm trong kho');
      expect(screen.getByRole('textbox', { name: 'Số lượng' })).toHaveValue('1');
    });
  });

  describe('xóa khỏi giỏ (AC3)', () => {
    it('xóa một dòng thì dòng đó biến mất, các dòng khác còn', async () => {
      const calls = await openCart([line(1), line(2)]);

      await userEvent.click(screen.getByRole('button', { name: 'Xóa Sản phẩm 1 khỏi giỏ' }));

      await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /cart/items/1')).toBe(true));
      await waitFor(() => expect(screen.queryByText('Sản phẩm 1')).not.toBeInTheDocument());
      expect(screen.getByText('Sản phẩm 2')).toBeInTheDocument();
    });

    it('xóa dòng cuối thì hiện giỏ trống kèm gợi ý mua sắm', async () => {
      await openCart([line(1)]);

      await userEvent.click(screen.getByRole('button', { name: 'Xóa Sản phẩm 1 khỏi giỏ' }));

      expect(await screen.findByText('Giỏ hàng của bạn đang trống')).toBeInTheDocument();
    });

    it('xóa lỗi thì báo dưới dòng và dòng vẫn còn', async () => {
      await openCart([line(1)], {
        'DELETE /cart/items/1': [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')],
      });

      await userEvent.click(screen.getByRole('button', { name: 'Xóa Sản phẩm 1 khỏi giỏ' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
      expect(screen.getByText('Sản phẩm 1')).toBeInTheDocument();
    });
  });

  describe('sản phẩm có vấn đề được đánh dấu rõ (AC4)', () => {
    it('đã bị ẩn: có cảnh báo, không có bộ chọn số lượng, vẫn xóa được; không vào tổng tiền', async () => {
      await openCart([
        line(1, { status: 'UNAVAILABLE', quantity: 2, lineTotal: 2000000 }),
        line(2, { quantity: 1, lineTotal: 1000000 }),
      ]);

      const [bad, good] = within(screen.getByRole('main')).getAllByRole('listitem');
      expect(within(bad).getByRole('status')).toHaveTextContent('không còn được bán');
      expect(within(bad).queryByRole('group')).not.toBeInTheDocument();
      expect(
        within(bad).getByRole('button', { name: 'Xóa Sản phẩm 1 khỏi giỏ' }),
      ).toBeInTheDocument();
      expect(within(good).getByRole('group')).toBeInTheDocument();

      const summary = screen.getByRole('complementary', { name: 'Tóm tắt đơn hàng' });
      expect(within(summary).getByText(/Có sản phẩm cần xử lý/)).toBeInTheDocument();
      expect(within(summary).getAllByText('1.000.000 ₫').length).toBeGreaterThan(0); // chỉ dòng mua được
    });

    it('hết hàng: cảnh báo, không có bộ chọn số lượng', async () => {
      await openCart([line(1, { status: 'OUT_OF_STOCK', stock: 0 })]);

      expect(
        within(within(screen.getByRole('main')).getByRole('listitem')).getByRole('status'),
      ).toHaveTextContent('đã hết hàng');
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
    });

    it('tồn kho giảm dưới số lượng: báo số còn lại và có nút "Giảm xuống n"', async () => {
      const calls = await openCart([line(1, { status: 'EXCEEDS_STOCK', quantity: 4, stock: 2 })]);

      expect(
        within(within(screen.getByRole('main')).getByRole('listitem')).getByRole('status'),
      ).toHaveTextContent('Chỉ còn 2 sản phẩm trong kho');
      await userEvent.click(screen.getByRole('button', { name: 'Giảm xuống 2' }));

      await waitFor(() =>
        expect(calls).toContainEqual({ key: 'PATCH /cart/items/1', body: { quantity: 2 } }),
      );
    });

    it('giỏ toàn dòng tốt thì không có cảnh báo xử lý', async () => {
      await openCart([line(1)]);

      expect(screen.queryByText(/Có sản phẩm cần xử lý/)).not.toBeInTheDocument();
    });
  });
});
