/**
 * @feature [F13] Đặt hàng không cần đăng nhập và điểm thành viên - Kiểm thử API: khách vãng lai đặt hàng (BR-11),
 * chống đặt trùng bằng requestId, tra cứu và hủy đơn bằng mã đơn + số điện thoại, cộng điểm thành viên khi đơn hoàn thành
 * (BR-15). Chạy trên PostgreSQL thật.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  POINT_UNIT_VND,
  amountToNextPoint,
  calculatePoints,
  pointsForSpent,
} from '../src/lib/points.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// ---------------------------------------------------------------------------
// Dữ liệu và hàm hỗ trợ
// ---------------------------------------------------------------------------
let counter = 0;
const makeProduct = async (overrides = {}) => {
  // Giữ bản sao của bộ đếm vì các lời gọi có thể chạy song song
  counter += 1;
  const n = counter;
  const category = await prisma.category.create({
    data: { name: `Danh mục ${n}`, slug: `dm-${n}` },
  });
  const brand = await prisma.brand.create({ data: { name: `Hãng ${n}`, slug: `hang-${n}` } });
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

const shipping = {
  recipientName: 'Trần Thị B',
  phone: '0987654321',
  province: 'Đà Nẵng',
  district: 'Hải Châu',
  ward: 'Thạch Thang',
  street: '5 Bạch Đằng',
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const stockOf = async (product) =>
  (await prisma.product.findUnique({ where: { id: product.id } })).stock;

// Đặt hàng không đăng nhập; mặc định mỗi lần là một requestId mới
const guestOrder = (items, extra = {}) =>
  request(app)
    .post('/api/orders/guest')
    .send({ items, shipping, requestId: randomUUID(), ...extra });

const lookup = (code, phone = shipping.phone) =>
  request(app).post('/api/orders/lookup').send({ code, phone });
const lookupCancel = (code, phone = shipping.phone, reason = 'Đặt nhầm sản phẩm') =>
  request(app).post('/api/orders/lookup/cancel').send({ code, phone, reason });

const signIn = async (email, role = 'CUSTOMER') => {
  const user = await createUser({ email, role, fullName: `Người dùng ${email}` });
  const { accessToken } = await loginAs(request, app, email);
  return { user, token: accessToken };
};

// Thành viên đặt hàng qua giỏ trong tài khoản (đường đặt hàng đã có từ F06)
const memberOrder = async (buyer, product, quantity = 1) => {
  // Giỏ vẫn còn sau khi đặt (chỉ các dòng hàng bị xóa) nên lần đặt sau dùng lại giỏ đó
  const cart = await prisma.cart.upsert({
    where: { userId: buyer.user.id },
    update: {},
    create: { userId: buyer.user.id },
  });
  await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity } });
  const res = await request(app).post('/api/orders').set(auth(buyer.token)).send({ shipping });
  expect(res.status).toBe(201);
  return res.body;
};

// Điểm và tổng đã mua hiện có của một thành viên (đọc thẳng từ DB)
const memberStats = async (buyer) => {
  const { points, totalSpent } = await prisma.user.findUnique({ where: { id: buyer.user.id } });
  return { points, totalSpent };
};

const adminSetStatus = (token, code, status, note) =>
  request(app)
    .patch(`/api/admin/orders/${code}/status`)
    .set(auth(token))
    .send({ status, ...(note ? { note } : {}) });

// Đưa đơn qua các bước tới trạng thái mong muốn bằng API của Admin
const advance = async (admin, code, ...statuses) => {
  for (const status of statuses) {
    const res = await adminSetStatus(admin.token, code, status);
    expect(res.status).toBe(200);
  }
};

// ---------------------------------------------------------------------------
// Khách vãng lai đặt hàng (BR-11)
// ---------------------------------------------------------------------------
describe('POST /api/orders/guest - đặt hàng không cần đăng nhập (BR-11)', () => {
  it('đặt được khi chưa đăng nhập: tạo đơn không chủ tài khoản, trừ kho, chụp lại giá và địa chỉ', async () => {
    const product = await makeProduct({ price: 2000000, salePrice: 1500000, stock: 5 });

    const res = await guestOrder([{ productId: product.id, quantity: 2 }]);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID',
      subtotal: 3000000, // BR-02: dùng giá khuyến mãi
      shippingFee: 30000, // BR-05
      total: 3030000,
      recipientName: 'Trần Thị B',
      phone: '0987654321',
      shippingAddress: '5 Bạch Đằng, Thạch Thang, Hải Châu, Đà Nẵng',
      isGuest: true,
      pointsEarned: 0,
      pointsExpected: 0,
    });
    expect(res.body.code).toMatch(/^TS\d{6}-[A-HJ-NP-Z2-9]{4}$/);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productName: product.name,
      unitPrice: 1500000,
      quantity: 2,
    });
    expect(res.body.history).toHaveLength(1);
    expect(res.body.history[0].note).toContain('khách không đăng nhập');

    const saved = await prisma.order.findUnique({ where: { code: res.body.code } });
    expect(saved.userId).toBeNull();
    expect(await stockOf(product)).toBe(3); // BR-03
  });

  it('không cần quận/huyện (nhiều địa phương đã bỏ cấp này): địa chỉ ghép không thừa dấu phẩy', async () => {
    const product = await makeProduct();

    const res = await guestOrder([{ productId: product.id, quantity: 1 }], {
      shipping: { ...shipping, district: undefined },
    });
    const blank = await guestOrder([{ productId: product.id, quantity: 1 }], {
      shipping: { ...shipping, district: '   ' },
    });

    expect(res.status).toBe(201);
    expect(res.body.shippingAddress).toBe('5 Bạch Đằng, Thạch Thang, Đà Nẵng');
    expect(blank.status).toBe(201);
    expect(blank.body.shippingAddress).toBe('5 Bạch Đằng, Thạch Thang, Đà Nẵng');
  });

  it('miễn phí vận chuyển khi từ 5.000.000 đ (BR-05)', async () => {
    const product = await makeProduct({ price: 2500000 });

    const res = await guestOrder([{ productId: product.id, quantity: 2 }]);

    expect(res.body.shippingFee).toBe(0);
    expect(res.body.total).toBe(5000000);
  });

  it('gộp các dòng trùng sản phẩm và lưu ghi chú', async () => {
    const product = await makeProduct();

    const res = await guestOrder(
      [
        { productId: product.id, quantity: 1 },
        { productId: product.id, quantity: 2 },
      ],
      { note: '  Gọi trước khi giao  ' },
    );

    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
    expect(res.body.note).toBe('Gọi trước khi giao');
    expect(await stockOf(product)).toBe(7);
  });

  it('thành viên đã đăng nhập vẫn dùng được đường này như khách (không gắn vào tài khoản)', async () => {
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct();

    const res = await guestOrder([{ productId: product.id, quantity: 1 }]).set(auth(buyer.token));

    expect(res.status).toBe(201);
    expect((await prisma.order.findUnique({ where: { code: res.body.code } })).userId).toBeNull();
  });

  describe('dữ liệu sai dạng bị từ chối trước khi chạm kho', () => {
    it.each([
      ['giỏ trống', { items: [] }],
      ['thiếu địa chỉ', { shipping: undefined }],
      ['số điện thoại sai', { shipping: { ...shipping, phone: '123' } }],
      ['thiếu tên người nhận', { shipping: { ...shipping, recipientName: '' } }],
      ['thiếu requestId', { requestId: undefined }],
      ['requestId không phải UUID', { requestId: 'abc' }],
      ['ghi chú quá dài', { note: 'a'.repeat(501) }],
      ['số lượng bằng 0', { items: [{ productId: 1, quantity: 0 }] }],
      ['số lượng quá lớn', { items: [{ productId: 1, quantity: 100 }] }],
      ['mã sản phẩm không phải số', { items: [{ productId: 'x', quantity: 1 }] }],
    ])('%s -> 400', async (_name, override) => {
      const product = await makeProduct();
      const body = {
        items: [{ productId: product.id, quantity: 1 }],
        shipping,
        requestId: randomUUID(),
        ...override,
      };

      const res = await request(app).post('/api/orders/guest').send(body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(await stockOf(product)).toBe(10);
      expect(await prisma.order.count()).toBe(0);
    });
  });

  describe('sản phẩm không mua được -> 409 và không trừ kho sản phẩm nào (US-16 AC4, AC5)', () => {
    it('sản phẩm đã ẩn, hết hàng, không đủ số lượng được gom vào một lần báo', async () => {
      const good = await makeProduct({ stock: 5 });
      const hidden = await makeProduct({ isActive: false });
      const soldOut = await makeProduct({ stock: 0 });
      const few = await makeProduct({ stock: 2 });

      const res = await guestOrder([
        { productId: good.id, quantity: 1 },
        { productId: hidden.id, quantity: 1 },
        { productId: soldOut.id, quantity: 1 },
        { productId: few.id, quantity: 3 },
      ]);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CART_NOT_PURCHASABLE');
      const reasons = Object.fromEntries(
        res.body.error.details.items.map((item) => [item.productId, item.reason]),
      );
      expect(reasons).toEqual({
        [hidden.id]: 'UNAVAILABLE',
        [soldOut.id]: 'OUT_OF_STOCK',
        [few.id]: 'INSUFFICIENT_STOCK',
      });
      expect(await stockOf(good)).toBe(5); // sản phẩm đủ hàng cũng không bị trừ
      expect(await prisma.order.count()).toBe(0);
    });

    it('sản phẩm không tồn tại -> 409 UNAVAILABLE', async () => {
      const good = await makeProduct();

      const res = await guestOrder([
        { productId: good.id, quantity: 1 },
        { productId: 999999, quantity: 1 },
      ]);

      expect(res.status).toBe(409);
      expect(res.body.error.details.items).toEqual([
        expect.objectContaining({ productId: 999999, reason: 'UNAVAILABLE' }),
      ]);
      expect(await stockOf(good)).toBe(10);
    });
  });

  describe('chống đặt trùng bằng requestId', () => {
    it('gửi lại cùng requestId trả đúng đơn đã tạo, kho chỉ bị trừ một lần', async () => {
      const product = await makeProduct();
      const requestId = randomUUID();
      const items = [{ productId: product.id, quantity: 2 }];

      const first = await guestOrder(items, { requestId });
      const again = await guestOrder(items, { requestId });

      expect(first.status).toBe(201);
      expect(again.status).toBe(201);
      expect(again.body.code).toBe(first.body.code);
      expect(await prisma.order.count()).toBe(1);
      expect(await stockOf(product)).toBe(8);
    });

    it('5 request song song cùng requestId chỉ tạo đúng một đơn và cùng trả đơn đó', async () => {
      const product = await makeProduct();
      const requestId = randomUUID();

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          guestOrder([{ productId: product.id, quantity: 1 }], { requestId }),
        ),
      );

      expect(results.map((res) => res.status)).toEqual([201, 201, 201, 201, 201]);
      expect(new Set(results.map((res) => res.body.code)).size).toBe(1);
      expect(await prisma.order.count()).toBe(1);
      expect(await stockOf(product)).toBe(9); // trừ đúng một lần, request thua đã hoàn kho
    });

    it('requestId khác nhau là các đơn khác nhau', async () => {
      const product = await makeProduct();

      const a = await guestOrder([{ productId: product.id, quantity: 1 }]);
      const b = await guestOrder([{ productId: product.id, quantity: 1 }]);

      expect(a.body.code).not.toBe(b.body.code);
      expect(await prisma.order.count()).toBe(2);
    });
  });

  it('nhiều khách đặt cùng lúc không bao giờ làm tồn kho âm (BR-03)', async () => {
    const product = await makeProduct({ stock: 3 });

    const results = await Promise.all(
      Array.from({ length: 6 }, () => guestOrder([{ productId: product.id, quantity: 1 }])),
    );

    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 201, 201, 409, 409, 409]);
    expect(await stockOf(product)).toBe(0);
    expect(await prisma.order.count()).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Tra cứu và hủy bằng mã đơn + số điện thoại
// ---------------------------------------------------------------------------
describe('POST /api/orders/lookup - tra cứu đơn của khách vãng lai', () => {
  it('đúng mã đơn và số điện thoại thì xem được đơn (gõ chữ thường vẫn được)', async () => {
    const product = await makeProduct();
    const placed = await guestOrder([{ productId: product.id, quantity: 1 }]);

    const res = await lookup(placed.body.code.toLowerCase());

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(placed.body.code);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.isGuest).toBe(true);
  });

  it('sai số điện thoại hoặc mã không tồn tại đều trả cùng một 404 (không lộ đơn có tồn tại)', async () => {
    const product = await makeProduct();
    const placed = await guestOrder([{ productId: product.id, quantity: 1 }]);

    const wrongPhone = await lookup(placed.body.code, '0900000000');
    const unknownCode = await lookup('TS261028-ABCD');

    expect(wrongPhone.status).toBe(404);
    expect(unknownCode.status).toBe(404);
    expect(wrongPhone.body.error).toEqual(unknownCode.body.error);
  });

  it('mã đơn hoặc số điện thoại sai định dạng thì 400', async () => {
    expect((await lookup('abc', '0987654321')).status).toBe(400);
    expect((await lookup('TS261028-ABCD', '123')).status).toBe(400);
    expect((await request(app).post('/api/orders/lookup').send({})).status).toBe(400);
  });

  it('đơn của thành viên KHÔNG tra được bằng mã + số điện thoại (được bảo vệ bằng đăng nhập)', async () => {
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct();
    const placed = await memberOrder(buyer, product);

    const res = await lookup(placed.code, shipping.phone);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/orders/lookup/cancel - khách vãng lai tự hủy đơn (BR-06, BR-07)', () => {
  it('hủy được đơn PENDING: hoàn kho, lưu lý do, ghi lịch sử không có người thực hiện', async () => {
    const product = await makeProduct({ stock: 5 });
    const placed = await guestOrder([{ productId: product.id, quantity: 2 }]);
    expect(await stockOf(product)).toBe(3);

    const res = await lookupCancel(placed.body.code, shipping.phone, 'Tôi muốn đổi mẫu khác');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancelReason).toBe('Tôi muốn đổi mẫu khác');
    expect(res.body.history.at(-1)).toMatchObject({
      status: 'CANCELLED',
      note: 'Khách hàng hủy đơn: Tôi muốn đổi mẫu khác',
    });
    expect(await stockOf(product)).toBe(5);
    const last = await prisma.orderStatusHistory.findFirst({
      where: { order: { code: placed.body.code } },
      orderBy: { id: 'desc' },
    });
    expect(last.changedById).toBeNull();
  });

  it('hủy hai lần thì lần hai bị từ chối và kho chỉ hoàn một lần', async () => {
    const product = await makeProduct({ stock: 5 });
    const placed = await guestOrder([{ productId: product.id, quantity: 2 }]);

    const results = await Promise.all([
      lookupCancel(placed.body.code),
      lookupCancel(placed.body.code),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 400]);
    expect(await stockOf(product)).toBe(5);
  });

  it('đơn đã được xác nhận thì khách không tự hủy được', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const product = await makeProduct({ stock: 5 });
    const placed = await guestOrder([{ productId: product.id, quantity: 1 }]);
    await advance(admin, placed.body.code, 'CONFIRMED');

    const res = await lookupCancel(placed.body.code);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect(res.body.error.message).toContain('liên hệ cửa hàng');
    expect(await stockOf(product)).toBe(4);
  });

  it('sai số điện thoại thì 404 và không động tới đơn', async () => {
    const product = await makeProduct({ stock: 5 });
    const placed = await guestOrder([{ productId: product.id, quantity: 1 }]);

    const res = await lookupCancel(placed.body.code, '0900000000');

    expect(res.status).toBe(404);
    expect((await lookup(placed.body.code)).body.status).toBe('PENDING');
    expect(await stockOf(product)).toBe(4);
  });

  it('bắt buộc có lý do từ 3 ký tự', async () => {
    const product = await makeProduct();
    const placed = await guestOrder([{ productId: product.id, quantity: 1 }]);

    expect((await lookupCancel(placed.body.code, shipping.phone, 'ab')).status).toBe(400);
    expect((await lookupCancel(placed.body.code, shipping.phone, '')).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Điểm thành viên (BR-15)
// ---------------------------------------------------------------------------
describe('Quy tắc tính điểm (BR-15)', () => {
  it('điểm theo tổng đã mua: mỗi 1.000.000 đ được 1 điểm, làm tròn xuống, không âm', () => {
    expect(POINT_UNIT_VND).toBe(1_000_000);
    expect(pointsForSpent(0)).toBe(0);
    expect(pointsForSpent(999_999)).toBe(0);
    expect(pointsForSpent(1_000_000)).toBe(1);
    expect(pointsForSpent(1_999_999)).toBe(1);
    expect(pointsForSpent(54_980_000)).toBe(54);
    expect(pointsForSpent(-5_000_000)).toBe(0);
  });

  it('điểm của một đơn là phần tăng thêm sau khi cộng đơn vào tổng đã mua (phần lẻ không mất)', () => {
    expect(calculatePoints(0, 999_999)).toBe(0);
    expect(calculatePoints(0, 1_000_000)).toBe(1);
    expect(calculatePoints(0, 2_350_000)).toBe(2);
    // Đơn 600.000 liên tiếp: điểm đầu tiên đến ở đơn thứ hai, rồi ở đơn thứ tư
    expect(calculatePoints(0, 600_000)).toBe(0);
    expect(calculatePoints(600_000, 600_000)).toBe(1);
    expect(calculatePoints(1_200_000, 600_000)).toBe(0);
    expect(calculatePoints(1_800_000, 600_000)).toBe(1);
    // Một đơn lớn vượt nhiều mốc cùng lúc
    expect(calculatePoints(900_000, 3_200_000)).toBe(4); // 4,1tr: từ 0 lên 4
    // Giá trị âm bị coi là 0
    expect(calculatePoints(-1, -1)).toBe(0);
  });

  it('tổng các điểm từng đơn luôn bằng điểm của tổng (không phụ thuộc cách chia đơn)', () => {
    const orders = [450_000, 1_250_000, 90_000, 2_800_000, 999_999, 1];
    let spent = 0;
    let sum = 0;
    for (const subtotal of orders) {
      sum += calculatePoints(spent, subtotal);
      spent += subtotal;
    }
    expect(sum).toBe(pointsForSpent(spent));
  });

  it('còn thiếu bao nhiêu để được điểm kế tiếp', () => {
    expect(amountToNextPoint(0)).toBe(1_000_000);
    expect(amountToNextPoint(1)).toBe(999_999);
    expect(amountToNextPoint(999_999)).toBe(1);
    expect(amountToNextPoint(1_000_000)).toBe(1_000_000);
    expect(amountToNextPoint(54_980_000)).toBe(20_000);
  });

  it('bản ở shared (hiển thị điểm dự kiến) giống hệt bản của backend (nơi quyết định)', async () => {
    const shared = await import('../../shared/src/points.js');
    const backend = await import('../src/lib/points.js');

    expect(shared.POINT_UNIT_VND).toBe(backend.POINT_UNIT_VND);
    for (const amount of [0, 9999, 999_999, 1_000_000, 1_500_000, 5_000_000, 54_980_000]) {
      expect(shared.pointsForSpent(amount)).toBe(backend.pointsForSpent(amount));
      expect(shared.amountToNextPoint(amount)).toBe(backend.amountToNextPoint(amount));
      for (const subtotal of [0, 1, 600_000, 1_000_000, 3_200_000]) {
        expect(shared.calculatePoints(amount, subtotal)).toBe(
          backend.calculatePoints(amount, subtotal),
        );
      }
    }
  });
});

describe('Cộng điểm thành viên khi đơn hoàn thành (BR-15)', () => {
  it('đơn của thành viên: hiện điểm dự kiến, hoàn thành thì cộng đúng điểm theo tiền hàng (không tính phí ship)', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct({ price: 1175000 });

    const placed = await memberOrder(buyer, product, 2); // tiền hàng 2.350.000, ship 30.000
    expect(placed).toMatchObject({ isGuest: false, pointsExpected: 2, pointsEarned: 0 });
    expect(await memberStats(buyer)).toEqual({ points: 0, totalSpent: 0 });

    await advance(admin, placed.code, 'CONFIRMED', 'SHIPPING');
    const done = await adminSetStatus(admin.token, placed.code, 'COMPLETED');

    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({
      paymentStatus: 'PAID',
      pointsEarned: 2,
      pointsExpected: 0,
    });
    // Tổng đã mua chỉ gồm tiền hàng, không gồm phí vận chuyển
    expect(await memberStats(buyer)).toEqual({ points: 2, totalSpent: 2_350_000 });
  });

  it('điểm cộng dồn qua nhiều đơn: phần lẻ của đơn trước không mất, hiện trong hồ sơ /users/me', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct({ price: 600000 });

    const earned = [];
    for (let i = 0; i < 4; i += 1) {
      const placed = await memberOrder(buyer, product, 1);
      await advance(admin, placed.code, 'CONFIRMED', 'SHIPPING', 'COMPLETED');
      earned.push((await prisma.order.findUnique({ where: { code: placed.code } })).pointsEarned);
    }

    // 600k, 1,2tr, 1,8tr, 2,4tr: điểm đến ở đơn thứ hai và thứ tư
    expect(earned).toEqual([0, 1, 0, 1]);
    const me = await request(app).get('/api/users/me').set(auth(buyer.token));
    expect(me.body).toMatchObject({ points: 2, totalSpent: 2_400_000 });
  });

  it('điểm dự kiến của đơn đang xử lý tính trên tổng đã mua hiện tại', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct({ price: 600000 });
    const first = await memberOrder(buyer, product, 1);
    expect(first.pointsExpected).toBe(0); // 600k chưa đủ 1 triệu
    await advance(admin, first.code, 'CONFIRMED', 'SHIPPING', 'COMPLETED');

    const second = await memberOrder(buyer, product, 1);

    expect(second.pointsExpected).toBe(1); // 600k đã mua + 600k = 1,2tr
    const viewed = await request(app).get(`/api/orders/${second.code}`).set(auth(buyer.token));
    expect(viewed.body.pointsExpected).toBe(1);
    const adminView = await request(app)
      .get(`/api/admin/orders/${second.code}`)
      .set(auth(admin.token));
    expect(adminView.body).toMatchObject({ pointsExpected: 1, customer: { points: 0 } });
  });

  it('đơn dưới 1.000.000 đ tiền hàng chưa có điểm nhưng vẫn được cộng vào tổng đã mua', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct({ price: 900000 });

    const placed = await memberOrder(buyer, product, 1);
    await advance(admin, placed.code, 'CONFIRMED', 'SHIPPING', 'COMPLETED');

    expect(await memberStats(buyer)).toEqual({ points: 0, totalSpent: 900_000 });
    expect((await prisma.order.findUnique({ where: { code: placed.code } })).pointsEarned).toBe(0);
  });

  it('hai đơn của cùng một người hoàn thành đồng thời không làm mất phần lẻ của nhau', async () => {
    const adminA = await signIn('admin-a@example.com', 'ADMIN');
    const adminB = await signIn('admin-b@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct({ price: 600000 });
    const one = await memberOrder(buyer, product, 1);
    const two = await memberOrder(buyer, product, 1);
    await advance(adminA, one.code, 'CONFIRMED', 'SHIPPING');
    await advance(adminA, two.code, 'CONFIRMED', 'SHIPPING');

    const results = await Promise.all([
      adminSetStatus(adminA.token, one.code, 'COMPLETED'),
      adminSetStatus(adminB.token, two.code, 'COMPLETED'),
    ]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    // 600k + 600k = 1,2tr: đúng một điểm cho cả hai đơn, dù ai về trước (nếu cả hai cùng đọc tổng cũ thì sẽ là 0)
    expect(await memberStats(buyer)).toEqual({ points: 1, totalSpent: 1_200_000 });
    const orders = await prisma.order.findMany({ where: { userId: buyer.user.id } });
    expect(orders.reduce((sum, order) => sum + order.pointsEarned, 0)).toBe(1);
  });

  it('đơn bị hủy thì không có điểm', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct();
    const placed = await memberOrder(buyer, product, 1);

    const cancelled = await adminSetStatus(
      admin.token,
      placed.code,
      'CANCELLED',
      'Hết hàng thực tế',
    );

    expect(cancelled.body).toMatchObject({ pointsEarned: 0, pointsExpected: 0 });
    expect(await memberStats(buyer)).toEqual({ points: 0, totalSpent: 0 });
  });

  it('đơn của khách vãng lai hoàn thành thì không cộng điểm cho ai', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const bystander = await signIn('khac@example.com');
    const product = await makeProduct({ price: 3000000 });
    const placed = await guestOrder([{ productId: product.id, quantity: 1 }]);

    await advance(admin, placed.body.code, 'CONFIRMED', 'SHIPPING', 'COMPLETED');

    const order = await prisma.order.findUnique({ where: { code: placed.body.code } });
    expect(order).toMatchObject({ status: 'COMPLETED', pointsEarned: 0, userId: null });
    const totals = await prisma.user.aggregate({ _sum: { points: true, totalSpent: true } });
    expect(totals._sum).toEqual({ points: 0, totalSpent: 0 });
    expect(await memberStats(bystander)).toEqual({ points: 0, totalSpent: 0 });
  });

  it('hai Admin cùng bấm Hoàn thành một lúc thì điểm chỉ được cộng một lần', async () => {
    const adminA = await signIn('admin-a@example.com', 'ADMIN');
    const adminB = await signIn('admin-b@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct({ price: 1000000 });
    const placed = await memberOrder(buyer, product, 1);
    await advance(adminA, placed.code, 'CONFIRMED', 'SHIPPING');

    const results = await Promise.all([
      adminSetStatus(adminA.token, placed.code, 'COMPLETED'),
      adminSetStatus(adminB.token, placed.code, 'COMPLETED'),
    ]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 400]);
    // Tổng đã mua cũng chỉ cộng một lần (không bị gấp đôi)
    expect(await memberStats(buyer)).toEqual({ points: 1, totalSpent: 1_000_000 });
  });
});

// ---------------------------------------------------------------------------
// Admin thấy và xử lý đơn của khách vãng lai
// ---------------------------------------------------------------------------
describe('Admin với đơn của khách vãng lai', () => {
  it('danh sách và chi tiết đánh dấu khách vãng lai, không có thông tin tài khoản', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn('khach@example.com');
    const product = await makeProduct();
    const guest = await guestOrder([{ productId: product.id, quantity: 1 }]);
    const member = await memberOrder(buyer, product, 1);

    const list = await request(app).get('/api/admin/orders').set(auth(admin.token));
    const byCode = Object.fromEntries(list.body.items.map((order) => [order.code, order]));

    expect(byCode[guest.body.code]).toMatchObject({ isGuest: true, recipientName: 'Trần Thị B' });
    expect(byCode[guest.body.code].customer).toBeUndefined();
    expect(byCode[member.code]).toMatchObject({ isGuest: false });
    expect(byCode[member.code].customer.email).toBe('khach@example.com');

    const detail = await request(app)
      .get(`/api/admin/orders/${guest.body.code}`)
      .set(auth(admin.token));
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ isGuest: true, customer: null });
    expect(detail.body.allowedNext).toEqual(['CONFIRMED', 'CANCELLED']);
  });

  it('tìm được đơn khách vãng lai theo số điện thoại hoặc tên người nhận', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const product = await makeProduct();
    const placed = await guestOrder([{ productId: product.id, quantity: 1 }]);

    const byPhone = await request(app)
      .get('/api/admin/orders?search=0987654321')
      .set(auth(admin.token));
    const byName = await request(app)
      .get(`/api/admin/orders?search=${encodeURIComponent('trần thị')}`)
      .set(auth(admin.token));

    expect(byPhone.body.items.map((order) => order.code)).toEqual([placed.body.code]);
    expect(byName.body.items.map((order) => order.code)).toEqual([placed.body.code]);
  });

  it('Admin hủy đơn khách vãng lai thì hoàn kho; xác nhận, giao rồi hoàn thành chạy bình thường', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const product = await makeProduct({ stock: 5 });
    const toCancel = await guestOrder([{ productId: product.id, quantity: 2 }]);
    const toComplete = await guestOrder([{ productId: product.id, quantity: 1 }]);
    expect(await stockOf(product)).toBe(2);

    const cancelled = await adminSetStatus(
      admin.token,
      toCancel.body.code,
      'CANCELLED',
      'Khách báo hủy qua điện thoại',
    );
    await advance(admin, toComplete.body.code, 'CONFIRMED', 'SHIPPING', 'COMPLETED');

    expect(cancelled.status).toBe(200);
    expect(await stockOf(product)).toBe(4);
    const done = await lookup(toComplete.body.code);
    expect(done.body).toMatchObject({ status: 'COMPLETED', paymentStatus: 'PAID' });
  });
});
