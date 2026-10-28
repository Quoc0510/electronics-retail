/**
 * @feature [F07] Quản lý đơn hàng - Kiểm thử API: khách xem và hủy đơn (US-17, US-18), Admin xem, lọc, đổi trạng thái
 * (US-19), luồng trạng thái BR-06, hoàn kho BR-07, thanh toán COD BR-08. Chạy trên PostgreSQL thật.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { allowedNext, canTransition } from '../src/lib/orderStatus.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// ---------------------------------------------------------------------------
// Dữ liệu và hàm hỗ trợ
// ---------------------------------------------------------------------------
let counter = 0;
const makeProduct = async (overrides = {}) => {
  // Giữ bản sao của bộ đếm vì các lời gọi chạy song song (Promise.all) sẽ làm bộ đếm đổi giữa các lần await
  counter += 1;
  const n = counter;
  const category = await prisma.category.create({
    data: { name: `Danh mục ${n}`, slug: `dm-${n}` },
  });
  const brand = await prisma.brand.create({
    data: { name: `Hãng ${n}`, slug: `hang-${n}` },
  });
  return prisma.product.create({
    data: {
      sku: `SKU-${n}`,
      name: `Sản phẩm ${n}`,
      slug: `san-pham-${n}`,
      price: 1000000,
      stock: 10,
      categoryId: category.id,
      brandId: brand.id,
      ...overrides,
    },
  });
};

const signIn = async (email = 'khach@example.com', role = 'CUSTOMER') => {
  const user = await createUser({ email, role, fullName: `Người dùng ${email}` });
  const { accessToken } = await loginAs(request, app, email);
  return { user, token: accessToken };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const shipping = {
  recipientName: 'Nguyễn Văn A',
  phone: '0912345678',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 1',
  ward: 'Phường Bến Nghé',
  street: '12 Lê Lợi',
};

// Tạo đơn qua API đặt hàng thật (trừ kho, snapshot, lịch sử) để các test hủy đơn kiểm tra đúng luồng thật
const placeOrder = async (buyer, entries, body = { shipping }) => {
  const cart = await prisma.cart.upsert({
    where: { userId: buyer.user.id },
    update: {},
    create: { userId: buyer.user.id },
  });
  for (const { product, quantity } of entries) {
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity } });
  }
  const res = await request(app).post('/api/orders').set(auth(buyer.token)).send(body);
  expect(res.status).toBe(201);
  return res.body;
};

const setStatus = (code, status) => prisma.order.update({ where: { code }, data: { status } });
const stockOf = async (product) =>
  (await prisma.product.findUnique({ where: { id: product.id } })).stock;

const listMine = (token, query = '') => request(app).get(`/api/orders${query}`).set(auth(token));
const cancelMine = (token, code, body = { reason: 'Đặt nhầm sản phẩm' }) =>
  request(app).post(`/api/orders/${code}/cancel`).set(auth(token)).send(body);
const adminList = (token, query = '') =>
  request(app).get(`/api/admin/orders${query}`).set(auth(token));
const adminGet = (token, code) => request(app).get(`/api/admin/orders/${code}`).set(auth(token));
const adminSetStatus = (token, code, body) =>
  request(app).patch(`/api/admin/orders/${code}/status`).set(auth(token)).send(body);

// ---------------------------------------------------------------------------
// Luồng trạng thái (BR-06)
// ---------------------------------------------------------------------------
describe('Luồng trạng thái đơn hàng (BR-06)', () => {
  it('đúng các bước cho phép', () => {
    expect(allowedNext('PENDING')).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(allowedNext('CONFIRMED')).toEqual(['SHIPPING', 'CANCELLED']);
    expect(allowedNext('SHIPPING')).toEqual(['COMPLETED']);
    expect(allowedNext('COMPLETED')).toEqual([]);
    expect(allowedNext('CANCELLED')).toEqual([]);
    expect(allowedNext('KHONG-CO')).toEqual([]);
  });

  it('không đi lùi, không nhảy cóc, không đổi đơn đã kết thúc', () => {
    expect(canTransition('CONFIRMED', 'PENDING')).toBe(false);
    expect(canTransition('PENDING', 'SHIPPING')).toBe(false);
    expect(canTransition('PENDING', 'COMPLETED')).toBe(false);
    expect(canTransition('SHIPPING', 'CANCELLED')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
    expect(canTransition('PENDING', 'PENDING')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Khách: danh sách đơn (US-17)
// ---------------------------------------------------------------------------
describe('GET /api/orders - danh sách đơn của khách (US-17 AC1)', () => {
  it('chưa đăng nhập thì 401', async () => {
    expect((await request(app).get('/api/orders')).status).toBe(401);
  });

  it('chưa có đơn nào thì trả danh sách rỗng', async () => {
    const { token } = await signIn();

    const res = await listMine(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], page: 1, pageSize: 10, total: 0 });
  });

  it('chỉ thấy đơn của chính mình, mới nhất trước', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct();
    const first = await placeOrder(a, [{ product, quantity: 1 }]);
    const second = await placeOrder(a, [{ product, quantity: 1 }]);
    await placeOrder(b, [{ product, quantity: 1 }]);

    const res = await listMine(a.token);

    expect(res.body.total).toBe(2);
    expect(res.body.items.map((order) => order.code)).toEqual([second.code, first.code]);
  });

  it('mỗi dòng có mã, trạng thái, tổng tiền, số sản phẩm và vài sản phẩm đầu để nhận ra đơn', async () => {
    const buyer = await signIn();
    // Tạo lần lượt (không song song) để id tăng dần theo đúng thứ tự mong đợi của các dòng trong đơn
    const products = [];
    for (let i = 0; i < 4; i += 1) products.push(await makeProduct());
    const placed = await placeOrder(
      buyer,
      products.map((product, index) => ({ product, quantity: index + 1 })),
    );

    const { body } = await listMine(buyer.token);
    const [order] = body.items;

    expect(order).toMatchObject({
      code: placed.code,
      status: 'PENDING',
      paymentStatus: 'UNPAID',
      total: placed.total,
      itemCount: 10, // 1 + 2 + 3 + 4
      moreItems: 1, // chỉ liệt kê 3 sản phẩm đầu
    });
    expect(order.items).toHaveLength(3);
    expect(order.items[0]).toMatchObject({ productName: products[0].name, quantity: 1 });
    expect(order.customer).toBeUndefined();
  });

  it('lọc theo trạng thái', async () => {
    const buyer = await signIn();
    const product = await makeProduct();
    const pending = await placeOrder(buyer, [{ product, quantity: 1 }]);
    const done = await placeOrder(buyer, [{ product, quantity: 1 }]);
    await setStatus(done.code, 'COMPLETED');

    const res = await listMine(buyer.token, '?status=COMPLETED');

    expect(res.body.total).toBe(1);
    expect(res.body.items[0].code).toBe(done.code);
    expect((await listMine(buyer.token, '?status=PENDING')).body.items[0].code).toBe(pending.code);
  });

  it('phân trang', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ stock: 100 });
    for (let i = 0; i < 5; i += 1) await placeOrder(buyer, [{ product, quantity: 1 }]);

    const page1 = await listMine(buyer.token, '?pageSize=2&page=1');
    const page3 = await listMine(buyer.token, '?pageSize=2&page=3');

    expect(page1.body).toMatchObject({ page: 1, pageSize: 2, total: 5 });
    expect(page1.body.items).toHaveLength(2);
    expect(page3.body.items).toHaveLength(1);
  });

  it.each([
    ['trạng thái sai', '?status=DANG_XU_LY'],
    ['page bằng 0', '?page=0'],
    ['page là chữ', '?page=abc'],
    ['pageSize quá lớn', '?pageSize=500'],
  ])('%s thì 400', async (_name, query) => {
    const { token } = await signIn();

    expect((await listMine(token, query)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Khách: hủy đơn (US-18)
// ---------------------------------------------------------------------------
describe('POST /api/orders/:code/cancel - khách hủy đơn (US-18)', () => {
  it('hủy đơn đang chờ xác nhận: trạng thái, lý do, lịch sử, hoàn kho (AC1 đến AC3)', async () => {
    const buyer = await signIn();
    const a = await makeProduct({ stock: 10 });
    const b = await makeProduct({ stock: 6 });
    const placed = await placeOrder(buyer, [
      { product: a, quantity: 3 },
      { product: b, quantity: 2 },
    ]);
    expect(await stockOf(a)).toBe(7);
    expect(await stockOf(b)).toBe(4);

    const res = await cancelMine(buyer.token, placed.code, {
      reason: 'Muốn đổi địa chỉ giao hàng',
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      code: placed.code,
      status: 'CANCELLED',
      cancelReason: 'Muốn đổi địa chỉ giao hàng',
      paymentStatus: 'UNPAID', // BR-08: hủy thì không thành PAID
    });
    expect(res.body.history.map((entry) => entry.status)).toEqual(['PENDING', 'CANCELLED']);
    expect(res.body.history[1].note).toBe('Khách hàng hủy đơn: Muốn đổi địa chỉ giao hàng');
    expect(await stockOf(a)).toBe(10); // BR-07: cộng trả đúng số lượng từng sản phẩm
    expect(await stockOf(b)).toBe(6);
  });

  it('ghi người thực hiện vào lịch sử', async () => {
    const buyer = await signIn();
    const placed = await placeOrder(buyer, [{ product: await makeProduct(), quantity: 1 }]);

    await cancelMine(buyer.token, placed.code);

    const history = await prisma.orderStatusHistory.findMany({ orderBy: { id: 'asc' } });
    expect(history.at(-1)).toMatchObject({ status: 'CANCELLED', changedById: buyer.user.id });
  });

  it.each(['CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'])(
    'đơn đang %s thì khách không tự hủy được (400), kho không đổi',
    async (status) => {
      const buyer = await signIn();
      const product = await makeProduct({ stock: 10 });
      const placed = await placeOrder(buyer, [{ product, quantity: 2 }]);
      await setStatus(placed.code, status);

      const res = await cancelMine(buyer.token, placed.code);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
      expect(res.body.error.message).toContain('không thể tự hủy');
      expect(await stockOf(product)).toBe(8);
      expect((await prisma.order.findUnique({ where: { code: placed.code } })).status).toBe(status);
    },
  );

  it('không hủy được đơn của người khác (404) và kho không đổi', async () => {
    const owner = await signIn('chu@example.com');
    const other = await signIn('khac@example.com');
    const product = await makeProduct({ stock: 10 });
    const placed = await placeOrder(owner, [{ product, quantity: 1 }]);

    const res = await cancelMine(other.token, placed.code);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
    expect(await stockOf(product)).toBe(9);
  });

  it('mã không tồn tại thì 404; mã sai định dạng thì 400; chưa đăng nhập thì 401', async () => {
    const { token } = await signIn();

    expect((await cancelMine(token, 'TS261028-ABCD')).status).toBe(404);
    expect((await cancelMine(token, 'abc')).status).toBe(400);
    expect(
      (await request(app).post('/api/orders/TS261028-ABCD/cancel').send({ reason: 'abc xyz' }))
        .status,
    ).toBe(401);
  });

  it.each([
    ['thiếu lý do', {}],
    ['lý do rỗng', { reason: '' }],
    ['lý do quá ngắn', { reason: 'ab' }],
    ['lý do toàn dấu cách', { reason: '     ' }],
    ['lý do quá dài', { reason: 'a'.repeat(201) }],
    ['lý do không phải chuỗi', { reason: 123 }],
  ])('%s thì 400 và đơn giữ nguyên', async (_name, body) => {
    const buyer = await signIn();
    const placed = await placeOrder(buyer, [{ product: await makeProduct(), quantity: 1 }]);

    const res = await cancelMine(buyer.token, placed.code, body);

    expect(res.status).toBe(400);
    expect((await prisma.order.findUnique({ where: { code: placed.code } })).status).toBe(
      'PENDING',
    );
  });

  it('bấm hủy hai lần cùng lúc: chỉ một lần thành công, kho chỉ được hoàn một lần', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ stock: 10 });
    const placed = await placeOrder(buyer, [{ product, quantity: 4 }]);

    const results = await Promise.all([
      cancelMine(buyer.token, placed.code),
      cancelMine(buyer.token, placed.code),
      cancelMine(buyer.token, placed.code),
    ]);

    expect(results.filter((res) => res.status === 200)).toHaveLength(1);
    expect(results.filter((res) => res.status === 400)).toHaveLength(2);
    expect(await stockOf(product)).toBe(10); // không phải 14 hay 18
    expect(await prisma.orderStatusHistory.count({ where: { status: 'CANCELLED' } })).toBe(1);
  });

  it('khách hủy đúng lúc Admin xác nhận: chỉ một bên thắng và kho khớp với kết quả cuối', async () => {
    const buyer = await signIn();
    const admin = await signIn('admin@example.com', 'ADMIN');
    const product = await makeProduct({ stock: 10 });
    const placed = await placeOrder(buyer, [{ product, quantity: 3 }]);

    const [cancelRes, confirmRes] = await Promise.all([
      cancelMine(buyer.token, placed.code),
      adminSetStatus(admin.token, placed.code, { status: 'CONFIRMED' }),
    ]);

    const final = (await prisma.order.findUnique({ where: { code: placed.code } })).status;
    if (final === 'CANCELLED') {
      expect(cancelRes.status).toBe(200);
      expect(confirmRes.status).toBe(400);
      expect(await stockOf(product)).toBe(10); // đã hoàn kho
    } else {
      // Admin xác nhận trước: khách không còn hủy được
      expect(final).toBe('CONFIRMED');
      expect(confirmRes.status).toBe(200);
      expect(cancelRes.status).toBe(400);
      expect(await stockOf(product)).toBe(7); // chưa hoàn kho
    }
  });
});

// ---------------------------------------------------------------------------
// Admin: danh sách và chi tiết (US-19 AC1)
// ---------------------------------------------------------------------------
describe('GET /api/admin/orders - Admin xem danh sách đơn (US-19 AC1)', () => {
  it('chưa đăng nhập 401, khách hàng 403', async () => {
    const customer = await signIn();

    expect((await request(app).get('/api/admin/orders')).status).toBe(401);
    expect((await adminList(customer.token)).status).toBe(403);
    expect((await adminGet(customer.token, 'TS261028-ABCD')).status).toBe(403);
    expect(
      (await adminSetStatus(customer.token, 'TS261028-ABCD', { status: 'CONFIRMED' })).status,
    ).toBe(403);
  });

  it('thấy đơn của mọi khách kèm thông tin khách hàng, mới nhất trước', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct({ stock: 100 });
    const first = await placeOrder(a, [{ product, quantity: 1 }]);
    const second = await placeOrder(b, [{ product, quantity: 2 }]);

    const res = await adminList(admin.token);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((order) => order.code)).toEqual([second.code, first.code]);
    expect(res.body.items[0].customer).toMatchObject({ email: 'b@example.com' });
    expect(res.body.items[0].itemCount).toBe(2);
  });

  describe('lọc, tìm và phân trang', () => {
    const seed = async () => {
      const admin = await signIn('admin@example.com', 'ADMIN');
      const buyer = await signIn('a@example.com');
      const product = await makeProduct({ stock: 100 });
      const pending = await placeOrder(buyer, [{ product, quantity: 1 }]);
      const confirmed = await placeOrder(buyer, [{ product, quantity: 1 }], {
        shipping: { ...shipping, recipientName: 'Lê Thị Hoa', phone: '0987000111' },
      });
      await setStatus(confirmed.code, 'CONFIRMED');
      return { admin, pending, confirmed };
    };

    it('lọc theo trạng thái', async () => {
      const { admin, confirmed } = await seed();

      const res = await adminList(admin.token, '?status=CONFIRMED');

      expect(res.body.items.map((order) => order.code)).toEqual([confirmed.code]);
    });

    it('tìm theo mã đơn, không phân biệt hoa thường, khớp một phần', async () => {
      const { admin, pending } = await seed();

      const full = await adminList(admin.token, `?search=${pending.code.toLowerCase()}`);
      const part = await adminList(admin.token, `?search=${pending.code.slice(-4)}`);

      expect(full.body.items.map((order) => order.code)).toEqual([pending.code]);
      expect(part.body.items.some((order) => order.code === pending.code)).toBe(true);
    });

    it('tìm theo tên hoặc số điện thoại người nhận', async () => {
      const { admin, confirmed } = await seed();

      expect(
        (await adminList(admin.token, '?search=' + encodeURIComponent('hoa'))).body.items[0].code,
      ).toBe(confirmed.code);
      expect((await adminList(admin.token, '?search=0987000')).body.items[0].code).toBe(
        confirmed.code,
      );
    });

    it('ký tự đặc biệt % và _ được hiểu đúng nghĩa, không khớp mọi đơn', async () => {
      const { admin } = await seed();

      expect((await adminList(admin.token, '?search=%25')).body.total).toBe(0);
      expect((await adminList(admin.token, '?search=_')).body.total).toBe(0);
    });

    it('kết hợp trạng thái và từ khóa; không có kết quả thì danh sách rỗng', async () => {
      const { admin, pending } = await seed();

      const none = await adminList(admin.token, `?status=CONFIRMED&search=${pending.code}`);
      expect(none.body.total).toBe(0);
    });

    it('phân trang kèm tổng số', async () => {
      const admin = await signIn('admin@example.com', 'ADMIN');
      const buyer = await signIn('a@example.com');
      const product = await makeProduct({ stock: 100 });
      for (let i = 0; i < 5; i += 1) await placeOrder(buyer, [{ product, quantity: 1 }]);

      const res = await adminList(admin.token, '?pageSize=2&page=3');

      expect(res.body).toMatchObject({ page: 3, pageSize: 2, total: 5 });
      expect(res.body.items).toHaveLength(1);
    });

    it.each([
      ['trạng thái sai', '?status=ABC'],
      ['page bằng 0', '?page=0'],
      ['pageSize quá lớn', '?pageSize=51'],
      ['từ khóa quá dài', `?search=${'a'.repeat(51)}`],
    ])('%s thì 400', async (_name, query) => {
      const admin = await signIn('admin@example.com', 'ADMIN');

      expect((await adminList(admin.token, query)).status).toBe(400);
    });
  });
});

describe('GET /api/admin/orders/:code - chi tiết đơn', () => {
  it('có khách hàng, sản phẩm, địa chỉ, lịch sử kèm người thực hiện và các bước tiếp theo được phép', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('a@example.com');
    const placed = await placeOrder(buyer, [{ product: await makeProduct(), quantity: 2 }]);

    const res = await adminGet(admin.token, placed.code);

    expect(res.status).toBe(200);
    expect(res.body.customer).toMatchObject({ email: 'a@example.com', id: buyer.user.id });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.shippingAddress).toContain('12 Lê Lợi');
    expect(res.body.allowedNext).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(res.body.history[0].changedBy).toMatchObject({
      fullName: buyer.user.fullName,
      role: 'CUSTOMER',
    });
  });

  it('mã không tồn tại thì 404; sai định dạng thì 400', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');

    expect((await adminGet(admin.token, 'TS261028-ABCD')).status).toBe(404);
    expect((await adminGet(admin.token, 'abc')).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Admin: đổi trạng thái (US-19 AC2 đến AC4)
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/orders/:code/status - Admin đổi trạng thái', () => {
  const setup = async (stock = 10, quantity = 2) => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('a@example.com');
    const product = await makeProduct({ stock });
    const placed = await placeOrder(buyer, [{ product, quantity }]);
    return { admin, buyer, product, code: placed.code };
  };

  it('đi đủ luồng PENDING → CONFIRMED → SHIPPING → COMPLETED, mỗi bước ghi lịch sử (AC3)', async () => {
    const { admin, code } = await setup();

    for (const status of ['CONFIRMED', 'SHIPPING', 'COMPLETED']) {
      const res = await adminSetStatus(admin.token, code, { status, note: `Chuyển ${status}` });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(status);
    }

    const { body } = await adminGet(admin.token, code);
    expect(body.history.map((entry) => entry.status)).toEqual([
      'PENDING',
      'CONFIRMED',
      'SHIPPING',
      'COMPLETED',
    ]);
    expect(body.history[1]).toMatchObject({
      note: 'Chuyển CONFIRMED',
      changedBy: { role: 'ADMIN' },
    });
    expect(body.allowedNext).toEqual([]);
  });

  it('chỉ khi hoàn thành mới thành "đã thanh toán" (BR-08)', async () => {
    const { admin, code } = await setup();
    const paymentOf = async () =>
      (await prisma.order.findUnique({ where: { code } })).paymentStatus;

    await adminSetStatus(admin.token, code, { status: 'CONFIRMED' });
    expect(await paymentOf()).toBe('UNPAID');
    await adminSetStatus(admin.token, code, { status: 'SHIPPING' });
    expect(await paymentOf()).toBe('UNPAID');
    await adminSetStatus(admin.token, code, { status: 'COMPLETED' });
    expect(await paymentOf()).toBe('PAID');
  });

  it.each([
    ['PENDING', 'SHIPPING'],
    ['PENDING', 'COMPLETED'],
    ['PENDING', 'PENDING'],
    ['CONFIRMED', 'PENDING'],
    ['CONFIRMED', 'COMPLETED'],
    ['SHIPPING', 'CONFIRMED'],
    ['SHIPPING', 'CANCELLED'],
    ['COMPLETED', 'SHIPPING'],
    ['COMPLETED', 'CANCELLED'],
    ['CANCELLED', 'PENDING'],
    ['CANCELLED', 'CONFIRMED'],
  ])('%s → %s là sai luồng: 400, đơn và kho không đổi (AC2)', async (from, to) => {
    const { admin, code, product } = await setup(10, 2);
    await setStatus(code, from);
    const history = await prisma.orderStatusHistory.count();

    const res = await adminSetStatus(admin.token, code, { status: to, note: 'Lý do thử nghiệm' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect((await prisma.order.findUnique({ where: { code } })).status).toBe(from);
    expect(await stockOf(product)).toBe(8);
    expect(await prisma.orderStatusHistory.count()).toBe(history);
  });

  it.each(['PENDING', 'CONFIRMED'])(
    'Admin hủy đơn đang %s: hoàn kho, lưu lý do, ghi lịch sử (AC4)',
    async (from) => {
      const { admin, code, product } = await setup(10, 3);
      await setStatus(code, from);

      const res = await adminSetStatus(admin.token, code, {
        status: 'CANCELLED',
        note: 'Hết hàng thực tế tại kho',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'Hết hàng thực tế tại kho',
        paymentStatus: 'UNPAID',
      });
      expect(res.body.history.at(-1)).toMatchObject({
        status: 'CANCELLED',
        note: 'Cửa hàng hủy đơn: Hết hàng thực tế tại kho',
      });
      expect(await stockOf(product)).toBe(10);
    },
  );

  it('hủy đơn nhiều sản phẩm thì hoàn kho đúng từng sản phẩm', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('a@example.com');
    const a = await makeProduct({ stock: 10 });
    const b = await makeProduct({ stock: 5 });
    const placed = await placeOrder(buyer, [
      { product: a, quantity: 4 },
      { product: b, quantity: 5 },
    ]);
    expect(await stockOf(b)).toBe(0);

    await adminSetStatus(admin.token, placed.code, { status: 'CANCELLED', note: 'Khách yêu cầu' });

    expect(await stockOf(a)).toBe(10);
    expect(await stockOf(b)).toBe(5);
  });

  it('hủy đơn bắt buộc có lý do', async () => {
    const { admin, code, product } = await setup();

    for (const body of [
      { status: 'CANCELLED' },
      { status: 'CANCELLED', note: 'ab' },
      { status: 'CANCELLED', note: '  ' },
    ]) {
      const res = await adminSetStatus(admin.token, code, body);
      expect(res.status).toBe(400);
      expect(res.body.error.details.note[0]).toContain('lý do hủy đơn');
    }
    expect((await prisma.order.findUnique({ where: { code } })).status).toBe('PENDING');
    expect(await stockOf(product)).toBe(8);
  });

  it('các bước khác không bắt buộc ghi chú; ghi chú quá dài bị từ chối', async () => {
    const { admin, code } = await setup();

    expect((await adminSetStatus(admin.token, code, { status: 'CONFIRMED' })).status).toBe(200);
    expect(
      (await adminSetStatus(admin.token, code, { status: 'SHIPPING', note: 'a'.repeat(201) }))
        .status,
    ).toBe(400);
  });

  it.each([
    ['thiếu trạng thái', {}],
    ['trạng thái lạ', { status: 'DANG_XU_LY' }],
    ['trạng thái không phải chuỗi', { status: 5 }],
  ])('%s thì 400', async (_name, body) => {
    const { admin, code } = await setup();

    expect((await adminSetStatus(admin.token, code, body)).status).toBe(400);
  });

  it('mã không tồn tại thì 404; sai định dạng thì 400', async () => {
    const { admin } = await setup();

    expect(
      (await adminSetStatus(admin.token, 'TS261028-ZZZZ', { status: 'CONFIRMED' })).status,
    ).toBe(404);
    expect((await adminSetStatus(admin.token, 'abc', { status: 'CONFIRMED' })).status).toBe(400);
  });

  it('chỉ ảnh hưởng đơn được chọn', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('a@example.com');
    const product = await makeProduct({ stock: 50 });
    const target = await placeOrder(buyer, [{ product, quantity: 1 }]);
    const other = await placeOrder(buyer, [{ product, quantity: 1 }]);

    await adminSetStatus(admin.token, target.code, { status: 'CONFIRMED' });

    expect((await prisma.order.findUnique({ where: { code: other.code } })).status).toBe('PENDING');
  });

  it('hai Admin cùng xác nhận một đơn: chỉ một lần thành công, chỉ một dòng lịch sử', async () => {
    const { code } = await setup();
    const admin1 = await signIn('ad1@example.com', 'ADMIN');
    const admin2 = await signIn('ad2@example.com', 'ADMIN');

    const results = await Promise.all([
      adminSetStatus(admin1.token, code, { status: 'CONFIRMED' }),
      adminSetStatus(admin2.token, code, { status: 'CONFIRMED' }),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 400]);
    expect(await prisma.orderStatusHistory.count({ where: { status: 'CONFIRMED' } })).toBe(1);
  });

  it('hai Admin cùng hủy một đơn: kho chỉ được hoàn một lần', async () => {
    const { code, product } = await setup(10, 4);
    const admin1 = await signIn('ad1@example.com', 'ADMIN');
    const admin2 = await signIn('ad2@example.com', 'ADMIN');

    const results = await Promise.all([
      adminSetStatus(admin1.token, code, { status: 'CANCELLED', note: 'Lý do một' }),
      adminSetStatus(admin2.token, code, { status: 'CANCELLED', note: 'Lý do hai' }),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 400]);
    expect(await stockOf(product)).toBe(10);
  });

  it('khách xem lại đơn thấy trạng thái và dòng thời gian mới', async () => {
    const { admin, buyer, code } = await setup();
    await adminSetStatus(admin.token, code, {
      status: 'CONFIRMED',
      note: 'Đã gọi xác nhận với khách',
    });

    const res = await request(app).get(`/api/orders/${code}`).set(auth(buyer.token));

    expect(res.body.status).toBe('CONFIRMED');
    expect(res.body.history.map((entry) => entry.status)).toEqual(['PENDING', 'CONFIRMED']);
    expect(res.body.history[1].note).toBe('Đã gọi xác nhận với khách');
  });
});

describe('Đồng bộ luồng trạng thái giữa backend và giao diện', () => {
  it('luồng ở shared (dùng cho nút bấm) giống hệt luồng của backend (nơi quyết định)', async () => {
    const { ORDER_TRANSITIONS, ORDER_STATUSES } = await import('../../shared/src/orderStatus.js');
    const { TRANSITIONS, ORDER_STATUSES: backendStatuses } =
      await import('../src/lib/orderStatus.js');

    expect(ORDER_STATUSES).toEqual(backendStatuses);
    expect(ORDER_TRANSITIONS).toEqual(TRANSITIONS);
  });
});
