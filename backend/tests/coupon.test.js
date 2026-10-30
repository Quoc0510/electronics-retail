/**
 * @feature [F09] Mã giảm giá - Kiểm thử: cách tính số tiền giảm, API Admin tạo/sửa mã (US-24), xem trước mã (US-25) và dùng mã
 * khi đặt hàng của thành viên lẫn khách vãng lai (BR-14, BR-15). Chạy trên PostgreSQL thật để kiểm tra giữ chỗ lượt dùng
 * khi nhiều đơn cùng lúc, hoàn lượt khi hủy và hoàn tác khi đơn lỗi.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  calculateDiscount,
  couponProblem,
  couponState,
  eligibleLines,
  hasScope,
  linesSubtotal,
} from '../src/lib/coupon.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// ---------------------------------------------------------------------------
// Dữ liệu và hàm hỗ trợ
// ---------------------------------------------------------------------------
const HOUR = 3600 * 1000;
const auth = (token) => ({ Authorization: `Bearer ${token}` });

let counter = 0;
const makeProduct = async (overrides = {}) => {
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

// Mã đang dùng được: bắt đầu 1 giờ trước, hết hạn sau 1 ngày
const makeCoupon = (overrides = {}) =>
  prisma.coupon.create({
    data: {
      code: 'GIAM10',
      type: 'PERCENT',
      value: 10,
      minOrder: 0,
      startsAt: new Date(Date.now() - HOUR),
      endsAt: new Date(Date.now() + 24 * HOUR),
      maxUses: 100,
      ...overrides,
    },
  });

const signIn = async (email = 'khach@example.com', role = 'CUSTOMER') => {
  const user = await createUser({ email, role, fullName: `Người dùng ${email}` });
  const { accessToken } = await loginAs(request, app, email);
  return { user, token: accessToken };
};

const fillCart = async (userId, product, quantity = 1) => {
  const cart = await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });
  await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity } });
};

const memberOrder = (buyer, couponCode) =>
  request(app)
    .post('/api/orders')
    .set(auth(buyer.token))
    .send({ shipping, ...(couponCode === undefined ? {} : { couponCode }) });

const guestOrder = (items, extra = {}) =>
  request(app)
    .post('/api/orders/guest')
    .send({ items, shipping, requestId: randomUUID(), ...extra });

// Xem trước theo giỏ hàng: tạo một sản phẩm có giá đúng bằng `subtotal` rồi xem trước giỏ gồm đúng sản phẩm đó
const previewItems = (code, items, token) => {
  const req = request(app).post('/api/coupons/preview');
  if (token) req.set(auth(token));
  return req.send({ code, items });
};
const preview = async (code, subtotal, token) => {
  const product = await makeProduct({ price: subtotal });
  return previewItems(code, [{ productId: product.id, quantity: 1 }], token);
};
const couponRow = (code = 'GIAM10') => prisma.coupon.findUnique({ where: { code } });
const stockOf = async (product) =>
  (await prisma.product.findUnique({ where: { id: product.id } })).stock;

const completeOrder = async (admin, code) => {
  for (const status of ['CONFIRMED', 'SHIPPING', 'COMPLETED']) {
    const res = await request(app)
      .patch(`/api/admin/orders/${code}/status`)
      .set(auth(admin.token))
      .send({ status });
    expect(res.status).toBe(200);
  }
};

// ---------------------------------------------------------------------------
// Hàm thuần: số tiền giảm và trạng thái (US-25 AC3)
// ---------------------------------------------------------------------------
describe('calculateDiscount', () => {
  it('PERCENT làm tròn xuống đồng', () => {
    expect(calculateDiscount({ type: 'PERCENT', value: 10 }, 1_000_000)).toBe(100_000);
    expect(calculateDiscount({ type: 'PERCENT', value: 15 }, 999_999)).toBe(149_999);
    expect(calculateDiscount({ type: 'PERCENT', value: 1 }, 99)).toBe(0);
  });

  it('FIXED không vượt quá tiền hàng nên tổng sau giảm không âm', () => {
    expect(calculateDiscount({ type: 'FIXED', value: 200_000 }, 1_000_000)).toBe(200_000);
    expect(calculateDiscount({ type: 'FIXED', value: 500_000 }, 300_000)).toBe(300_000);
    expect(calculateDiscount({ type: 'PERCENT', value: 100 }, 300_000)).toBe(300_000);
  });

  it('tiền hàng bằng 0 hoặc âm thì không giảm', () => {
    expect(calculateDiscount({ type: 'FIXED', value: 50_000 }, 0)).toBe(0);
    expect(calculateDiscount({ type: 'PERCENT', value: 10 }, -5)).toBe(0);
  });
});

describe('couponProblem và couponState', () => {
  const now = new Date('2026-11-01T00:00:00Z');
  const base = {
    isActive: true,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: new Date('2026-12-01T00:00:00Z'),
    maxUses: 5,
    usedCount: 0,
  };

  it('báo đúng lý do theo thứ tự cố định', () => {
    expect(couponProblem(base, now)).toBeNull();
    expect(couponProblem({ ...base, isActive: false }, now)).toBe('COUPON_INACTIVE');
    expect(couponProblem({ ...base, startsAt: new Date('2026-11-02T00:00:00Z') }, now)).toBe(
      'COUPON_NOT_STARTED',
    );
    expect(couponProblem({ ...base, endsAt: new Date('2026-10-31T00:00:00Z') }, now)).toBe(
      'COUPON_EXPIRED',
    );
    expect(couponProblem({ ...base, usedCount: 5 }, now)).toBe('COUPON_EXHAUSTED');
    // Vừa tắt vừa hết hạn: lý do "tắt" được báo trước
    expect(couponProblem({ ...base, isActive: false, usedCount: 5 }, now)).toBe('COUPON_INACTIVE');
  });

  it('thời điểm kết thúc là mốc loại trừ, thời điểm bắt đầu là mốc bao gồm', () => {
    expect(couponProblem({ ...base, endsAt: now }, now)).toBe('COUPON_EXPIRED');
    expect(couponProblem({ ...base, startsAt: now }, now)).toBeNull();
  });

  it('couponState quy về năm trạng thái hiển thị', () => {
    expect(couponState(base, now)).toBe('RUNNING');
    expect(couponState({ ...base, isActive: false }, now)).toBe('DISABLED');
    expect(couponState({ ...base, startsAt: new Date('2026-11-02T00:00:00Z') }, now)).toBe(
      'UPCOMING',
    );
    expect(couponState({ ...base, endsAt: new Date('2026-10-31T00:00:00Z') }, now)).toBe('EXPIRED');
    expect(couponState({ ...base, usedCount: 5 }, now)).toBe('EXHAUSTED');
  });
});

// ---------------------------------------------------------------------------
// Admin: tạo và sửa mã (US-24)
// ---------------------------------------------------------------------------
describe('API Admin /api/admin/coupons (US-24)', () => {
  const body = (overrides = {}) => ({
    code: 'KM2026',
    type: 'PERCENT',
    value: 10,
    minOrder: 500_000,
    startsAt: new Date(Date.now() - HOUR).toISOString(),
    endsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
    maxUses: 50,
    ...overrides,
  });
  const create = (token, overrides) =>
    request(app).post('/api/admin/coupons').set(auth(token)).send(body(overrides));

  it('chỉ ADMIN dùng được: khách 403, chưa đăng nhập 401', async () => {
    const customer = await signIn();
    expect((await request(app).get('/api/admin/coupons')).status).toBe(401);
    expect((await request(app).get('/api/admin/coupons').set(auth(customer.token))).status).toBe(
      403,
    );
    expect((await create(customer.token)).status).toBe(403);
  });

  it('tạo mã: lưu in hoa, bật mặc định, chưa dùng lượt nào (AC1, AC2)', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const res = await create(admin.token, { code: ' km2026 ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 'KM2026',
      type: 'PERCENT',
      value: 10,
      minOrder: 500_000,
      maxUses: 50,
      usedCount: 0,
      isActive: true,
      state: 'RUNNING',
    });
    expect((await couponRow('KM2026')).code).toBe('KM2026');
  });

  it('mã trùng (kể cả khác hoa thường) trả 409 COUPON_EXISTS', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    expect((await create(admin.token)).status).toBe(201);
    const dup = await create(admin.token, { code: 'km2026' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('COUPON_EXISTS');
  });

  it.each([
    ['mã quá ngắn', { code: 'AB' }],
    ['mã có ký tự lạ', { code: 'GIAM 10!' }],
    ['loại sai', { type: 'GIFT' }],
    ['mức giảm 0', { value: 0 }],
    ['mức giảm lẻ', { value: 10.5 }],
    ['phần trăm quá 100', { type: 'PERCENT', value: 101 }],
    ['đơn tối thiểu âm', { minOrder: -1 }],
    ['kết thúc trước bắt đầu', { endsAt: new Date(Date.now() - 2 * HOUR).toISOString() }],
    ['ngày không hợp lệ', { startsAt: 'hôm qua' }],
    ['lượt tối đa 0', { maxUses: 0 }],
    ['lượt tối đa là chuỗi', { maxUses: '50' }],
  ])('từ chối dữ liệu sai: %s', async (_label, overrides) => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const res = await create(admin.token, overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.coupon.count()).toBe(0);
  });

  it('FIXED được phép lớn hơn 100 (là số tiền)', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const res = await create(admin.token, { type: 'FIXED', value: 200_000 });
    expect(res.status).toBe(201);
  });

  it('danh sách có trạng thái hiển thị, tìm theo mã, lọc bật/tắt, phân trang', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    await makeCoupon({ code: 'DANGCHAY' });
    await makeCoupon({ code: 'DATAT', isActive: false });
    await makeCoupon({
      code: 'HETHAN',
      startsAt: new Date(Date.now() - 48 * HOUR),
      endsAt: new Date(Date.now() - 24 * HOUR),
    });
    await makeCoupon({ code: 'HETLUOT', maxUses: 1, usedCount: 1 });
    await makeCoupon({
      code: 'SAPTOI',
      startsAt: new Date(Date.now() + 24 * HOUR),
      endsAt: new Date(Date.now() + 48 * HOUR),
    });

    const all = await request(app).get('/api/admin/coupons').set(auth(admin.token));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(5);
    const states = Object.fromEntries(all.body.items.map((item) => [item.code, item.state]));
    expect(states).toEqual({
      DANGCHAY: 'RUNNING',
      DATAT: 'DISABLED',
      HETHAN: 'EXPIRED',
      HETLUOT: 'EXHAUSTED',
      SAPTOI: 'UPCOMING',
    });

    const search = await request(app).get('/api/admin/coupons?search=het').set(auth(admin.token));
    expect(search.body.items.map((item) => item.code).sort()).toEqual(['HETHAN', 'HETLUOT']);

    const off = await request(app).get('/api/admin/coupons?status=off').set(auth(admin.token));
    expect(off.body.items.map((item) => item.code)).toEqual(['DATAT']);

    const page = await request(app)
      .get('/api/admin/coupons?pageSize=2&page=3')
      .set(auth(admin.token));
    expect(page.body.items).toHaveLength(1);
    expect(page.body.total).toBe(5);
  });

  it('tìm kiếm coi "%" và "_" là ký tự thường, không phải ký tự đại diện', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    await makeCoupon({ code: 'ABC' });
    const res = await request(app).get('/api/admin/coupons?search=%25').set(auth(admin.token));
    expect(res.body.total).toBe(0);
  });

  it('sửa từng phần: tắt mã, đổi mức giảm; không đổi được mã', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const coupon = await makeCoupon();
    const patch = (data) =>
      request(app).patch(`/api/admin/coupons/${coupon.id}`).set(auth(admin.token)).send(data);

    const off = await patch({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body).toMatchObject({ isActive: false, state: 'DISABLED', value: 10 });

    const changed = await patch({ type: 'FIXED', value: 150_000, minOrder: 1_000_000 });
    expect(changed.body).toMatchObject({ type: 'FIXED', value: 150_000, minOrder: 1_000_000 });

    const rename = await patch({ code: 'KHAC' });
    expect(rename.status).toBe(400);
    expect((await couponRow()).code).toBe('GIAM10');

    expect((await patch({})).status).toBe(400);
  });

  it('kiểm tra bộ giá trị sau khi sửa: đổi sang PERCENT mà mức giảm đang là số tiền', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const coupon = await makeCoupon({ type: 'FIXED', value: 200_000 });
    const res = await request(app)
      .patch(`/api/admin/coupons/${coupon.id}`)
      .set(auth(admin.token))
      .send({ type: 'PERCENT' });
    expect(res.status).toBe(400);
    expect((await couponRow()).type).toBe('FIXED');
  });

  it('không cho kết thúc trước bắt đầu khi chỉ sửa một đầu', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const coupon = await makeCoupon();
    const res = await request(app)
      .patch(`/api/admin/coupons/${coupon.id}`)
      .set(auth(admin.token))
      .send({ endsAt: new Date(Date.now() - 5 * HOUR).toISOString() });
    expect(res.status).toBe(400);
  });

  it('không cho đặt lượt tối đa thấp hơn số lượt đã dùng', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const coupon = await makeCoupon({ maxUses: 10, usedCount: 4 });
    const patch = (maxUses) =>
      request(app)
        .patch(`/api/admin/coupons/${coupon.id}`)
        .set(auth(admin.token))
        .send({ maxUses });

    const low = await patch(3);
    expect(low.status).toBe(409);
    expect(low.body.error.code).toBe('COUPON_MAX_USES_TOO_LOW');
    expect((await patch(4)).status).toBe(200); // bằng đúng số đã dùng thì được
    expect((await couponRow()).maxUses).toBe(4);
  });

  it('sửa mã không tồn tại trả 404; id sai định dạng trả 400', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const missing = await request(app)
      .patch('/api/admin/coupons/9999')
      .set(auth(admin.token))
      .send({ isActive: false });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('COUPON_NOT_FOUND');
    const bad = await request(app)
      .patch('/api/admin/coupons/abc')
      .set(auth(admin.token))
      .send({ isActive: false });
    expect(bad.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Khách xem trước mã (US-25 AC1, AC2)
// ---------------------------------------------------------------------------
describe('POST /api/coupons/preview (US-25)', () => {
  it('công khai: khách chưa đăng nhập thấy ngay số tiền giảm (AC1)', async () => {
    await makeCoupon();
    const res = await preview('GIAM10', 2_000_000);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      code: 'GIAM10',
      type: 'PERCENT',
      value: 10,
      minOrder: 0,
      minPoints: 0,
      scoped: false,
      eligibleSubtotal: 2_000_000,
      discount: 200_000,
    });
  });

  it('không phân biệt hoa thường và khoảng trắng', async () => {
    await makeCoupon();
    const res = await preview('  giam10 ', 1_000_000);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe('GIAM10');
  });

  it('mã cố định không vượt quá tiền hàng (AC3)', async () => {
    await makeCoupon({ type: 'FIXED', value: 500_000 });
    const res = await preview('GIAM10', 300_000);
    expect(res.body.discount).toBe(300_000);
  });

  it('mã không tồn tại trả 404 COUPON_NOT_FOUND', async () => {
    const res = await preview('KHONGCO', 1_000_000);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
  });

  it.each([
    ['đã tắt', { isActive: false }, 'COUPON_INACTIVE'],
    [
      'chưa đến hạn',
      { startsAt: new Date(Date.now() + HOUR), endsAt: new Date(Date.now() + 2 * HOUR) },
      'COUPON_NOT_STARTED',
    ],
    [
      'hết hạn',
      { startsAt: new Date(Date.now() - 2 * HOUR), endsAt: new Date(Date.now() - HOUR) },
      'COUPON_EXPIRED',
    ],
    ['hết lượt', { maxUses: 3, usedCount: 3 }, 'COUPON_EXHAUSTED'],
  ])('báo đúng lý do khi mã %s (AC2)', async (_label, overrides, expectedCode) => {
    await makeCoupon(overrides);
    const res = await preview('GIAM10', 1_000_000);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(expectedCode);
  });

  it('chưa đủ đơn tối thiểu: báo số tiền cần đạt (AC2)', async () => {
    await makeCoupon({ minOrder: 2_000_000 });
    const res = await preview('GIAM10', 1_999_999);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_MIN_ORDER');
    expect(res.body.error.details).toEqual({ minOrder: 2_000_000, scoped: false });
    expect(res.body.error.message).toContain('2.000.000');
    expect((await preview('GIAM10', 2_000_000)).status).toBe(200); // đúng mức tối thiểu thì được
  });

  it('xem trước không tiêu hao lượt dùng', async () => {
    await makeCoupon({ maxUses: 1 });
    await preview('GIAM10', 1_000_000);
    await preview('GIAM10', 1_000_000);
    expect((await couponRow()).usedCount).toBe(0);
  });

  it.each([
    ['thiếu mã', { items: [{ productId: 1, quantity: 1 }] }],
    ['mã sai định dạng', { code: 'a b', items: [{ productId: 1, quantity: 1 }] }],
    ['thiếu giỏ hàng', { code: 'GIAM10' }],
    ['giỏ hàng trống', { code: 'GIAM10', items: [] }],
    ['số lượng bằng 0', { code: 'GIAM10', items: [{ productId: 1, quantity: 0 }] }],
    ['mã sản phẩm là chuỗi', { code: 'GIAM10', items: [{ productId: '1', quantity: 1 }] }],
    ['gửi tiền hàng thay vì giỏ', { code: 'GIAM10', subtotal: 1000 }],
  ])('từ chối dữ liệu sai: %s', async (_label, payload) => {
    const res = await request(app).post('/api/coupons/preview').send(payload);
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Dùng mã khi đặt hàng (BR-14, US-25 AC3, AC4)
// ---------------------------------------------------------------------------
describe('Đặt hàng của thành viên có mã giảm giá', () => {
  it('giảm tiền hàng, lưu bản sao mã và tăng lượt dùng (BR-14, BR-04)', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 2_000_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon();

    const res = await memberOrder(buyer, 'giam10');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      subtotal: 2_000_000,
      discount: 200_000,
      couponCode: 'GIAM10',
      shippingFee: 30_000,
      total: 1_830_000,
    });
    expect((await couponRow()).usedCount).toBe(1);

    // Xem lại đơn vẫn thấy mã và số tiền giảm
    const again = await request(app).get(`/api/orders/${res.body.code}`).set(auth(buyer.token));
    expect(again.body).toMatchObject({ discount: 200_000, couponCode: 'GIAM10', total: 1_830_000 });
  });

  it('đơn không dùng mã có discount 0 và couponCode null; chuỗi rỗng coi như không dùng mã', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 1_000_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon();

    const res = await memberOrder(buyer, '');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ discount: 0, couponCode: null, total: 1_030_000 });
    expect((await couponRow()).usedCount).toBe(0);
  });

  it('miễn phí vận chuyển xét trên tiền hàng SAU giảm (BR-05, BR-14)', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 5_200_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon({ type: 'FIXED', value: 500_000 });

    const res = await memberOrder(buyer, 'GIAM10');
    // 5.200.000 - 500.000 = 4.700.000 < 5.000.000 nên phải trả phí ship
    expect(res.body).toMatchObject({ discount: 500_000, shippingFee: 30_000, total: 4_730_000 });
  });

  it('vẫn miễn phí vận chuyển nếu sau giảm còn đạt ngưỡng', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 6_000_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon({ type: 'FIXED', value: 500_000 });

    const res = await memberOrder(buyer, 'GIAM10');
    expect(res.body).toMatchObject({ shippingFee: 0, total: 5_500_000 });
  });

  it('mã giảm hết tiền hàng: tổng chỉ còn phí vận chuyển, không âm (AC3)', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 300_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon({ type: 'FIXED', value: 1_000_000 });

    const res = await memberOrder(buyer, 'GIAM10');
    expect(res.body).toMatchObject({ discount: 300_000, shippingFee: 30_000, total: 30_000 });
  });

  it('số tiền giảm do máy chủ tính từ giỏ thật, không tin con số khách xem trước', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 1_000_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon();
    // Khách "xem trước" với tiền hàng lớn hơn thực tế rồi vẫn đặt với giỏ nhỏ
    expect((await preview('GIAM10', 100_000_000)).body.discount).toBe(10_000_000);
    const res = await memberOrder(buyer, 'GIAM10');
    expect(res.body.discount).toBe(100_000);
  });

  it.each([
    ['mã không tồn tại', null, 'KHONGCO', 404, 'COUPON_NOT_FOUND'],
    ['mã đã tắt', { isActive: false }, 'GIAM10', 400, 'COUPON_INACTIVE'],
    [
      'mã hết hạn',
      { startsAt: new Date(Date.now() - 2 * HOUR), endsAt: new Date(Date.now() - HOUR) },
      'GIAM10',
      400,
      'COUPON_EXPIRED',
    ],
    ['mã hết lượt', { maxUses: 2, usedCount: 2 }, 'GIAM10', 400, 'COUPON_EXHAUSTED'],
    ['chưa đủ đơn tối thiểu', { minOrder: 5_000_000 }, 'GIAM10', 400, 'COUPON_MIN_ORDER'],
  ])(
    'từ chối khi %s và không tạo đơn, không trừ kho, không giữ giỏ',
    async (_label, overrides, code, status, errorCode) => {
      const buyer = await signIn();
      const product = await makeProduct({ price: 1_000_000, stock: 5 });
      await fillCart(buyer.user.id, product, 2);
      if (overrides) await makeCoupon(overrides);

      const res = await memberOrder(buyer, code);
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(errorCode);
      expect(await prisma.order.count()).toBe(0);
      expect(await stockOf(product)).toBe(5);
      expect(await prisma.cartItem.count()).toBe(1); // giỏ còn nguyên để khách sửa mã rồi đặt lại
      if (overrides) expect((await couponRow()).usedCount).toBe(overrides.usedCount ?? 0);
    },
  );

  it('đơn lỗi vì hết hàng thì lượt dùng mã được hoàn lại cùng transaction', async () => {
    const buyer = await signIn();
    const ok = await makeProduct({ price: 1_000_000, stock: 5 });
    const soldOut = await makeProduct({ price: 1_000_000, stock: 0 });
    await fillCart(buyer.user.id, ok);
    await fillCart(buyer.user.id, soldOut);
    await makeCoupon({ maxUses: 5 });

    const res = await memberOrder(buyer, 'GIAM10');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CART_NOT_PURCHASABLE');
    expect((await couponRow()).usedCount).toBe(0);
  });

  it('mã định dạng sai trả 400 từ lớp kiểm tra dữ liệu', async () => {
    const buyer = await signIn();
    await fillCart(buyer.user.id, await makeProduct());
    const res = await memberOrder(buyer, 'a b');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('hai thành viên tranh lượt cuối: chỉ một đơn được dùng mã, đơn kia bị từ chối và hoàn tác', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct({ price: 1_000_000, stock: 10 });
    await fillCart(a.user.id, product);
    await fillCart(b.user.id, product);
    await makeCoupon({ maxUses: 1 });

    const results = await Promise.all([memberOrder(a, 'GIAM10'), memberOrder(b, 'GIAM10')]);
    const statuses = results.map((res) => res.status).sort();
    expect(statuses).toEqual([201, 400]);
    expect(results.find((res) => res.status === 400).body.error.code).toBe('COUPON_EXHAUSTED');
    expect((await couponRow()).usedCount).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(product)).toBe(9); // đơn thua đã hoàn kho
  });

  it('nhiều đơn cùng dùng một mã không bao giờ vượt số lượt tối đa', async () => {
    const product = await makeProduct({ price: 1_000_000, stock: 50 });
    const buyers = [];
    for (let i = 0; i < 6; i += 1) {
      const buyer = await signIn(`nguoi${i}@example.com`);
      await fillCart(buyer.user.id, product);
      buyers.push(buyer);
    }
    await makeCoupon({ maxUses: 3 });

    const results = await Promise.all(buyers.map((buyer) => memberOrder(buyer, 'GIAM10')));
    expect(results.filter((res) => res.status === 201)).toHaveLength(3);
    expect((await couponRow()).usedCount).toBe(3);
    expect(await prisma.order.count({ where: { couponCode: 'GIAM10' } })).toBe(3);
  });
});

describe('Hủy đơn trả lại lượt dùng mã (BR-14)', () => {
  it('khách hủy đơn PENDING thì lượt dùng được trả lại, mã dùng lại được', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 1_000_000 });
    await makeCoupon({ maxUses: 1 });

    await fillCart(buyer.user.id, product);
    const first = await memberOrder(buyer, 'GIAM10');
    expect((await couponRow()).usedCount).toBe(1);

    await fillCart(buyer.user.id, product);
    const blocked = await memberOrder(buyer, 'GIAM10');
    expect(blocked.body.error.code).toBe('COUPON_EXHAUSTED');
    await prisma.cartItem.deleteMany(); // bỏ giỏ của lần thử bị từ chối

    const cancel = await request(app)
      .post(`/api/orders/${first.body.code}/cancel`)
      .set(auth(buyer.token))
      .send({ reason: 'Đổi ý không mua nữa' });
    expect(cancel.status).toBe(200);
    expect((await couponRow()).usedCount).toBe(0);

    await fillCart(buyer.user.id, product);
    expect((await memberOrder(buyer, 'GIAM10')).status).toBe(201);
  });

  it('Admin hủy đơn cũng trả lượt; hủy đơn không dùng mã không đụng tới mã nào', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn();
    const product = await makeProduct({ price: 1_000_000 });
    await makeCoupon({ usedCount: 0 });

    await fillCart(buyer.user.id, product);
    const withCoupon = await memberOrder(buyer, 'GIAM10');
    await fillCart(buyer.user.id, product);
    const plain = await memberOrder(buyer);
    expect((await couponRow()).usedCount).toBe(1);

    const cancel = (code) =>
      request(app)
        .patch(`/api/admin/orders/${code}/status`)
        .set(auth(admin.token))
        .send({ status: 'CANCELLED', note: 'Hết hàng thật' });

    expect((await cancel(plain.body.code)).status).toBe(200);
    expect((await couponRow()).usedCount).toBe(1);
    expect((await cancel(withCoupon.body.code)).status).toBe(200);
    expect((await couponRow()).usedCount).toBe(0);
    // Hủy lần hai bị từ chối nên không trả lượt lần hai (không âm, không lệch)
    expect((await cancel(withCoupon.body.code)).status).toBe(400);
    expect((await couponRow()).usedCount).toBe(0);
  });
});

describe('Điểm thành viên tính trên tiền hàng sau giảm (BR-15, BR-14)', () => {
  it('đơn hoàn thành cộng tiền hàng sau giảm vào tổng đã mua và tính điểm theo đó', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn();
    const product = await makeProduct({ price: 2_000_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon({ type: 'FIXED', value: 600_000 });

    const order = await memberOrder(buyer, 'GIAM10');
    // Đang xử lý: điểm dự kiến theo (2.000.000 - 600.000) / 1.000.000 = 1 điểm, không phải 2
    expect(order.body.pointsExpected).toBe(1);

    await completeOrder(admin, order.body.code);
    const user = await prisma.user.findUnique({ where: { id: buyer.user.id } });
    expect(user.totalSpent).toBe(1_400_000);
    expect(user.points).toBe(1);
    const done = await request(app).get(`/api/orders/${order.body.code}`).set(auth(buyer.token));
    expect(done.body).toMatchObject({ pointsEarned: 1, discount: 600_000 });
  });

  it('đơn có mã giảm sâu có thể không được điểm nào dù tiền hàng gốc đủ 1 triệu', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn();
    const product = await makeProduct({ price: 1_000_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon({ type: 'PERCENT', value: 20 });

    const order = await memberOrder(buyer, 'GIAM10');
    await completeOrder(admin, order.body.code);
    const user = await prisma.user.findUnique({ where: { id: buyer.user.id } });
    expect(user).toMatchObject({ totalSpent: 800_000, points: 0 });
  });
});

describe('Khách vãng lai dùng mã giảm giá (BR-11, BR-14)', () => {
  it('đặt hàng không đăng nhập vẫn dùng được mã và nhận đúng số tiền giảm', async () => {
    const product = await makeProduct({ price: 3_000_000, stock: 10 });
    await makeCoupon({ minOrder: 1_000_000 });

    const res = await guestOrder([{ productId: product.id, quantity: 1 }], {
      couponCode: 'giam10',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      isGuest: true,
      subtotal: 3_000_000,
      discount: 300_000,
      couponCode: 'GIAM10',
      total: 2_730_000,
    });
    expect((await couponRow()).usedCount).toBe(1);
  });

  it('gửi lại cùng requestId chỉ trả đơn cũ, không dùng thêm lượt', async () => {
    const product = await makeProduct({ price: 1_000_000 });
    await makeCoupon({ maxUses: 5 });
    const requestId = randomUUID();
    const send = () =>
      request(app)
        .post('/api/orders/guest')
        .send({
          items: [{ productId: product.id, quantity: 1 }],
          shipping,
          requestId,
          couponCode: 'GIAM10',
        });

    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.body.code).toBe(first.body.code);
    expect((await couponRow()).usedCount).toBe(1);
  });

  it('hai request song song cùng requestId: một đơn và đúng một lượt dùng', async () => {
    const product = await makeProduct({ price: 1_000_000 });
    await makeCoupon({ maxUses: 5 });
    const requestId = randomUUID();
    const send = () =>
      request(app)
        .post('/api/orders/guest')
        .send({
          items: [{ productId: product.id, quantity: 1 }],
          shipping,
          requestId,
          couponCode: 'GIAM10',
        });

    const results = await Promise.all([send(), send()]);
    expect(results.every((res) => res.status === 201)).toBe(true);
    expect(await prisma.order.count()).toBe(1);
    expect((await couponRow()).usedCount).toBe(1);
  });

  it('mã sai thì không tạo đơn và không trừ kho', async () => {
    const product = await makeProduct({ price: 1_000_000, stock: 4 });
    const res = await guestOrder([{ productId: product.id, quantity: 2 }], { couponCode: 'SAIMA' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('COUPON_NOT_FOUND');
    expect(await prisma.order.count()).toBe(0);
    expect(await stockOf(product)).toBe(4);
  });

  it('khách tự hủy đơn bằng mã đơn + số điện thoại thì trả lại lượt dùng', async () => {
    const product = await makeProduct({ price: 1_000_000 });
    await makeCoupon({ maxUses: 1 });
    const order = await guestOrder([{ productId: product.id, quantity: 1 }], {
      couponCode: 'GIAM10',
    });
    expect((await couponRow()).usedCount).toBe(1);

    const cancel = await request(app)
      .post('/api/orders/lookup/cancel')
      .send({ code: order.body.code, phone: shipping.phone, reason: 'Đặt nhầm sản phẩm' });
    expect(cancel.status).toBe(200);
    expect((await couponRow()).usedCount).toBe(0);
  });
});

describe('Admin xem đơn có mã giảm giá', () => {
  it('chi tiết đơn của Admin hiện mã và số tiền giảm', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const buyer = await signIn();
    const product = await makeProduct({ price: 1_000_000 });
    await fillCart(buyer.user.id, product);
    await makeCoupon();
    const order = await memberOrder(buyer, 'GIAM10');

    const res = await request(app)
      .get(`/api/admin/orders/${order.body.code}`)
      .set(auth(admin.token));
    expect(res.body).toMatchObject({ couponCode: 'GIAM10', discount: 100_000, total: 930_000 });
  });
});

describe('Ràng buộc của cơ sở dữ liệu (chốt chặn cuối)', () => {
  it('CSDL từ chối mã chữ thường, phần trăm quá 100, lượt dùng vượt tối đa và đơn giảm quá tiền hàng', async () => {
    await expect(makeCoupon({ code: 'chuthuong' })).rejects.toThrow();
    await expect(makeCoupon({ code: 'PHANTRAM', type: 'PERCENT', value: 101 })).rejects.toThrow();
    await expect(makeCoupon({ code: 'VUOTLUOT', maxUses: 2, usedCount: 3 })).rejects.toThrow();
    await expect(
      makeCoupon({ code: 'NGUOC', startsAt: new Date(Date.now() + HOUR), endsAt: new Date() }),
    ).rejects.toThrow();

    const buyer = await signIn();
    await expect(
      prisma.order.create({
        data: {
          code: 'TS261030-ZZZZ',
          userId: buyer.user.id,
          subtotal: 100_000,
          discount: 100_001,
          shippingFee: 0,
          total: 0,
          recipientName: 'A',
          phone: '0900000000',
          shippingAddress: 'B',
        },
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Điều kiện phụ: điểm thành viên tối thiểu và phạm vi áp dụng (BR-14)
// ---------------------------------------------------------------------------
// Hai nhóm hàng để thử phạm vi: điện thoại (hãng A) và phụ kiện (hãng B)
const makeShelf = async () => {
  const phones = await prisma.category.create({
    data: { name: 'Điện thoại X', slug: 'dien-thoai-x' },
  });
  const accessories = await prisma.category.create({
    data: { name: 'Phụ kiện X', slug: 'phu-kien-x' },
  });
  const brandA = await prisma.brand.create({ data: { name: 'Hãng A X', slug: 'hang-a-x' } });
  const brandB = await prisma.brand.create({ data: { name: 'Hãng B X', slug: 'hang-b-x' } });
  const phone = await makeProduct({ price: 10_000_000, categoryId: phones.id, brandId: brandA.id });
  const charger = await makeProduct({
    price: 500_000,
    categoryId: accessories.id,
    brandId: brandB.id,
  });
  const cable = await makeProduct({
    price: 200_000,
    categoryId: accessories.id,
    brandId: brandA.id,
  });
  return { phones, accessories, brandA, brandB, phone, charger, cable };
};
const cartOf = (...products) => products.map((product) => ({ productId: product.id, quantity: 1 }));

describe('Phạm vi áp dụng của mã (lib)', () => {
  const line = (productId, categoryId, brandId, unitPrice, quantity = 1) => ({
    productId,
    categoryId,
    brandId,
    unitPrice,
    quantity,
  });
  const lines = [
    line(1, 10, 20, 1_000_000, 2),
    line(2, 11, 21, 300_000),
    line(3, 11, 20, 50_000, 3),
  ];
  const scopeOf = (scope) => ({ productIds: [], categoryIds: [], brandIds: [], ...scope });

  it('không chọn phạm vi thì mọi dòng đều được áp dụng', () => {
    expect(hasScope(scopeOf({}))).toBe(false);
    expect(eligibleLines(scopeOf({}), lines)).toHaveLength(3);
    expect(linesSubtotal(lines)).toBe(2_450_000);
  });

  it('phạm vi là HỢP của ba danh sách: khớp sản phẩm, hoặc danh mục, hoặc thương hiệu', () => {
    const ids = (scope) => eligibleLines(scopeOf(scope), lines).map((l) => l.productId);
    expect(ids({ productIds: [2] })).toEqual([2]);
    expect(ids({ categoryIds: [11] })).toEqual([2, 3]);
    expect(ids({ brandIds: [20] })).toEqual([1, 3]);
    expect(ids({ productIds: [2], brandIds: [20] })).toEqual([1, 2, 3]);
    expect(ids({ productIds: [1], categoryIds: [11] })).toEqual([1, 2, 3]);
  });

  it('danh sách còn id đã xóa thì chỉ không khớp ai, không biến thành áp dụng tất cả', () => {
    expect(hasScope(scopeOf({ productIds: [999] }))).toBe(true);
    expect(eligibleLines(scopeOf({ productIds: [999] }), lines)).toEqual([]);
  });
});

describe('Admin tạo và sửa điều kiện phụ (US-24)', () => {
  const create = (token, overrides) =>
    request(app)
      .post('/api/admin/coupons')
      .set(auth(token))
      .send({
        code: 'PHAMVI',
        type: 'PERCENT',
        value: 10,
        startsAt: new Date(Date.now() - HOUR).toISOString(),
        endsAt: new Date(Date.now() + 24 * HOUR).toISOString(),
        maxUses: 10,
        ...overrides,
      });

  it('mặc định không có điều kiện phụ: điểm tối thiểu 0 và áp dụng cho mọi sản phẩm', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const res = await create(admin.token);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      minPoints: 0,
      scoped: false,
      scope: { products: [], categories: [], brands: [] },
    });
  });

  it('tạo mã có điểm tối thiểu và phạm vi: trả về tên để Admin đọc được', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const shelf = await makeShelf();
    const res = await create(admin.token, {
      minPoints: 50,
      productIds: [shelf.phone.id],
      categoryIds: [shelf.accessories.id],
      brandIds: [shelf.brandB.id],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ minPoints: 50, scoped: true });
    expect(res.body.scope.products).toEqual([{ id: shelf.phone.id, name: shelf.phone.name }]);
    expect(res.body.scope.categories).toEqual([{ id: shelf.accessories.id, name: 'Phụ kiện X' }]);
    expect(res.body.scope.brands).toEqual([{ id: shelf.brandB.id, name: 'Hãng B X' }]);
    const row = await couponRow('PHAMVI');
    expect(row).toMatchObject({ minPoints: 50, productIds: [shelf.phone.id] });
  });

  it('bỏ trùng id trong danh sách', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const shelf = await makeShelf();
    const res = await create(admin.token, {
      productIds: [shelf.phone.id, shelf.phone.id, shelf.charger.id, shelf.phone.id],
    });
    expect(res.status).toBe(201);
    expect(res.body.scope.products.map((p) => p.id)).toEqual([shelf.phone.id, shelf.charger.id]);
  });

  it.each([
    ['sản phẩm không tồn tại', { productIds: [987654] }, 'productIds'],
    ['danh mục không tồn tại', { categoryIds: [987654] }, 'categoryIds'],
    ['thương hiệu không tồn tại', { brandIds: [987654] }, 'brandIds'],
  ])('từ chối khi %s, chỉ rõ trường lỗi', async (_label, overrides, field) => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const res = await create(admin.token, overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.details[field]).toBeDefined();
    expect(await prisma.coupon.count()).toBe(0);
  });

  it.each([
    ['điểm tối thiểu âm', { minPoints: -1 }],
    ['điểm tối thiểu lẻ', { minPoints: 1.5 }],
    ['điểm tối thiểu là chuỗi', { minPoints: '50' }],
    ['id sản phẩm âm', { productIds: [-1] }],
    ['id sản phẩm là chuỗi', { productIds: ['1'] }],
    ['danh sách không phải mảng', { categoryIds: 3 }],
    ['quá 50 thương hiệu', { brandIds: Array.from({ length: 51 }, (_, i) => i + 1) }],
  ])('từ chối dữ liệu sai: %s', async (_label, overrides) => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const res = await create(admin.token, overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sửa phạm vi: thay cả danh sách; gửi mảng rỗng thì bỏ phạm vi (áp dụng mọi sản phẩm)', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const shelf = await makeShelf();
    const coupon = await makeCoupon({ productIds: [shelf.phone.id] });
    const patch = (data) =>
      request(app).patch(`/api/admin/coupons/${coupon.id}`).set(auth(admin.token)).send(data);

    const changed = await patch({ productIds: [shelf.charger.id], minPoints: 30 });
    expect(changed.status).toBe(200);
    expect(changed.body.scope.products.map((p) => p.id)).toEqual([shelf.charger.id]);
    expect(changed.body.minPoints).toBe(30);

    const cleared = await patch({ productIds: [] });
    expect(cleared.body).toMatchObject({ scoped: false, minPoints: 30 }); // chỉ đổi danh sách được gửi
    expect((await patch({ categoryIds: [987654] })).status).toBe(400);
  });

  it('danh sách mã hiện tên phạm vi; sản phẩm đã bị xóa thì tên là null nhưng vẫn tính là có phạm vi', async () => {
    const admin = await signIn('admin@example.com', 'ADMIN');
    const shelf = await makeShelf();
    await makeCoupon({ productIds: [shelf.cable.id], categoryIds: [shelf.phones.id] });
    await prisma.product.delete({ where: { id: shelf.cable.id } });

    const res = await request(app).get('/api/admin/coupons').set(auth(admin.token));
    const [item] = res.body.items;
    expect(item.scoped).toBe(true);
    expect(item.scope.products).toEqual([{ id: shelf.cable.id, name: null }]);
    expect(item.scope.categories).toEqual([{ id: shelf.phones.id, name: 'Điện thoại X' }]);
  });

  it('CSDL từ chối điểm âm và danh sách quá 50 phần tử (chốt chặn cuối)', async () => {
    await expect(makeCoupon({ code: 'DIEMAM', minPoints: -1 })).rejects.toThrow();
    await expect(
      makeCoupon({ code: 'QUA50', brandIds: Array.from({ length: 51 }, (_, i) => i + 1) }),
    ).rejects.toThrow();
  });
});

describe('Xem trước mã theo giỏ hàng, có phạm vi (US-25)', () => {
  it('chỉ giảm trên các sản phẩm được áp dụng, không tính các món khác trong giỏ', async () => {
    const shelf = await makeShelf();
    await makeCoupon({ categoryIds: [shelf.accessories.id] });

    const res = await previewItems('GIAM10', cartOf(shelf.phone, shelf.charger, shelf.cable));
    expect(res.status).toBe(200);
    // Chỉ phụ kiện (500.000 + 200.000) được giảm 10%, điện thoại 10 triệu thì không
    expect(res.body).toMatchObject({ scoped: true, eligibleSubtotal: 700_000, discount: 70_000 });
  });

  it('áp dụng theo sản phẩm, theo thương hiệu và theo hợp của cả ba', async () => {
    const shelf = await makeShelf();
    const cart = cartOf(shelf.phone, shelf.charger, shelf.cable);

    await makeCoupon({ code: 'THEOSP', productIds: [shelf.phone.id] });
    expect((await previewItems('THEOSP', cart)).body.eligibleSubtotal).toBe(10_000_000);

    await makeCoupon({ code: 'THEOHANG', brandIds: [shelf.brandA.id] });
    expect((await previewItems('THEOHANG', cart)).body.eligibleSubtotal).toBe(10_200_000);

    await makeCoupon({
      code: 'HOPBA',
      productIds: [shelf.charger.id],
      brandIds: [shelf.brandA.id],
    });
    expect((await previewItems('HOPBA', cart)).body.eligibleSubtotal).toBe(10_700_000);
  });

  it('số lượng được nhân vào tiền hàng của dòng được áp dụng', async () => {
    const shelf = await makeShelf();
    await makeCoupon({ productIds: [shelf.charger.id] });
    const res = await previewItems('GIAM10', [
      { productId: shelf.charger.id, quantity: 3 },
      { productId: shelf.phone.id, quantity: 1 },
    ]);
    expect(res.body).toMatchObject({ eligibleSubtotal: 1_500_000, discount: 150_000 });
  });

  it('giỏ không có sản phẩm nào được áp dụng: báo COUPON_NOT_APPLICABLE', async () => {
    const shelf = await makeShelf();
    await makeCoupon({ categoryIds: [shelf.accessories.id] });
    const res = await previewItems('GIAM10', cartOf(shelf.phone));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_NOT_APPLICABLE');
  });

  it('phạm vi trỏ vào id đã bị xóa thì không áp dụng cho ai, không thành "áp dụng tất cả"', async () => {
    const shelf = await makeShelf();
    await makeCoupon({ productIds: [987654] });
    const res = await previewItems('GIAM10', cartOf(shelf.phone, shelf.charger));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_NOT_APPLICABLE');
  });

  it('đơn tối thiểu tính trên phần được áp dụng: giỏ lớn nhưng phần phụ kiện chưa đủ thì báo thiếu', async () => {
    const shelf = await makeShelf();
    await makeCoupon({ categoryIds: [shelf.accessories.id], minOrder: 1_000_000 });
    const res = await previewItems('GIAM10', cartOf(shelf.phone, shelf.charger, shelf.cable));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_MIN_ORDER');
    expect(res.body.error.details).toEqual({ minOrder: 1_000_000, scoped: true });
    expect(res.body.error.message).toContain('sản phẩm được áp dụng');

    // Thêm phụ kiện cho đủ 1.000.000 thì dùng được
    const enough = await previewItems('GIAM10', [
      { productId: shelf.charger.id, quantity: 2 },
      { productId: shelf.phone.id, quantity: 1 },
    ]);
    expect(enough.status).toBe(200);
  });

  it('sản phẩm đã ẩn không tính vào giỏ xem trước', async () => {
    const shelf = await makeShelf();
    const hidden = await makeProduct({
      price: 900_000,
      isActive: false,
      categoryId: shelf.accessories.id,
    });
    await makeCoupon({ categoryIds: [shelf.accessories.id] });
    const res = await previewItems('GIAM10', cartOf(shelf.charger, hidden));
    expect(res.body.eligibleSubtotal).toBe(500_000);
  });
});

describe('Điểm thành viên tối thiểu (US-25)', () => {
  it('khách chưa đăng nhập bị từ chối và được mời đăng nhập', async () => {
    await makeCoupon({ minPoints: 10 });
    const res = await preview('GIAM10', 2_000_000);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_MIN_POINTS');
    expect(res.body.error.details).toEqual({ minPoints: 10, points: null });
    expect(res.body.error.message).toContain('đăng nhập');
  });

  it('thành viên chưa đủ điểm được báo số điểm hiện có và số điểm cần', async () => {
    const buyer = await signIn();
    await prisma.user.update({ where: { id: buyer.user.id }, data: { points: 7 } });
    await makeCoupon({ minPoints: 10 });
    const res = await preview('GIAM10', 2_000_000, buyer.token);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_MIN_POINTS');
    expect(res.body.error.details).toEqual({ minPoints: 10, points: 7 });
    expect(res.body.error.message).toContain('10');
    expect(res.body.error.message).toContain('7');
  });

  it('đủ điểm (kể cả đúng bằng mức tối thiểu) thì dùng được', async () => {
    const buyer = await signIn();
    await prisma.user.update({ where: { id: buyer.user.id }, data: { points: 10 } });
    await makeCoupon({ minPoints: 10 });
    const res = await preview('GIAM10', 2_000_000, buyer.token);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ minPoints: 10, discount: 200_000 });
  });

  it('mã không yêu cầu điểm thì khách dùng được như cũ', async () => {
    await makeCoupon({ minPoints: 0 });
    expect((await preview('GIAM10', 1_000_000)).status).toBe(200);
  });

  it('token sai thì 401 (để Client làm mới phiên), không âm thầm coi là khách', async () => {
    await makeCoupon({ minPoints: 10 });
    const res = await preview('GIAM10', 1_000_000, 'token-sai');
    expect(res.status).toBe(401);
  });

  it('lý do "hết hạn" được báo trước lý do thiếu điểm', async () => {
    await makeCoupon({
      minPoints: 10,
      startsAt: new Date(Date.now() - 2 * HOUR),
      endsAt: new Date(Date.now() - HOUR),
    });
    const res = await preview('GIAM10', 1_000_000);
    expect(res.body.error.code).toBe('COUPON_EXPIRED');
  });
});

describe('Đặt hàng với mã có điều kiện phụ (BR-14)', () => {
  it('thành viên: chỉ giảm trên phần được áp dụng, tổng và dòng đơn đúng', async () => {
    const buyer = await signIn();
    const shelf = await makeShelf();
    await fillCart(buyer.user.id, shelf.phone);
    await fillCart(buyer.user.id, shelf.charger, 2);
    await makeCoupon({ categoryIds: [shelf.accessories.id] });

    const res = await memberOrder(buyer, 'GIAM10');
    expect(res.status).toBe(201);
    // Tiền hàng 11.000.000 (10 triệu + 2 x 500.000), giảm 10% của 1.000.000 phụ kiện = 100.000
    expect(res.body).toMatchObject({
      subtotal: 11_000_000,
      discount: 100_000,
      couponCode: 'GIAM10',
      shippingFee: 0,
      total: 10_900_000,
    });
    expect(res.body.items).toHaveLength(2);
    expect((await couponRow()).usedCount).toBe(1);
  });

  it('không có món nào được áp dụng: từ chối, không tạo đơn, không trừ kho, không tốn lượt', async () => {
    const buyer = await signIn();
    const shelf = await makeShelf();
    await fillCart(buyer.user.id, shelf.phone);
    await makeCoupon({ categoryIds: [shelf.accessories.id] });

    const res = await memberOrder(buyer, 'GIAM10');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_NOT_APPLICABLE');
    expect(await prisma.order.count()).toBe(0);
    expect(await stockOf(shelf.phone)).toBe(10);
    expect((await couponRow()).usedCount).toBe(0);
  });

  it('đơn tối thiểu của mã có phạm vi tính trên phần được áp dụng khi đặt hàng', async () => {
    const buyer = await signIn();
    const shelf = await makeShelf();
    await fillCart(buyer.user.id, shelf.phone);
    await fillCart(buyer.user.id, shelf.charger);
    await makeCoupon({ categoryIds: [shelf.accessories.id], minOrder: 1_000_000 });

    const res = await memberOrder(buyer, 'GIAM10');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('COUPON_MIN_ORDER');
    expect(await prisma.order.count()).toBe(0);
  });

  it('thiếu điểm thành viên: từ chối và hoàn tác cả kho; đủ điểm thì đặt được', async () => {
    const buyer = await signIn();
    const product = await makeProduct({ price: 1_000_000, stock: 5 });
    await fillCart(buyer.user.id, product);
    await prisma.user.update({ where: { id: buyer.user.id }, data: { points: 4 } });
    await makeCoupon({ minPoints: 5 });

    const denied = await memberOrder(buyer, 'GIAM10');
    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe('COUPON_MIN_POINTS');
    expect(await stockOf(product)).toBe(5);
    expect((await couponRow()).usedCount).toBe(0);

    await prisma.user.update({ where: { id: buyer.user.id }, data: { points: 5 } });
    const ok = await memberOrder(buyer, 'GIAM10');
    expect(ok.status).toBe(201);
    expect(ok.body.discount).toBe(100_000);
  });

  it('khách vãng lai không dùng được mã có điểm tối thiểu, nhưng dùng được mã có phạm vi', async () => {
    const shelf = await makeShelf();
    await makeCoupon({ code: 'CHODIEM', minPoints: 1 });
    await makeCoupon({ code: 'CHOPHUKIEN', categoryIds: [shelf.accessories.id] });

    const items = [
      { productId: shelf.phone.id, quantity: 1 },
      { productId: shelf.charger.id, quantity: 1 },
    ];
    const denied = await guestOrder(items, { couponCode: 'CHODIEM' });
    expect(denied.status).toBe(400);
    expect(denied.body.error.code).toBe('COUPON_MIN_POINTS');
    expect(await stockOf(shelf.phone)).toBe(10);

    const ok = await guestOrder(items, { couponCode: 'CHOPHUKIEN' });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ discount: 50_000, couponCode: 'CHOPHUKIEN' });
  });

  it('xem trước và đặt hàng cho cùng một số tiền giảm (hai nơi dùng chung một hàm kiểm tra)', async () => {
    const buyer = await signIn();
    const shelf = await makeShelf();
    await fillCart(buyer.user.id, shelf.phone);
    await fillCart(buyer.user.id, shelf.cable, 3);
    await makeCoupon({ brandIds: [shelf.brandA.id], type: 'FIXED', value: 1_500_000 });

    const quote = await previewItems(
      'GIAM10',
      [
        { productId: shelf.phone.id, quantity: 1 },
        { productId: shelf.cable.id, quantity: 3 },
      ],
      buyer.token,
    );
    const order = await memberOrder(buyer, 'GIAM10');
    expect(order.body.discount).toBe(quote.body.discount);
    expect(quote.body.discount).toBe(1_500_000);
  });
});
