/**
 * @feature [F16] Cài đặt cửa hàng - Kiểm thử API /api/admin/settings/shipping (ngưỡng miễn phí vận chuyển) và tác động của nó lên
 * cấu hình công khai và lên đơn hàng. Chạy trên PostgreSQL thật; GHN không bật nên phí gốc là phí cố định 30.000 đ.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createCatalog, createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const URL = '/api/admin/settings/shipping';

const authFor = async (role) => {
  const email = `${role.toLowerCase()}@example.com`;
  await createUser({ email, role });
  const { accessToken } = await loginAs(request, app, email);
  return { Authorization: `Bearer ${accessToken}` };
};
const adminAuth = () => authFor('ADMIN');

const address = {
  recipientName: 'Trần Thị B',
  phone: '0987654321',
  province: 'Hồ Chí Minh',
  ward: 'Phường Sài Gòn',
  street: '72 Lê Thánh Tôn',
};

const makeProduct = async (price) => {
  const { category, brand } = await createCatalog();
  return prisma.product.create({
    data: {
      sku: 'SKU-CAI-DAT',
      name: 'Sản phẩm cài đặt',
      slug: 'san-pham-cai-dat',
      price,
      stock: 50,
      categoryId: category.id,
      brandId: brand.id,
    },
  });
};
const guestOrder = (product, quantity = 1) =>
  request(app)
    .post('/api/orders/guest')
    .send({
      items: [{ productId: product.id, quantity }],
      shipping: { ...address, district: '' },
      requestId: randomUUID(),
    });

describe('Phân quyền', () => {
  it('chưa đăng nhập thì 401, khách hàng thì 403, cả xem lẫn đổi', async () => {
    const customer = await authFor('CUSTOMER');

    expect((await request(app).get(URL)).status).toBe(401);
    expect((await request(app).put(URL).send({ freeThreshold: 1 })).status).toBe(401);
    expect((await request(app).get(URL).set(customer)).status).toBe(403);
    expect((await request(app).put(URL).set(customer).send({ freeThreshold: 1 })).status).toBe(403);
    expect(await prisma.appSetting.count()).toBe(0);
  });
});

describe('GET /api/admin/settings/shipping', () => {
  it('chưa ai đặt thì trả giá trị mặc định (5.000.000 đ) và không có lần sửa', async () => {
    const res = await request(app)
      .get(URL)
      .set(await adminAuth());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      freeThreshold: 5000000,
      defaultFreeThreshold: 5000000,
      updatedAt: null,
    });
  });
});

describe('PUT /api/admin/settings/shipping', () => {
  it('lưu ngưỡng mới, đọc lại đúng, và ghi lần sửa', async () => {
    const auth = await adminAuth();

    const res = await request(app).put(URL).set(auth).send({ freeThreshold: 8000000 });

    expect(res.status).toBe(200);
    expect(res.body.freeThreshold).toBe(8000000);
    expect(res.body.defaultFreeThreshold).toBe(5000000);
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(0);
    const again = await request(app).get(URL).set(auth);
    expect(again.body.freeThreshold).toBe(8000000);
  });

  it('sửa lần nữa thì ghi đè, không tạo thêm dòng', async () => {
    const auth = await adminAuth();
    await request(app).put(URL).set(auth).send({ freeThreshold: 3000000 });

    const res = await request(app).put(URL).set(auth).send({ freeThreshold: 0 });

    expect(res.body.freeThreshold).toBe(0);
    expect(await prisma.appSetting.count()).toBe(1);
  });

  it('null thì quay về giá trị mặc định và xóa dòng cài đặt', async () => {
    const auth = await adminAuth();
    await request(app).put(URL).set(auth).send({ freeThreshold: 9000000 });

    const res = await request(app).put(URL).set(auth).send({ freeThreshold: null });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      freeThreshold: 5000000,
      defaultFreeThreshold: 5000000,
      updatedAt: null,
    });
    expect(await prisma.appSetting.count()).toBe(0);
  });

  it.each([
    ['số âm', { freeThreshold: -1 }],
    ['số thập phân', { freeThreshold: 1500.5 }],
    ['chuỗi', { freeThreshold: '5000000' }],
    ['quá lớn', { freeThreshold: 3_000_000_000 }],
    ['thiếu trường', {}],
  ])('từ chối %s bằng 400 và không đổi dữ liệu', async (_label, body) => {
    const res = await request(app)
      .put(URL)
      .set(await adminAuth())
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.appSetting.count()).toBe(0);
  });

  it('giá trị sai kiểu bị sửa tay trong CSDL thì bỏ qua, dùng mặc định', async () => {
    await prisma.appSetting.create({ data: { key: 'shipping.freeThreshold', value: 'abc' } });

    const res = await request(app)
      .get(URL)
      .set(await adminAuth());

    expect(res.body.freeThreshold).toBe(5000000);
    expect(res.body.updatedAt).toBeNull();
  });
});

describe('Tác động lên khách và đơn hàng', () => {
  it('/api/shipping/config công khai trả ngưỡng Admin đã đặt', async () => {
    expect((await request(app).get('/api/shipping/config')).body.freeThreshold).toBe(5000000);

    await request(app)
      .put(URL)
      .set(await adminAuth())
      .send({ freeThreshold: 2500000 });

    expect((await request(app).get('/api/shipping/config')).body.freeThreshold).toBe(2500000);
  });

  it('đơn đủ ngưỡng mới thì miễn phí, chưa đủ thì tính phí; đổi ngưỡng có hiệu lực ngay', async () => {
    const product = await makeProduct(4000000);
    const auth = await adminAuth();

    // Ngưỡng mặc định 5.000.000: đơn 4.000.000 chưa được miễn phí
    expect((await guestOrder(product)).body.shippingFee).toBe(30000);

    // Admin hạ ngưỡng xuống 3.000.000: cùng giá trị đơn nay được miễn phí
    await request(app).put(URL).set(auth).send({ freeThreshold: 3000000 });
    const free = await guestOrder(product);
    expect(free.status).toBe(201);
    expect(free.body.shippingFee).toBe(0);
    expect(free.body.total).toBe(4000000);

    // Admin nâng ngưỡng lên 10.000.000: đơn 8.000.000 phải trả phí
    await request(app).put(URL).set(auth).send({ freeThreshold: 10000000 });
    const paid = await guestOrder(product, 2);
    expect(paid.body.shippingFee).toBe(30000);
    expect(paid.body.total).toBe(8030000);
  });

  it('ngưỡng 0 thì không miễn phí cho đơn nào, dù đơn rất lớn', async () => {
    const product = await makeProduct(20000000);
    await request(app)
      .put(URL)
      .set(await adminAuth())
      .send({ freeThreshold: 0 });

    const res = await guestOrder(product);

    expect(res.body.shippingFee).toBe(30000);
  });

  it('đơn của thành viên cũng theo ngưỡng Admin đặt', async () => {
    const product = await makeProduct(4000000);
    const { accessToken } = await (async () => {
      await createUser({ email: 'thanhvien@example.com' });
      return loginAs(request, app, 'thanhvien@example.com');
    })();
    const member = { Authorization: `Bearer ${accessToken}` };
    await request(app)
      .put(URL)
      .set(await adminAuth())
      .send({ freeThreshold: 3000000 });
    await prisma.cart.create({
      data: {
        user: { connect: { email: 'thanhvien@example.com' } },
        items: { create: { productId: product.id, quantity: 1 } },
      },
    });

    const res = await request(app)
      .post('/api/orders')
      .set(member)
      .send({ shipping: { ...address, district: '' } });

    expect(res.status).toBe(201);
    expect(res.body.shippingFee).toBe(0);
  });
});
