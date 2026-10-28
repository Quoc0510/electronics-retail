/**
 * @feature [F06] Đặt hàng - Kiểm thử API /api/orders (US-16, BR-02 đến BR-05, BR-08, BR-12).
 * Chạy trên PostgreSQL thật (schema "test") để kiểm tra transaction, khóa dòng và tranh chấp tồn kho giữa nhiều đơn cùng lúc.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { generateOrderCode, ORDER_CODE_PATTERN } from '../src/lib/orderCode.js';
import { calculateShippingFee } from '../src/lib/shipping.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

let counter = 0;
const makeProduct = async (overrides = {}) => {
  counter += 1;
  const { category: givenCategory, brand: givenBrand, ...rest } = overrides;
  const category =
    givenCategory ??
    (await prisma.category.create({
      data: { name: `Danh mục ${counter}`, slug: `dm-${counter}` },
    }));
  const brand =
    givenBrand ??
    (await prisma.brand.create({ data: { name: `Hãng ${counter}`, slug: `hang-${counter}` } }));
  return prisma.product.create({
    data: {
      sku: `SKU-${counter}`,
      name: `Sản phẩm ${counter}`,
      slug: `san-pham-${counter}`,
      price: 1000000,
      stock: 5,
      categoryId: category.id,
      brandId: brand.id,
      ...rest,
    },
  });
};

const signIn = async (email = 'khach@example.com') => {
  const user = await createUser({ email });
  const { accessToken } = await loginAs(request, app, email);
  return { user, token: accessToken };
};

// Đưa sản phẩm vào giỏ trực tiếp bằng CSDL (bỏ qua API giỏ hàng đã có test riêng)
const fillCart = async (userId, entries) => {
  const cart = await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  for (const { product, quantity } of entries) {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity } });
  }
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const placeOrder = (token, body) => request(app).post('/api/orders').set(auth(token)).send(body);
const getOrder = (token, code) => request(app).get(`/api/orders/${code}`).set(auth(token));

const shipping = {
  recipientName: 'Nguyễn Văn A',
  phone: '0912345678',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 1',
  ward: 'Phường Bến Nghé',
  street: '12 Lê Lợi',
};

const stockOf = async (product) =>
  (await prisma.product.findUnique({ where: { id: product.id } })).stock;

// ---------------------------------------------------------------------------
// Quy tắc thuần
// ---------------------------------------------------------------------------
describe('Phí vận chuyển (BR-05)', () => {
  it('cố định 30.000 đ, miễn phí từ 5.000.000 đ', () => {
    expect(calculateShippingFee(1)).toBe(30000);
    expect(calculateShippingFee(4999999)).toBe(30000);
    expect(calculateShippingFee(5000000)).toBe(0);
    expect(calculateShippingFee(20000000)).toBe(0);
  });
});

describe('Mã đơn hàng (BR-12)', () => {
  it('dạng TSyymmdd-xxxx theo ngày giờ Việt Nam', () => {
    // 17:30 UTC ngày 27/10/2026 là 00:30 ngày 28/10 ở Việt Nam
    const code = generateOrderCode(new Date('2026-10-27T17:30:00Z'));

    expect(code).toMatch(ORDER_CODE_PATTERN);
    expect(code.startsWith('TS261028-')).toBe(true);
  });

  it('4 ký tự ngẫu nhiên lấy từ bảng ký tự không có ký tự dễ nhầm', () => {
    const codes = Array.from({ length: 200 }, () => generateOrderCode());

    for (const code of codes) expect(code.slice(-4)).not.toMatch(/[01OI]/);
    expect(new Set(codes).size).toBeGreaterThan(190);
  });

  it('dùng nguồn ngẫu nhiên được truyền vào (dễ kiểm thử)', () => {
    const code = generateOrderCode(new Date('2026-01-02T05:00:00Z'), () => 0);

    expect(code).toBe('TS260102-AAAA');
  });
});

// ---------------------------------------------------------------------------
// Đặt hàng thành công
// ---------------------------------------------------------------------------
describe('POST /api/orders - đặt hàng thành công (US-16)', () => {
  it('tạo đơn PENDING, COD chưa thanh toán, mã đúng định dạng, trả đủ thông tin (AC3)', async () => {
    const { user, token } = await signIn();
    const product = await makeProduct({ price: 2000000, stock: 5 });
    await fillCart(user.id, [{ product, quantity: 2 }]);

    const res = await placeOrder(token, { shipping, note: 'Giao giờ hành chính' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID', // BR-08
      subtotal: 4000000,
      shippingFee: 30000,
      total: 4030000,
      recipientName: 'Nguyễn Văn A',
      phone: '0912345678',
      shippingAddress: '12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
      note: 'Giao giờ hành chính',
    });
    expect(res.body.code).toMatch(ORDER_CODE_PATTERN);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      unitPrice: 2000000,
      quantity: 2,
      lineTotal: 4000000,
      slug: product.slug,
    });
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0]).toMatchObject({ status: 'PENDING', note: 'Đơn hàng được tạo' });
  });

  it('trừ tồn kho đúng số lượng và xóa sạch giỏ (AC3)', async () => {
    const { user, token } = await signIn();
    const a = await makeProduct({ stock: 5 });
    const b = await makeProduct({ stock: 10 });
    await fillCart(user.id, [
      { product: a, quantity: 2 },
      { product: b, quantity: 4 },
    ]);

    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(201);
    expect(await stockOf(a)).toBe(3);
    expect(await stockOf(b)).toBe(6);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('ghi lịch sử trạng thái kèm người đặt', async () => {
    const { user, token } = await signIn();
    await fillCart(user.id, [{ product: await makeProduct(), quantity: 1 }]);

    await placeOrder(token, { shipping });

    const history = await prisma.orderStatusHistory.findMany();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'PENDING', changedById: user.id });
  });

  it('đơn giá là giá khuyến mãi nếu có (BR-02)', async () => {
    const { user, token } = await signIn();
    const product = await makeProduct({ price: 20000000, salePrice: 18000000 });
    await fillCart(user.id, [{ product, quantity: 1 }]);

    const res = await placeOrder(token, { shipping });

    expect(res.body.items[0].unitPrice).toBe(18000000);
    expect(res.body.subtotal).toBe(18000000);
  });

  it('phí vận chuyển: 30.000 đ dưới 5 triệu, miễn phí từ 5 triệu (BR-05)', async () => {
    const { user, token } = await signIn();
    const cheap = await makeProduct({ price: 4999999 });
    await fillCart(user.id, [{ product: cheap, quantity: 1 }]);
    const under = await placeOrder(token, { shipping });
    expect(under.body).toMatchObject({ shippingFee: 30000, total: 5029999 });

    const exact = await makeProduct({ price: 5000000 });
    await fillCart(user.id, [{ product: exact, quantity: 1 }]);
    const over = await placeOrder(token, { shipping });
    expect(over.body).toMatchObject({ shippingFee: 0, total: 5000000 });
  });

  it('đặt đúng bằng số tồn kho cuối cùng thì kho về 0 (không âm)', async () => {
    const { user, token } = await signIn();
    const product = await makeProduct({ stock: 3 });
    await fillCart(user.id, [{ product, quantity: 3 }]);

    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(201);
    expect(await stockOf(product)).toBe(0);
  });

  it('BR-04: sửa sản phẩm sau khi đặt không làm đổi đơn cũ', async () => {
    const { user, token } = await signIn();
    const product = await makeProduct({ price: 1000000, name: 'Tên cũ' });
    await fillCart(user.id, [{ product, quantity: 2 }]);
    const placed = await placeOrder(token, { shipping });

    await prisma.product.update({
      where: { id: product.id },
      data: { name: 'Tên mới', price: 9000000, sku: 'SKU-MOI' },
    });
    const res = await getOrder(token, placed.body.code);

    expect(res.body.items[0]).toMatchObject({
      productName: 'Tên cũ',
      productSku: product.sku,
      unitPrice: 1000000,
    });
    expect(res.body.total).toBe(2030000);
  });

  it('BR-04: sửa hoặc xóa địa chỉ trong sổ sau khi đặt không làm đổi đơn cũ', async () => {
    const { user, token } = await signIn();
    const address = await prisma.address.create({ data: { userId: user.id, ...shipping } });
    await fillCart(user.id, [{ product: await makeProduct(), quantity: 1 }]);
    const placed = await placeOrder(token, { addressId: address.id });

    await prisma.address.delete({ where: { id: address.id } });
    const res = await getOrder(token, placed.body.code);

    expect(res.body.shippingAddress).toBe('12 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh');
    expect(res.body.recipientName).toBe('Nguyễn Văn A');
  });

  it('mã đơn của các đơn khác nhau luôn khác nhau', async () => {
    const { user, token } = await signIn();
    const codes = new Set();
    for (let i = 0; i < 5; i += 1) {
      await fillCart(user.id, [{ product: await makeProduct(), quantity: 1 }]);
      const res = await placeOrder(token, { shipping });
      codes.add(res.body.code);
    }
    expect(codes.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Địa chỉ giao hàng (AC1)
// ---------------------------------------------------------------------------
describe('POST /api/orders - địa chỉ giao hàng (AC1)', () => {
  it('chọn địa chỉ đã lưu trong sổ địa chỉ', async () => {
    const { user, token } = await signIn();
    const address = await prisma.address.create({
      data: { userId: user.id, ...shipping, recipientName: 'Người nhận đã lưu' },
    });
    await fillCart(user.id, [{ product: await makeProduct(), quantity: 1 }]);

    const res = await placeOrder(token, { addressId: address.id });

    expect(res.status).toBe(201);
    expect(res.body.recipientName).toBe('Người nhận đã lưu');
  });

  it('không dùng được địa chỉ của người khác (404) và không trừ kho', async () => {
    const owner = await signIn('chu@example.com');
    const other = await signIn('khac@example.com');
    const address = await prisma.address.create({ data: { userId: owner.user.id, ...shipping } });
    const product = await makeProduct();
    await fillCart(other.user.id, [{ product, quantity: 2 }]);

    const res = await placeOrder(other.token, { addressId: address.id });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
    expect(await stockOf(product)).toBe(5);
    expect(await prisma.order.count()).toBe(0);
  });

  it('địa chỉ không tồn tại thì 404', async () => {
    const { user, token } = await signIn();
    await fillCart(user.id, [{ product: await makeProduct(), quantity: 1 }]);

    expect((await placeOrder(token, { addressId: 9999 })).status).toBe(404);
  });

  it.each([
    ['không có địa chỉ', {}],
    ['có cả hai', { addressId: 1, shipping }],
    ['addressId là chuỗi', { addressId: '1' }],
    ['addressId bằng 0', { addressId: 0 }],
    ['thiếu họ tên', { shipping: { ...shipping, recipientName: '' } }],
    ['số điện thoại sai', { shipping: { ...shipping, phone: '123' } }],
    ['thiếu tỉnh/thành', { shipping: { ...shipping, province: '' } }],
    ['thiếu phường/xã', { shipping: { ...shipping, ward: '' } }],
    ['thiếu số nhà, đường', { shipping: { ...shipping, street: '' } }],
    ['ghi chú quá dài', { shipping, note: 'a'.repeat(501) }],
  ])('%s thì 400', async (_name, body) => {
    const { user, token } = await signIn();
    await fillCart(user.id, [{ product: await makeProduct(), quantity: 1 }]);

    const res = await placeOrder(token, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.order.count()).toBe(0);
  });

  it('ghi chú rỗng hoặc toàn dấu cách coi như không có ghi chú', async () => {
    const { user, token } = await signIn();
    await fillCart(user.id, [{ product: await makeProduct(), quantity: 1 }]);

    const res = await placeOrder(token, { shipping, note: '   ' });

    expect(res.status).toBe(201);
    expect(res.body.note).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Điều kiện đặt hàng
// ---------------------------------------------------------------------------
describe('POST /api/orders - điều kiện', () => {
  it('chưa đăng nhập thì 401', async () => {
    const res = await request(app).post('/api/orders').send({ shipping });

    expect(res.status).toBe(401);
  });

  it('giỏ trống (hoặc chưa có giỏ) thì 400 EMPTY_CART', async () => {
    const { user, token } = await signIn();

    const noCart = await placeOrder(token, { shipping });
    expect(noCart.status).toBe(400);
    expect(noCart.body.error.code).toBe('EMPTY_CART');

    await prisma.cart.create({ data: { userId: user.id } });
    const emptyCart = await placeOrder(token, { shipping });
    expect(emptyCart.body.error.code).toBe('EMPTY_CART');
  });

  it('chỉ dùng giỏ của chính người đặt', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    await fillCart(a.user.id, [{ product: await makeProduct(), quantity: 1 }]);

    const res = await placeOrder(b.token, { shipping });

    expect(res.body.error.code).toBe('EMPTY_CART');
    expect(await prisma.cartItem.count()).toBe(1); // giỏ của A còn nguyên
  });
});

// ---------------------------------------------------------------------------
// Không đủ hàng, không tạo đơn nào (AC4, AC5)
// ---------------------------------------------------------------------------
describe('POST /api/orders - không đủ hàng (AC4, AC5)', () => {
  it('một sản phẩm hết hàng thì 409, báo rõ sản phẩm nào, không tạo đơn, giỏ giữ nguyên', async () => {
    const { user, token } = await signIn();
    const soldOut = await makeProduct({ stock: 0, name: 'Máy hết hàng' });
    await fillCart(user.id, [{ product: soldOut, quantity: 1 }]);

    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CART_NOT_PURCHASABLE');
    expect(res.body.error.message).toContain('Máy hết hàng đã hết hàng');
    expect(res.body.error.details.items).toEqual([
      {
        productId: soldOut.id,
        name: 'Máy hết hàng',
        requested: 1,
        available: 0,
        reason: 'OUT_OF_STOCK',
      },
    ]);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it('không đủ số lượng thì báo số còn lại và số đã đặt', async () => {
    const { user, token } = await signIn();
    const product = await makeProduct({ stock: 2, name: 'Máy A' });
    await fillCart(user.id, [{ product, quantity: 5 }]);

    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Máy A chỉ còn 2 (bạn đặt 5)');
    expect(res.body.error.details.items[0]).toMatchObject({
      reason: 'INSUFFICIENT_STOCK',
      available: 2,
      requested: 5,
    });
  });

  it('nhiều sản phẩm có vấn đề thì báo tất cả cùng lúc', async () => {
    const { user, token } = await signIn();
    const soldOut = await makeProduct({ stock: 0, name: 'Máy X' });
    const few = await makeProduct({ stock: 1, name: 'Máy Y' });
    const hidden = await makeProduct({ isActive: false, name: 'Máy Z' });
    await fillCart(user.id, [
      { product: soldOut, quantity: 1 },
      { product: few, quantity: 3 },
      { product: hidden, quantity: 1 },
    ]);

    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(409);
    expect(res.body.error.details.items.map((item) => [item.name, item.reason])).toEqual([
      ['Máy X', 'OUT_OF_STOCK'],
      ['Máy Y', 'INSUFFICIENT_STOCK'],
      ['Máy Z', 'UNAVAILABLE'],
    ]);
  });

  it('sản phẩm đã ẩn (hoặc danh mục, thương hiệu bị ẩn) thì không đặt được', async () => {
    const { user, token } = await signIn();
    const category = await prisma.category.create({
      data: { name: 'Ẩn', slug: 'an', isActive: false },
    });
    const product = await makeProduct({ category });
    await fillCart(user.id, [{ product, quantity: 1 }]);

    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(409);
    expect(res.body.error.details.items[0].reason).toBe('UNAVAILABLE');
    expect(await stockOf(product)).toBe(5);
  });

  it('nguyên tử: có sản phẩm đủ hàng và sản phẩm hết hàng thì kho của sản phẩm đủ hàng KHÔNG bị trừ (AC5)', async () => {
    const { user, token } = await signIn();
    const good = await makeProduct({ stock: 10 });
    const bad = await makeProduct({ stock: 0 });
    // Sản phẩm đủ hàng có id nhỏ hơn nên được xử lý (trừ kho) trước khi gặp sản phẩm hết hàng
    await fillCart(user.id, [
      { product: good, quantity: 4 },
      { product: bad, quantity: 1 },
    ]);

    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(409);
    expect(await stockOf(good)).toBe(10);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.orderItem.count()).toBe(0);
    expect(await prisma.orderStatusHistory.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(2);
  });

  it('sau khi bỏ sản phẩm có vấn đề khỏi giỏ thì đặt được bình thường', async () => {
    const { user, token } = await signIn();
    const good = await makeProduct({ stock: 5 });
    const bad = await makeProduct({ stock: 0 });
    await fillCart(user.id, [
      { product: good, quantity: 1 },
      { product: bad, quantity: 1 },
    ]);
    expect((await placeOrder(token, { shipping })).status).toBe(409);

    await prisma.cartItem.deleteMany({ where: { productId: bad.id } });
    const res = await placeOrder(token, { shipping });

    expect(res.status).toBe(201);
    expect(await stockOf(good)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Đồng thời
// ---------------------------------------------------------------------------
describe('POST /api/orders - nhiều request cùng lúc', () => {
  it('bấm đúp: hai request cùng lúc của một người chỉ tạo đúng một đơn, kho chỉ trừ một lần (AC6)', async () => {
    const { user, token } = await signIn();
    const product = await makeProduct({ stock: 10 });
    await fillCart(user.id, [{ product, quantity: 3 }]);

    const results = await Promise.all([
      placeOrder(token, { shipping }),
      placeOrder(token, { shipping }),
      placeOrder(token, { shipping }),
    ]);

    const created = results.filter((res) => res.status === 201);
    const rejected = results.filter((res) => res.status === 400);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(2);
    expect(rejected[0].body.error.code).toBe('EMPTY_CART');
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(product)).toBe(7);
  });

  it('hai người cùng mua món còn ít: tổng số lượng đặt không vượt tồn kho, kho không âm (BR-03)', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct({ stock: 3 });
    await fillCart(a.user.id, [{ product, quantity: 2 }]);
    await fillCart(b.user.id, [{ product, quantity: 2 }]);

    const results = await Promise.all([
      placeOrder(a.token, { shipping }),
      placeOrder(b.token, { shipping }),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await stockOf(product)).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    // Người thua vẫn còn nguyên giỏ để chọn lại
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it('nhiều người cùng mua hết sạch hàng: đúng số đơn thành công, kho về 0', async () => {
    const buyers = await Promise.all(
      Array.from({ length: 5 }, (_unused, index) => signIn(`nguoi${index}@example.com`)),
    );
    const product = await makeProduct({ stock: 3 });
    for (const buyer of buyers) await fillCart(buyer.user.id, [{ product, quantity: 1 }]);

    const results = await Promise.all(buyers.map((buyer) => placeOrder(buyer.token, { shipping })));

    expect(results.filter((res) => res.status === 201)).toHaveLength(3);
    expect(results.filter((res) => res.status === 409)).toHaveLength(2);
    expect(await stockOf(product)).toBe(0);
    expect(await prisma.order.count()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Xem đơn
// ---------------------------------------------------------------------------
describe('GET /api/orders/:code', () => {
  const setup = async () => {
    const { user, token } = await signIn();
    await fillCart(user.id, [{ product: await makeProduct(), quantity: 2 }]);
    const placed = await placeOrder(token, { shipping });
    return { user, token, code: placed.body.code };
  };

  it('chủ đơn xem được đơn, kèm sản phẩm và lịch sử', async () => {
    const { token, code } = await setup();

    const res = await getOrder(token, code);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(code);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.history).toHaveLength(1);
  });

  it('đơn của người khác trả 404 (không lộ sự tồn tại)', async () => {
    const { code } = await setup();
    const other = await signIn('khac@example.com');

    const res = await getOrder(other.token, code);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  it('mã không tồn tại thì 404; mã sai định dạng thì 400', async () => {
    const { token } = await setup();

    expect((await getOrder(token, 'TS261028-ABCD')).status).toBe(404);
    expect((await getOrder(token, 'abc')).status).toBe(400);
    expect((await getOrder(token, 'TS261028-0000')).status).toBe(400); // chứa ký tự 0 không có trong bảng ký tự
  });

  it('chưa đăng nhập thì 401', async () => {
    const { code } = await setup();

    expect((await request(app).get(`/api/orders/${code}`)).status).toBe(401);
  });
});

describe('Ràng buộc ở tầng CSDL (lớp bảo vệ cuối cùng cho BR-03)', () => {
  it('CSDL từ chối tồn kho âm dù code có lỗi', async () => {
    const product = await makeProduct({ stock: 1 });

    await expect(
      prisma.product.update({ where: { id: product.id }, data: { stock: -1 } }),
    ).rejects.toThrow();
  });
});
