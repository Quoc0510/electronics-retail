/**
 * @feature [F05] Giỏ hàng cho khách - Kiểm thử giỏ của khách CHƯA đăng nhập: lưu trên trình duyệt, giá và tồn kho do máy chủ
 * tính (POST /cart/preview), quy tắc tồn kho, gộp vào tài khoản khi đăng nhập (POST /cart/merge) và ghi chú sau khi gộp.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  EMPTY_GUEST_ITEMS,
  GUEST_CART_KEY,
  MAX_GUEST_ITEMS,
  getGuestItems,
  guestQuantity,
  guestTotalQuantity,
  resetGuestCartForTests,
  saveGuestItems,
  subscribeGuestCart,
  withQuantity,
  withoutProduct,
} from '../lib/guestCart.js';
import {
  CART_NOTICE_KEY,
  clearCartNotice,
  getCartNotice,
  resetCartNoticeForTests,
  saveCartNotice,
  subscribeCartNotice,
} from '../lib/cartNotice.js';
import {
  apiError,
  customer,
  emptyReviews,
  mockServer,
  renderApp,
  session,
  storefrontApi,
} from '../test/utils.jsx';

afterEach(() => {
  resetGuestCartForTests();
  resetCartNoticeForTests();
});

// ---------------------------------------------------------------------------
// Dữ liệu và máy chủ giả
// ---------------------------------------------------------------------------
const CATALOG = {
  7: {
    name: 'iPhone 15',
    slug: 'iphone-15',
    price: 20000000,
    salePrice: null,
    stock: 5,
    active: true,
  },
  8: {
    name: 'Galaxy S24',
    slug: 'galaxy-s24',
    price: 15000000,
    salePrice: 14000000,
    stock: 3,
    active: true,
  },
};

const line = (productId, quantity, catalog) => {
  const p = catalog[productId];
  const unitPrice = p.salePrice ?? p.price;
  let status = 'OK';
  if (!p.active) status = 'UNAVAILABLE';
  else if (p.stock <= 0) status = 'OUT_OF_STOCK';
  else if (quantity > p.stock) status = 'EXCEEDS_STOCK';
  return {
    id: productId, // giỏ của khách dùng id sản phẩm làm id dòng
    productId,
    quantity,
    product: {
      name: p.name,
      slug: p.slug,
      price: p.price,
      salePrice: p.salePrice,
      thumbnail: null,
      brand: { name: 'Apple' },
      category: { name: 'Điện thoại' },
    },
    unitPrice,
    lineTotal: unitPrice * quantity,
    stock: p.stock,
    status,
  };
};

const makeCart = (items) => ({
  items,
  totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
  subtotal: items.filter((i) => i.status === 'OK').reduce((sum, i) => sum + i.lineTotal, 0),
  canCheckout: items.length > 0 && items.every((i) => i.status === 'OK'),
});

// Giả lập backend previewCart: bỏ qua sản phẩm không có trong danh mục
const previewHandler =
  (catalog = CATALOG) =>
  (_config, body) => [
    200,
    makeCart(
      body.items
        .filter((e) => catalog[e.productId])
        .map((e) => line(e.productId, e.quantity, catalog)),
    ),
  ];

const product = (id = 7, overrides = {}) => ({
  id,
  name: CATALOG[id].name,
  slug: CATALOG[id].slug,
  price: CATALOG[id].price,
  salePrice: CATALOG[id].salePrice,
  inStock: true,
  thumbnail: null,
  category: { name: 'Điện thoại', slug: 'dien-thoai' },
  brand: { name: 'Apple', slug: 'apple' },
  ...overrides,
});

const handlers = (extra = {}) => ({
  ...storefrontApi,
  'GET /brands': [200, []],
  'GET /users/me': [200, customer],
  'GET /products': [200, { items: [product(7)], page: 1, pageSize: 12, total: 1 }],
  'GET /products/iphone-15': [
    200,
    { ...product(7), sku: 'IP15', description: null, specs: {}, images: [] },
  ],
  'GET /products/iphone-15/reviews': [200, emptyReviews],
  'POST /cart/preview': previewHandler(),
  ...extra,
});

const seedGuest = (...entries) => localStorage.setItem(GUEST_CART_KEY, JSON.stringify(entries));
const stored = () => JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? '[]');
const previews = (calls) => calls.filter((c) => c.key === 'POST /cart/preview');

// ---------------------------------------------------------------------------
// Kho lưu giỏ của khách (lib/guestCart.js)
// ---------------------------------------------------------------------------
describe('guestCart (kho lưu giỏ của khách)', () => {
  it('giỏ trống mặc định là một mảng cố định (cùng tham chiếu) để React không vẽ lại thừa', () => {
    expect(getGuestItems()).toBe(EMPTY_GUEST_ITEMS);
    expect(getGuestItems()).toBe(getGuestItems());
  });

  it('lưu rồi đọc lại; snapshot giữ nguyên tham chiếu chừng nào dữ liệu chưa đổi', () => {
    saveGuestItems([{ productId: 7, quantity: 2 }]);

    const first = getGuestItems();
    expect(first).toEqual([{ productId: 7, quantity: 2 }]);
    expect(getGuestItems()).toBe(first);
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY))).toEqual(first);
  });

  it('lưu giỏ rỗng thì xóa khóa khỏi localStorage', () => {
    saveGuestItems([{ productId: 7, quantity: 1 }]);
    saveGuestItems([]);

    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
    expect(getGuestItems()).toBe(EMPTY_GUEST_ITEMS);
  });

  it('dữ liệu hỏng hoặc sai dạng bị bỏ qua, mục đúng được giữ', () => {
    localStorage.setItem(GUEST_CART_KEY, '{khong-phai-json');
    expect(getGuestItems()).toBe(EMPTY_GUEST_ITEMS);

    localStorage.setItem(
      GUEST_CART_KEY,
      JSON.stringify([
        null,
        { productId: '1', quantity: 1 },
        { productId: 2, quantity: 0 },
        { productId: 3, quantity: 100 },
        { productId: -1, quantity: 1 },
        { productId: 7, quantity: 2 },
      ]),
    );
    expect(getGuestItems()).toEqual([{ productId: 7, quantity: 2 }]);
  });

  it('bỏ mục trùng sản phẩm (giữ mục đầu) và giới hạn số mục', () => {
    localStorage.setItem(
      GUEST_CART_KEY,
      JSON.stringify([
        { productId: 7, quantity: 1 },
        { productId: 7, quantity: 5 },
      ]),
    );
    expect(getGuestItems()).toEqual([{ productId: 7, quantity: 1 }]);

    const many = Array.from({ length: MAX_GUEST_ITEMS + 10 }, (_u, i) => ({
      productId: i + 1,
      quantity: 1,
    }));
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(many));
    expect(getGuestItems()).toHaveLength(MAX_GUEST_ITEMS);
  });

  it('báo cho người theo dõi khi lưu, và khi tab khác đổi giỏ (sự kiện storage)', () => {
    let calls = 0;
    const unsubscribe = subscribeGuestCart(() => {
      calls += 1;
    });

    saveGuestItems([{ productId: 7, quantity: 1 }]);
    expect(calls).toBe(1);

    window.dispatchEvent(new StorageEvent('storage', { key: GUEST_CART_KEY }));
    expect(calls).toBe(2);
    window.dispatchEvent(new StorageEvent('storage', { key: 'khoa-khac' }));
    expect(calls).toBe(2);

    unsubscribe();
    saveGuestItems([]);
    expect(calls).toBe(2);
  });

  it('localStorage không dùng được thì giỏ vẫn hoạt động trong bộ nhớ của lần mở trang này', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };
    try {
      saveGuestItems([{ productId: 7, quantity: 3 }]);
      expect(getGuestItems()).toEqual([{ productId: 7, quantity: 3 }]);
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it('hàm dựng danh sách mới: đặt số lượng (thêm mới ở cuối, tối đa 99), xóa, tra số lượng, tổng', () => {
    const items = [{ productId: 7, quantity: 2 }];

    expect(withQuantity(items, 7, 5)).toEqual([{ productId: 7, quantity: 5 }]);
    expect(withQuantity(items, 8, 1)).toEqual([
      { productId: 7, quantity: 2 },
      { productId: 8, quantity: 1 },
    ]);
    expect(withQuantity(items, 7, 500)).toEqual([{ productId: 7, quantity: 99 }]);
    expect(withoutProduct(items, 7)).toEqual([]);
    expect(guestQuantity(items, 7)).toBe(2);
    expect(guestQuantity(items, 9)).toBe(0);
    expect(guestTotalQuantity([...items, { productId: 8, quantity: 3 }])).toBe(5);
    expect(items).toEqual([{ productId: 7, quantity: 2 }]); // không sửa danh sách gốc
  });
});

describe('cartNotice (ghi chú sau khi gộp giỏ)', () => {
  it('lưu, đọc, xóa và báo cho người theo dõi', () => {
    let calls = 0;
    const unsubscribe = subscribeCartNotice(() => {
      calls += 1;
    });

    saveCartNotice(['Máy A: chỉ thêm được 2 trên 4 sản phẩm']);
    expect(getCartNotice()).toEqual(['Máy A: chỉ thêm được 2 trên 4 sản phẩm']);
    expect(getCartNotice()).toBe(getCartNotice());

    clearCartNotice();
    expect(getCartNotice()).toEqual([]);
    expect(sessionStorage.getItem(CART_NOTICE_KEY)).toBeNull();
    expect(calls).toBe(2);
    unsubscribe();
  });

  it('dữ liệu hỏng bị bỏ qua; chỉ nhận chuỗi', () => {
    sessionStorage.setItem(CART_NOTICE_KEY, '{hong');
    expect(getCartNotice()).toEqual([]);

    sessionStorage.setItem(CART_NOTICE_KEY, JSON.stringify([1, null, 'Ghi chú hợp lệ']));
    expect(getCartNotice()).toEqual(['Ghi chú hợp lệ']);
  });
});

// ---------------------------------------------------------------------------
// Khách thêm vào giỏ
// ---------------------------------------------------------------------------
describe('Khách chưa đăng nhập thêm vào giỏ', () => {
  it('bấm nút trên thẻ: hỏi máy chủ, lưu vào trình duyệt, KHÔNG gọi API giỏ của tài khoản; số lượng ở đầu trang tăng', async () => {
    const calls = mockServer(handlers());
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' }));

    expect(await screen.findByRole('link', { name: 'Giỏ hàng (1)' })).toBeInTheDocument();
    expect(stored()).toEqual([{ productId: 7, quantity: 1 }]);
    expect(previews(calls)[0].body).toEqual({ items: [{ productId: 7, quantity: 1 }] });
    expect(calls.some((c) => c.key === 'POST /cart/items' || c.key === 'GET /cart')).toBe(false);
  });

  it('thêm lại cùng sản phẩm thì cộng dồn số lượng', async () => {
    mockServer(handlers());
    renderApp('/san-pham');
    const button = await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' });

    await userEvent.click(button);
    await screen.findByRole('link', { name: 'Giỏ hàng (1)' });
    await userEvent.click(button);

    expect(await screen.findByRole('link', { name: 'Giỏ hàng (2)' })).toBeInTheDocument();
    expect(stored()).toEqual([{ productId: 7, quantity: 2 }]);
  });

  it('trang chi tiết: chọn số lượng rồi thêm, hiện "Đã thêm vào giỏ"', async () => {
    const calls = mockServer(handlers());
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));

    expect(await screen.findByRole('button', { name: 'Đã thêm vào giỏ' })).toBeInTheDocument();
    expect(stored()).toEqual([{ productId: 7, quantity: 2 }]);
    expect(previews(calls).at(-1).body.items).toEqual([{ productId: 7, quantity: 2 }]);
  });

  it('vượt tồn kho: báo số còn lại và số đã có, giỏ trên trình duyệt không đổi', async () => {
    seedGuest({ productId: 8, quantity: 2 });
    mockServer(
      handlers({
        'GET /products': [200, { items: [product(8)], page: 1, pageSize: 12, total: 1 }],
      }),
    );
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Thêm Galaxy S24 vào giỏ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Galaxy S24 vào giỏ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chỉ còn 3 sản phẩm trong kho, bạn đã có 3 sản phẩm này trong giỏ',
    );
    // Lần bấm đầu (2 -> 3) hợp lệ, lần bấm thứ hai (3 -> 4) vượt tồn kho 3 nên bị từ chối và giữ nguyên 3
    expect(stored()).toEqual([{ productId: 8, quantity: 3 }]);
  });

  it('thêm lần đầu mà vượt tồn kho thì không nhắc "đã có trong giỏ"', async () => {
    mockServer(
      handlers({
        'POST /cart/preview': previewHandler({ ...CATALOG, 7: { ...CATALOG[7], stock: 1 } }),
        'GET /products/iphone-15': [
          200,
          { ...product(7), sku: 'IP15', description: null, specs: {}, images: [] },
        ],
      }),
    );
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ còn 1 sản phẩm trong kho');
    expect(screen.getByRole('alert')).not.toHaveTextContent('đã có');
    expect(stored()).toEqual([]);
  });

  it('tồn kho bằng 0 thì báo hết hàng; sản phẩm đã ẩn hoặc không còn thì báo không còn bán', async () => {
    mockServer(
      handlers({
        'POST /cart/preview': previewHandler({ 7: { ...CATALOG[7], stock: 0 } }),
      }),
    );
    renderApp('/san-pham');
    await userEvent.click(await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sản phẩm đã hết hàng');
    expect(stored()).toEqual([]);
  });

  it('sản phẩm đã bị ẩn: báo không còn được bán và không lưu', async () => {
    mockServer(
      handlers({ 'POST /cart/preview': previewHandler({ 7: { ...CATALOG[7], active: false } }) }),
    );
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('không còn được bán');
    expect(stored()).toEqual([]);
  });

  it('lỗi máy chủ khi xem trước: hiện thông báo và không lưu', async () => {
    mockServer(
      handlers({ 'POST /cart/preview': [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] }),
    );
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'Thêm iPhone 15 vào giỏ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    expect(stored()).toEqual([]);
  });

  it('biểu tượng giỏ hiện ngay số lượng đang lưu, không cần chờ mạng', () => {
    seedGuest({ productId: 7, quantity: 2 }, { productId: 8, quantity: 1 });
    mockServer(handlers());
    renderApp('/');

    expect(screen.getByRole('link', { name: 'Giỏ hàng (3)' })).toBeInTheDocument();
  });

  it('tab khác đổi giỏ (sự kiện storage) thì số lượng ở tab này cập nhật theo', async () => {
    mockServer(handlers());
    renderApp('/');
    expect(screen.getByRole('link', { name: 'Giỏ hàng (0)' })).toBeInTheDocument();

    act(() => {
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify([{ productId: 7, quantity: 4 }]));
      fireEvent(window, new StorageEvent('storage', { key: GUEST_CART_KEY }));
    });

    expect(await screen.findByRole('link', { name: 'Giỏ hàng (4)' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Trang giỏ hàng của khách
// ---------------------------------------------------------------------------
describe('Trang giỏ hàng của khách chưa đăng nhập', () => {
  const openCart = async (extra) => {
    const calls = mockServer(handlers(extra));
    renderApp('/gio-hang');
    await screen.findByRole('heading', { name: 'Giỏ hàng', level: 1 });
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Đang tải giỏ hàng' })).not.toBeInTheDocument(),
    );
    return calls;
  };

  it('giỏ trống thì hiện gợi ý mua sắm và không gọi máy chủ', async () => {
    const calls = await openCart();

    expect(screen.getByText('Giỏ hàng của bạn đang trống')).toBeInTheDocument();
    expect(previews(calls)).toHaveLength(0);
  });

  it('hiện giá hiện hành, thành tiền, tổng tiền theo dữ liệu máy chủ; nhắc đăng nhập để đặt hàng', async () => {
    seedGuest({ productId: 7, quantity: 2 }, { productId: 8, quantity: 1 });
    const calls = await openCart();

    expect(await screen.findByText('Galaxy S24')).toBeInTheDocument();
    const summary = screen.getByRole('complementary', { name: 'Tóm tắt đơn hàng' });
    expect(within(summary).getByText('Tạm tính (3 sản phẩm)')).toBeInTheDocument();
    expect(within(summary).getAllByText('54.000.000 ₫').length).toBeGreaterThan(0); // 2 x 20tr + 14tr
    expect(within(summary).getByRole('link', { name: 'đăng nhập' })).toHaveAttribute(
      'href',
      '/dang-nhap',
    );
    expect(calls.some((c) => c.key === 'GET /cart')).toBe(false);
  });

  it('đổi số lượng: kiểm tra với máy chủ rồi lưu; tổng tiền cập nhật', async () => {
    seedGuest({ productId: 7, quantity: 1 });
    const calls = await openCart();
    await screen.findByText('iPhone 15');

    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));

    expect(await screen.findByText('Tạm tính (2 sản phẩm)')).toBeInTheDocument();
    expect(stored()).toEqual([{ productId: 7, quantity: 2 }]);
    expect(calls.some((c) => c.key.startsWith('PATCH'))).toBe(false);
    expect(screen.getByRole('link', { name: 'Giỏ hàng (2)' })).toBeInTheDocument();
  });

  it('gõ số lớn hơn tồn kho thì bị đưa về tồn kho, không gửi số vượt', async () => {
    seedGuest({ productId: 7, quantity: 1 });
    await openCart();
    await screen.findByText('iPhone 15');

    const input = screen.getByRole('textbox', { name: 'Số lượng' });
    await userEvent.clear(input);
    await userEvent.type(input, '50{Enter}');

    await waitFor(() => expect(stored()).toEqual([{ productId: 7, quantity: 5 }]));
  });

  it('tồn kho giảm giữa chừng khiến máy chủ từ chối: báo dưới dòng, ô số lượng quay về số cũ', async () => {
    seedGuest({ productId: 7, quantity: 1 });
    // Dòng đang hiện với tồn kho 5 nhưng lúc sửa máy chủ chỉ còn 1
    let calls = 0;
    mockServer(
      handlers({
        'POST /cart/preview': (_config, body) => {
          calls += 1;
          const catalog = calls === 1 ? CATALOG : { ...CATALOG, 7: { ...CATALOG[7], stock: 1 } };
          return previewHandler(catalog)(_config, body);
        },
      }),
    );
    renderApp('/gio-hang');
    await screen.findByText('iPhone 15');

    await userEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ còn 1 sản phẩm trong kho');
    expect(screen.getByRole('textbox', { name: 'Số lượng' })).toHaveValue('1');
    expect(stored()).toEqual([{ productId: 7, quantity: 1 }]);
  });

  it('xóa một dòng rồi dòng cuối: lưu lại và về giỏ trống', async () => {
    seedGuest({ productId: 7, quantity: 1 }, { productId: 8, quantity: 1 });
    await openCart();
    await screen.findByText('Galaxy S24');

    await userEvent.click(screen.getByRole('button', { name: 'Xóa iPhone 15 khỏi giỏ' }));
    await waitFor(() => expect(stored()).toEqual([{ productId: 8, quantity: 1 }]));

    await userEvent.click(await screen.findByRole('button', { name: 'Xóa Galaxy S24 khỏi giỏ' }));
    expect(await screen.findByText('Giỏ hàng của bạn đang trống')).toBeInTheDocument();
    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
  });

  it('sản phẩm đã bị xóa hẳn khỏi cửa hàng thì tự dọn khỏi giỏ trên trình duyệt', async () => {
    seedGuest({ productId: 7, quantity: 1 }, { productId: 999, quantity: 2 });
    await openCart();

    expect(await screen.findByText('iPhone 15')).toBeInTheDocument();
    await waitFor(() => expect(stored()).toEqual([{ productId: 7, quantity: 1 }]));
    expect(screen.getByRole('link', { name: 'Giỏ hàng (1)' })).toBeInTheDocument();
  });

  it('dòng bị ẩn được đánh dấu và không vào tổng tiền (giống giỏ tài khoản)', async () => {
    seedGuest({ productId: 7, quantity: 1 }, { productId: 8, quantity: 1 });
    mockServer(
      handlers({
        'POST /cart/preview': previewHandler({ ...CATALOG, 8: { ...CATALOG[8], active: false } }),
      }),
    );
    renderApp('/gio-hang');

    expect(await screen.findByText(/không còn được bán/)).toBeInTheDocument();
    const summary = screen.getByRole('complementary', { name: 'Tóm tắt đơn hàng' });
    expect(within(summary).getByText(/Có sản phẩm cần xử lý/)).toBeInTheDocument();
  });

  it('lỗi tải giỏ: hiện thông báo, Thử lại tải được lại', async () => {
    seedGuest({ productId: 7, quantity: 1 });
    let attempts = 0;
    mockServer(
      handlers({
        'POST /cart/preview': (config, body) => {
          attempts += 1;
          return attempts === 1
            ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')]
            : previewHandler()(config, body);
        },
      }),
    );
    renderApp('/gio-hang');

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Lỗi máy chủ',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('iPhone 15')).toBeInTheDocument();
  });

  it('khách đã đăng nhập thì không thấy lời nhắc đăng nhập', async () => {
    const calls = mockServer(
      handlers({
        'GET /cart': [200, makeCart([line(7, 1, CATALOG)])],
      }),
    );
    renderApp('/gio-hang');
    expect(calls).toBeDefined();
    // Chưa đăng nhập ở test này nên giỏ trống; kiểm tra phía đã đăng nhập ở nhóm gộp giỏ bên dưới
    await screen.findByText('Giỏ hàng của bạn đang trống');
    expect(screen.queryByText(/đang được lưu trên trình duyệt/)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Gộp giỏ khi đăng nhập
// ---------------------------------------------------------------------------
describe('Gộp giỏ của khách vào tài khoản khi đăng nhập', () => {
  const login = async () => {
    await userEvent.type(await screen.findByLabelText('Email'), 'khach@example.com');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'Matkhau123');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
  };

  const mergedCart = makeCart([line(7, 3, CATALOG)]);

  it('đăng nhập xong thì gửi giỏ tạm lên máy chủ, xóa giỏ tạm và biểu tượng giỏ theo giỏ tài khoản', async () => {
    seedGuest({ productId: 7, quantity: 2 });
    const calls = mockServer(
      handlers({
        'POST /auth/login': [200, session],
        'POST /cart/merge': [200, { cart: mergedCart, notes: [] }],
        'GET /cart': [200, mergedCart],
      }),
    );
    renderApp('/dang-nhap');

    await login();

    expect(await screen.findByRole('link', { name: 'Giỏ hàng (3)' })).toBeInTheDocument();
    expect(calls).toContainEqual({
      key: 'POST /cart/merge',
      body: { items: [{ productId: 7, quantity: 2 }] },
    });
    await waitFor(() => expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull());
    expect(getCartNotice()).toEqual([]);
  });

  it('có món bị điều chỉnh thì trang giỏ hàng hiện ghi chú, bấm "Đã hiểu" thì ẩn', async () => {
    seedGuest({ productId: 7, quantity: 9 });
    mockServer(
      handlers({
        'POST /auth/login': [200, session],
        'POST /cart/merge': [
          200,
          {
            cart: mergedCart,
            notes: ['iPhone 15: chỉ thêm được 3 trên 9 sản phẩm vì tồn kho không đủ'],
          },
        ],
        'GET /cart': [200, mergedCart],
      }),
    );
    renderApp('/dang-nhap');
    await login();
    await userEvent.click(await screen.findByRole('link', { name: 'Giỏ hàng (3)' }));

    const notice = await screen.findByText('Giỏ hàng của bạn đã được điều chỉnh khi đăng nhập:');
    expect(notice.closest('[role="status"]')).toHaveTextContent('chỉ thêm được 3 trên 9 sản phẩm');

    await userEvent.click(screen.getByRole('button', { name: 'Đã hiểu' }));
    expect(screen.queryByText(/đã được điều chỉnh khi đăng nhập/)).not.toBeInTheDocument();
    expect(sessionStorage.getItem(CART_NOTICE_KEY)).toBeNull();
  });

  it('ghi chú đã lưu từ trước vẫn hiện khi mở trang giỏ hàng', async () => {
    saveCartNotice(['Máy A: không thêm được vì đã hết hàng']);
    mockServer(handlers({ 'GET /cart': [200, mergedCart] }));
    renderApp('/gio-hang');

    expect(await screen.findByText(/Máy A: không thêm được/)).toBeInTheDocument();
  });

  it('gộp lỗi (mất mạng): giữ nguyên giỏ tạm để thử lại lần sau, không báo gì', async () => {
    seedGuest({ productId: 7, quantity: 2 });
    mockServer(
      handlers({
        'POST /auth/login': [200, session],
        'POST /cart/merge': [500, apiError('INTERNAL_ERROR', 'Lỗi')],
        'GET /cart': [200, makeCart([])],
      }),
    );
    renderApp('/dang-nhap');

    await login();
    await screen.findByRole('heading', { name: 'Thiết bị điện tử chính hãng' });

    expect(stored()).toEqual([{ productId: 7, quantity: 2 }]);
    expect(getCartNotice()).toEqual([]);
  });

  it('không có giỏ tạm thì không gọi gộp', async () => {
    const calls = mockServer(handlers({ 'POST /auth/login': [200, session] }));
    renderApp('/dang-nhap');

    await login();
    await screen.findByRole('heading', { name: 'Thiết bị điện tử chính hãng' });

    expect(calls.some((c) => c.key === 'POST /cart/merge')).toBe(false);
  });

  it('đã đăng nhập sẵn mà còn giỏ tạm (ví dụ thêm ở tab khác) thì tự gộp khi tải trang', async () => {
    localStorage.setItem(
      'techstore.client.auth',
      JSON.stringify({ accessToken: session.accessToken, refreshToken: session.refreshToken }),
    );
    seedGuest({ productId: 7, quantity: 1 });
    const calls = mockServer(
      handlers({
        'POST /cart/merge': [200, { cart: makeCart([line(7, 1, CATALOG)]), notes: [] }],
        'GET /cart': [200, makeCart([line(7, 1, CATALOG)])],
      }),
    );
    renderApp('/');

    await waitFor(() => expect(calls.some((c) => c.key === 'POST /cart/merge')).toBe(true));
    await waitFor(() => expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull());
  });
});
