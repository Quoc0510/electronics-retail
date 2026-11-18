/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Kiểm thử API và đặt hàng (US-37, US-38, BR-05).
 * Không bao giờ gọi GHN thật: `fetch` được thay bằng bản giả trả đúng dạng phản hồi trong tài liệu của GHN
 * (https://developer.ghn.vn). Chạy trên PostgreSQL thật. Phần "chưa cấu hình GHN" bảo đảm hành vi cũ (phí cố định) không đổi.
 */
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { clearShippingCache } from '../src/services/shipping.service.js';
import { createUser, resetDatabase } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
  clearShippingCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  env.GHN_TOKEN = '';
  env.ghnShopId = null;
});
afterAll(() => prisma.$disconnect());

// Bật GHN cho test: giá trị giả, chỉ sống trong tiến trình test
const enableGhn = () => {
  env.GHN_TOKEN = 'token-gia-chi-dung-cho-test';
  env.ghnShopId = 12345;
};

const ghnOk = (data) => new Response(JSON.stringify({ code: 200, message: 'Success', data }));
const ghnFail = (status, body) => new Response(JSON.stringify(body), { status });
const previewOk = (total = 22000) =>
  ghnOk({
    order_code: '',
    fee: { main_service: total },
    total_fee: total,
    expected_delivery_time: '2026-12-01T16:59:59Z',
  });
const ROUTE_NOT_FOUND = {
  code: 400,
  message: 'calculate fee error: calculate service fee error: route not found service',
  data: null,
};

// Giả `fetch`: handler nhận (url, init) và trả Response
const stubFetch = (handler) => {
  const mock = vi.fn(async (url, init) => handler(new URL(url), init));
  vi.stubGlobal('fetch', mock);
  return mock;
};
const bodyOf = (call) => JSON.parse(call[1].body);

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
      weightGrams: 400,
      categoryId: category.id,
      brandId: brand.id,
      ...overrides,
    },
  });
};

const address = {
  recipientName: 'Trần Thị B',
  phone: '0987654321',
  province: 'Hồ Chí Minh',
  ward: 'Phường Sài Gòn',
  street: '72 Lê Thánh Tôn',
};
const stockOf = async (product) =>
  (await prisma.product.findUnique({ where: { id: product.id } })).stock;

const quote = (items, extra = {}) =>
  request(app)
    .post('/api/shipping/quote')
    .send({ items, ...address, ...extra });
const guestOrder = (items) =>
  request(app)
    .post('/api/orders/guest')
    .send({
      items,
      shipping: { ...address, district: '' },
      requestId: randomUUID(),
    });

describe('Chưa cấu hình GHN (hành vi cũ)', () => {
  it('báo dùng phí cố định và ngưỡng miễn phí', async () => {
    const res = await request(app).get('/api/shipping/config');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ provider: 'FIXED', fallbackFee: 30000, freeThreshold: 5000000 });
  });

  it('danh mục tỉnh và phường/xã trả 404 SHIPPING_NOT_CONFIGURED', async () => {
    const provinces = await request(app).get('/api/shipping/provinces');
    const wards = await request(app).get('/api/shipping/provinces/1000001/wards');

    expect(provinces.status).toBe(404);
    expect(provinces.body.error.code).toBe('SHIPPING_NOT_CONFIGURED');
    expect(wards.status).toBe(404);
  });

  it('ước tính phí là phí cố định, không gọi GHN', async () => {
    const product = await makeProduct();
    const mock = stubFetch(() => previewOk());

    const res = await quote([{ productId: product.id, quantity: 1 }]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fee: 30000, source: 'FIXED', provider: 'FIXED' });
    expect(mock).not.toHaveBeenCalled();
  });
});

describe('Danh mục địa chỉ từ GHN', () => {
  beforeEach(enableGhn);

  it('trả tỉnh/thành đang hoạt động, gọi đúng đường dẫn kèm Token và ShopId, rồi nhớ tạm', async () => {
    const mock = stubFetch(() =>
      ghnOk([
        { _id: 1000001, name: 'Hồ Chí Minh', status: 1 },
        { _id: 1000002, name: 'Đã ngưng', status: 2 },
      ]),
    );

    const first = await request(app).get('/api/shipping/provinces');
    const second = await request(app).get('/api/shipping/provinces');

    expect(first.status).toBe(200);
    expect(first.body.items).toEqual([{ id: 1000001, name: 'Hồ Chí Minh' }]);
    expect(second.body.items).toEqual(first.body.items);
    expect(mock).toHaveBeenCalledTimes(1); // lần hai lấy từ bộ nhớ tạm
    const [url, init] = mock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/shiip/public-api/v3/master-data/province/all');
    expect(init.headers).toMatchObject({ Token: env.GHN_TOKEN, ShopId: '12345' });
  });

  it('lấy hết các trang phường/xã của một tỉnh (GHN giới hạn 200 dòng một lần)', async () => {
    const page = (from, count) =>
      Array.from({ length: count }, (_, i) => ({
        _id: from + i,
        name: `Phường ${from + i}`,
        status: 1,
      }));
    const mock = stubFetch((url) => {
      const offset = Number(url.searchParams.get('offset'));
      return ghnOk(offset === 0 ? page(1, 200) : page(201, 50));
    });

    const res = await request(app).get('/api/shipping/provinces/1000001/wards');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(250);
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[0][0].toString()).toContain('province_id=1000001');
  });

  it('GHN lỗi thì trả 502 SHIPPING_UNAVAILABLE để Client chuyển sang nhập tay', async () => {
    stubFetch(() => ghnFail(500, { code: 500, message: 'SERVER_ERROR_COMMON', data: null }));

    const res = await request(app).get('/api/shipping/provinces');

    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('SHIPPING_UNAVAILABLE');
  });

  it('mã tỉnh không phải số nguyên dương bị từ chối', async () => {
    const res = await request(app).get('/api/shipping/provinces/abc/wards');

    expect(res.status).toBe(400);
  });
});

describe('Ước tính phí bằng GHN', () => {
  beforeEach(enableGhn);

  it('gửi địa chỉ mới 2 cấp cùng cân nặng lấy từ CSDL và trả phí GHN', async () => {
    const phone = await makeProduct({ weightGrams: 300 });
    const mock = stubFetch(() => previewOk(22000));

    // Số lượng gửi lên là 2, cân nặng 300 g của sản phẩm do máy chủ tự lấy (Client không tự khai cân nặng)
    const res = await quote([{ productId: phone.id, quantity: 2 }]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      fee: 22000,
      source: 'GHN',
      provider: 'GHN',
      freeThreshold: 5000000,
      expectedDeliveryTime: '2026-12-01T16:59:59Z',
    });
    const [url] = mock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/shiip/public-api/v2/shipping-order/preview');
    expect(bodyOf(mock.mock.calls[0])).toMatchObject({
      is_new_to_address: true,
      to_province_name: 'Hồ Chí Minh',
      to_ward_name: 'Phường Sài Gòn',
      to_name: 'Trần Thị B',
      to_phone: '0987654321',
      weight: 600,
      service_type_id: 2,
    });
    expect(bodyOf(mock.mock.calls[0]).items).toEqual([
      expect.objectContaining({ quantity: 2, weight: 300, price: 1000000 }),
    ]);
  });

  it('từ 20 kg dùng dịch vụ hàng nặng (service_type_id 5)', async () => {
    const heavy = await makeProduct({ weightGrams: 10000 });
    const mock = stubFetch(() => previewOk(90000));

    await quote([{ productId: heavy.id, quantity: 2 }]);

    expect(bodyOf(mock.mock.calls[0])).toMatchObject({ weight: 20000, service_type_id: 5 });
  });

  it('vượt 50 kg thì báo 422 SHIPPING_TOO_HEAVY, không gọi GHN', async () => {
    const heavy = await makeProduct({ weightGrams: 30000 });
    const mock = stubFetch(() => previewOk());

    const res = await quote([{ productId: heavy.id, quantity: 2 }]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SHIPPING_TOO_HEAVY');
    expect(mock).not.toHaveBeenCalled();
  });

  it('GHN nói không có tuyến giao thì báo 422 SHIPPING_UNAVAILABLE', async () => {
    const product = await makeProduct();
    stubFetch(() => ghnFail(400, ROUTE_NOT_FOUND));

    const res = await quote([{ productId: product.id, quantity: 1 }]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SHIPPING_UNAVAILABLE');
  });

  it.each([
    ['hết giờ hoặc mất mạng', () => Promise.reject(new Error('timeout'))],
    ['GHN lỗi 500', () => ghnFail(500, { code: 500, message: 'SERVER_ERROR_COMMON', data: null })],
    [
      'Token bị từ chối (401)',
      () => ghnFail(401, { code: 401, message: 'Authorization header is required!' }),
    ],
    [
      'GHN từ chối dữ liệu gửi đi (400)',
      () =>
        ghnFail(400, {
          code: 400,
          message: 'Sai thông tin',
          data: null,
          code_message: 'USER_ERR_COMMON',
        }),
    ],
  ])('%s thì không chặn khách: dùng phí cố định và đánh dấu FALLBACK', async (_name, handler) => {
    const product = await makeProduct();
    stubFetch(handler);

    const res = await quote([{ productId: product.id, quantity: 1 }]);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ fee: 30000, source: 'FALLBACK' });
  });

  it('giỏ không còn sản phẩm nào thì báo giỏ trống; thiếu địa chỉ thì 400', async () => {
    stubFetch(() => previewOk());

    const empty = await quote([{ productId: 999999, quantity: 1 }]);
    const missing = await request(app)
      .post('/api/shipping/quote')
      .send({ items: [{ productId: 1, quantity: 1 }], province: '', ward: '' });

    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('EMPTY_CART');
    expect(missing.status).toBe(400);
  });
});

describe('Đặt hàng dùng phí GHN', () => {
  beforeEach(enableGhn);

  it('khách vãng lai: đơn lưu phí GHN và tổng tiền cộng đúng', async () => {
    const product = await makeProduct();
    stubFetch(() => previewOk(25000));

    const res = await guestOrder([{ productId: product.id, quantity: 2 }]);

    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(2000000);
    expect(res.body.shippingFee).toBe(25000);
    expect(res.body.total).toBe(2025000);
  });

  it('thành viên: dùng phí GHN theo giỏ trong CSDL', async () => {
    const product = await makeProduct();
    const user = await createUser();
    await prisma.cart.create({
      data: { userId: user.id, items: { create: [{ productId: product.id, quantity: 1 }] } },
    });
    stubFetch(() => previewOk(27000));
    const { accessToken } = (
      await request(app).post('/api/auth/login').send({ email: user.email, password: 'Matkhau123' })
    ).body;

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ shipping: { ...address, district: '' } });

    expect(res.status).toBe(201);
    expect(res.body.shippingFee).toBe(27000);
  });

  it('tiền hàng sau giảm từ ngưỡng thì miễn phí dù GHN tính phí', async () => {
    const product = await makeProduct({ price: 6000000 });
    stubFetch(() => previewOk(25000));

    const res = await guestOrder([{ productId: product.id, quantity: 1 }]);

    expect(res.status).toBe(201);
    expect(res.body.shippingFee).toBe(0);
    expect(res.body.total).toBe(6000000);
  });

  it('ngưỡng miễn phí cấu hình được: đặt về 0 thì không miễn phí cho đơn nào', async () => {
    const product = await makeProduct({ price: 6000000 });
    stubFetch(() => previewOk(25000));
    const original = env.SHIPPING_FREE_THRESHOLD;
    env.SHIPPING_FREE_THRESHOLD = 0;
    try {
      const res = await guestOrder([{ productId: product.id, quantity: 1 }]);

      expect(res.body.shippingFee).toBe(25000);
    } finally {
      env.SHIPPING_FREE_THRESHOLD = original;
    }
  });

  it('GHN không giao được tới địa chỉ thì không tạo đơn và không trừ kho', async () => {
    const product = await makeProduct();
    stubFetch(() => ghnFail(400, ROUTE_NOT_FOUND));

    const res = await guestOrder([{ productId: product.id, quantity: 3 }]);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('SHIPPING_UNAVAILABLE');
    expect(await prisma.order.count()).toBe(0);
    expect(await stockOf(product)).toBe(10);
  });

  it('GHN sự cố thì vẫn đặt được với phí cố định', async () => {
    const product = await makeProduct();
    stubFetch(() => Promise.reject(new Error('mất mạng')));

    const res = await guestOrder([{ productId: product.id, quantity: 1 }]);

    expect(res.status).toBe(201);
    expect(res.body.shippingFee).toBe(30000);
  });

  it('cân nặng đổi giữa lúc báo giá và lúc trừ kho thì trả 409 CART_CHANGED, không tạo đơn', async () => {
    const product = await makeProduct();
    // Trong lúc "chờ GHN", Admin đổi cân nặng sản phẩm: phí đã báo không còn đúng với hàng sắp gửi
    stubFetch(async () => {
      await prisma.product.update({ where: { id: product.id }, data: { weightGrams: 5000 } });
      return previewOk(25000);
    });

    const res = await guestOrder([{ productId: product.id, quantity: 1 }]);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CART_CHANGED');
    expect(await prisma.order.count()).toBe(0);
    expect(await stockOf(product)).toBe(10);
  });

  it('gửi lại cùng requestId thì trả đơn cũ mà không gọi GHN lần nữa', async () => {
    const product = await makeProduct();
    const mock = stubFetch(() => previewOk(25000));
    const body = {
      items: [{ productId: product.id, quantity: 1 }],
      shipping: { ...address, district: '' },
      requestId: randomUUID(),
    };

    const first = await request(app).post('/api/orders/guest').send(body);
    const again = await request(app).post('/api/orders/guest').send(body);

    expect(again.body.code).toBe(first.body.code);
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
