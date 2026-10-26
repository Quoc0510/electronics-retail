/**
 * @feature [F03] Sản phẩm - Kiểm thử API quản trị sản phẩm (US-08, US-09).
 */
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const url = '/api/admin/products';

const adminAuth = async () => {
  await createUser({ email: 'admin@example.com', role: 'ADMIN' });
  const { accessToken } = await loginAs(request, app, 'admin@example.com');
  return { Authorization: `Bearer ${accessToken}` };
};

// Tạo sẵn một danh mục và một thương hiệu để gắn vào sản phẩm
const createParents = async () => {
  const category = await prisma.category.create({
    data: { name: 'Điện thoại', slug: 'dien-thoai' },
  });
  const brand = await prisma.brand.create({ data: { name: 'Apple', slug: 'apple' } });
  return { categoryId: category.id, brandId: brand.id };
};

const validBody = (parents, overrides = {}) => ({
  sku: 'IP15-128',
  name: 'iPhone 15 128GB',
  categoryId: parents.categoryId,
  brandId: parents.brandId,
  price: 19990000,
  ...overrides,
});

// Tạo sản phẩm trực tiếp trong DB để chuẩn bị dữ liệu nhanh
const insertProduct = (parents, overrides = {}) =>
  prisma.product.create({
    data: {
      sku: 'SKU-1',
      name: 'Sản phẩm 1',
      slug: 'san-pham-1',
      price: 1000000,
      stock: 5,
      ...parents,
      ...overrides,
    },
  });

describe('phân quyền (US-05)', () => {
  it('chưa đăng nhập trả 401', async () => {
    const res = await request(app).get(url);

    expect(res.status).toBe(401);
  });

  it('khách hàng trả 403 ở mọi thao tác', async () => {
    await createUser({ email: 'khach@example.com' });
    const { accessToken } = await loginAs(request, app, 'khach@example.com');
    const auth = { Authorization: `Bearer ${accessToken}` };

    const results = await Promise.all([
      request(app).get(url).set(auth),
      request(app).post(url).set(auth).send({}),
      request(app).patch(`${url}/1`).set(auth).send({ name: 'X' }),
      request(app).delete(`${url}/1`).set(auth),
      request(app).post(`${url}/1/images`).set(auth),
    ]);

    expect(results.map((r) => r.status)).toEqual([403, 403, 403, 403, 403]);
  });
});

describe('tạo sản phẩm (US-08)', () => {
  it('tạo với dữ liệu tối thiểu: dùng giá trị mặc định, tự sinh slug, SKU thành chữ hoa', async () => {
    const auth = await adminAuth();
    const parents = await createParents();

    const res = await request(app)
      .post(url)
      .set(auth)
      .send(validBody(parents, { sku: 'ip15-128' }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      sku: 'IP15-128',
      name: 'iPhone 15 128GB',
      slug: 'iphone-15-128gb',
      price: 19990000,
      salePrice: null,
      stock: 0,
      isActive: true,
      description: '',
      specs: {},
      images: [],
      category: { name: 'Điện thoại' },
      brand: { name: 'Apple' },
    });
  });

  it('tạo đầy đủ, kể cả giá khuyến mãi, tồn kho, thông số và trạng thái ẩn', async () => {
    const auth = await adminAuth();
    const parents = await createParents();

    const res = await request(app)
      .post(url)
      .set(auth)
      .send(
        validBody(parents, {
          salePrice: 18490000,
          stock: 25,
          description: '  Mô tả sản phẩm  ',
          specs: { 'Màn hình': '6.1 inch OLED', ' Chip ': ' A16 Bionic ' },
          isActive: false,
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      salePrice: 18490000,
      stock: 25,
      description: 'Mô tả sản phẩm',
      isActive: false,
      specs: { 'Màn hình': '6.1 inch OLED', Chip: 'A16 Bionic' },
    });
  });

  it.each([
    ['thiếu tên', { name: undefined }, 'name'],
    ['tên trống', { name: '  ' }, 'name'],
    ['thiếu SKU', { sku: undefined }, 'sku'],
    ['SKU có ký tự lạ', { sku: 'AB CD!' }, 'sku'],
    ['SKU quá dài', { sku: 'A'.repeat(51) }, 'sku'],
    ['thiếu giá', { price: undefined }, 'price'],
    ['giá bằng 0', { price: 0 }, 'price'],
    ['giá âm', { price: -5 }, 'price'],
    ['giá có phần thập phân (BR-01)', { price: 1999.5 }, 'price'],
    ['giá là chuỗi', { price: '19990000' }, 'price'],
    ['giá quá lớn', { price: 2_000_000_000 }, 'price'],
    ['giá khuyến mãi bằng giá gốc (US-08 AC3)', { salePrice: 19990000 }, 'salePrice'],
    ['giá khuyến mãi cao hơn giá gốc', { salePrice: 25000000 }, 'salePrice'],
    ['tồn kho âm (US-08 AC4)', { stock: -1 }, 'stock'],
    ['tồn kho có phần thập phân', { stock: 1.5 }, 'stock'],
    ['thông số có giá trị quá dài', { specs: { A: 'x'.repeat(301) } }, 'specs'],
    [
      'quá 30 thông số',
      { specs: Object.fromEntries(Array.from({ length: 31 }, (_, i) => [`k${i}`, 'v'])) },
      'specs',
    ],
  ])('từ chối dữ liệu sai: %s', async (_name, overrides, field) => {
    const auth = await adminAuth();
    const parents = await createParents();

    const res = await request(app).post(url).set(auth).send(validBody(parents, overrides));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[field]).toBeDefined();
  });

  it('từ chối danh mục hoặc thương hiệu không tồn tại', async () => {
    const auth = await adminAuth();
    const parents = await createParents();

    const badCategory = await request(app)
      .post(url)
      .set(auth)
      .send(validBody(parents, { categoryId: 999999 }));
    const badBrand = await request(app)
      .post(url)
      .set(auth)
      .send(validBody(parents, { brandId: 999999 }));

    expect(badCategory.body.error.code).toBe('INVALID_CATEGORY');
    expect(badBrand.body.error.code).toBe('INVALID_BRAND');
  });

  it('SKU duy nhất, không phân biệt hoa thường (US-08 AC2)', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    await request(app).post(url).set(auth).send(validBody(parents));

    const res = await request(app)
      .post(url)
      .set(auth)
      .send(validBody(parents, { sku: 'ip15-128', name: 'Tên khác' }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SKU_TAKEN');
  });

  it('hai sản phẩm trùng tên khác SKU vẫn tạo được, slug thứ hai kèm SKU', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const first = await request(app).post(url).set(auth).send(validBody(parents));

    const second = await request(app)
      .post(url)
      .set(auth)
      .send(validBody(parents, { sku: 'IP15-256' }));

    expect(second.status).toBe(201);
    expect(first.body.slug).toBe('iphone-15-128gb');
    expect(second.body.slug).toBe('iphone-15-128gb-ip15-256');
  });

  it('từ chối tên chỉ gồm ký tự đặc biệt', async () => {
    const auth = await adminAuth();
    const parents = await createParents();

    const res = await request(app)
      .post(url)
      .set(auth)
      .send(validBody(parents, { name: '***' }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_NAME');
  });
});

describe('xem chi tiết', () => {
  it('trả đủ thông tin kèm danh sách ảnh theo thứ tự', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents, { specs: { RAM: '8GB' } });
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: 'https://example.com/b.png', sortOrder: 1 },
        { productId: product.id, url: 'https://example.com/a.png', sortOrder: 0 },
      ],
    });

    const res = await request(app).get(`${url}/${product.id}`).set(auth);

    expect(res.status).toBe(200);
    expect(res.body.specs).toEqual({ RAM: '8GB' });
    expect(res.body.images.map((i) => i.url)).toEqual([
      'https://example.com/a.png',
      'https://example.com/b.png',
    ]);
  });

  it('không tồn tại trả 404, id không phải số trả 400', async () => {
    const auth = await adminAuth();

    const missing = await request(app).get(`${url}/999999`).set(auth);
    const invalid = await request(app).get(`${url}/abc`).set(auth);

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });
});

describe('sửa, ẩn/hiện (US-08, US-09)', () => {
  it('sửa từng phần, các trường còn lại giữ nguyên', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);

    const res = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ price: 2000000, stock: 9 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ price: 2000000, stock: 9, name: 'Sản phẩm 1', sku: 'SKU-1' });
  });

  it('đổi tên thì slug đổi theo', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);

    const res = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ name: 'Tên mới hoàn toàn' });

    expect(res.body.slug).toBe('ten-moi-hoan-toan');
  });

  it('đặt và xóa giá khuyến mãi', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);

    const set = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ salePrice: 900000 });
    const cleared = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ salePrice: null });

    expect(set.body.salePrice).toBe(900000);
    expect(cleared.body.salePrice).toBeNull();
  });

  it('giá khuyến mãi phải thấp hơn giá gốc hiện có, kể cả khi chỉ gửi một trong hai (BR-02)', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents, { salePrice: 800000 });

    const saleTooHigh = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ salePrice: 1000000 });
    const priceTooLow = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ price: 700000 });

    expect(saleTooHigh.status).toBe(400);
    expect(saleTooHigh.body.error.code).toBe('INVALID_SALE_PRICE');
    expect(priceTooLow.status).toBe(400);
  });

  it('không đổi SKU sang SKU của sản phẩm khác, nhưng giữ SKU của chính mình thì được', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    await insertProduct(parents, { sku: 'A', slug: 'a' });
    const b = await insertProduct(parents, { sku: 'B', slug: 'b' });

    const clash = await request(app).patch(`${url}/${b.id}`).set(auth).send({ sku: 'a' });
    const same = await request(app).patch(`${url}/${b.id}`).set(auth).send({ sku: 'b', stock: 3 });

    expect(clash.status).toBe(409);
    expect(same.status).toBe(200);
  });

  it('đổi sang danh mục không tồn tại bị từ chối', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);

    const res = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ categoryId: 999999 });

    expect(res.body.error.code).toBe('INVALID_CATEGORY');
  });

  it('ẩn rồi hiện lại (US-09 AC1)', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);

    const hidden = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ isActive: false });
    const shown = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ isActive: true });

    expect(hidden.body.isActive).toBe(false);
    expect(shown.body.isActive).toBe(true);
  });

  it('sản phẩm không tồn tại trả 404; body rỗng trả 400', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);

    const missing = await request(app).patch(`${url}/999999`).set(auth).send({ name: 'X' });
    const empty = await request(app).patch(`${url}/${product.id}`).set(auth).send({});

    expect(missing.status).toBe(404);
    expect(empty.status).toBe(400);
  });
});

describe('danh sách (US-09 AC3)', () => {
  const seedList = async () => {
    const parents = await createParents();
    const otherCategory = await prisma.category.create({
      data: { name: 'Laptop', slug: 'laptop' },
    });
    const otherBrand = await prisma.brand.create({ data: { name: 'Dell', slug: 'dell' } });
    await insertProduct(parents, { sku: 'IP-1', name: 'iPhone 15', slug: 'iphone-15' });
    await insertProduct(parents, {
      sku: 'IP-2',
      name: 'iPhone 14',
      slug: 'iphone-14',
      isActive: false,
    });
    await insertProduct(
      { categoryId: otherCategory.id, brandId: otherBrand.id },
      { sku: 'XPS-13', name: 'Dell XPS 13', slug: 'dell-xps-13' },
    );
    return { parents, otherCategory, otherBrand };
  };

  it('trả dữ liệu phân trang kèm danh mục, thương hiệu và ảnh đại diện', async () => {
    const auth = await adminAuth();
    const { parents } = await seedList();
    const product = await prisma.product.findFirst({ where: { sku: 'IP-1' } });
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: '/uploads/products/second.png', sortOrder: 1 },
        { productId: product.id, url: '/uploads/products/first.png', sortOrder: 0 },
      ],
    });

    const res = await request(app).get(url).set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 3 });
    const item = res.body.items.find((i) => i.sku === 'IP-1');
    expect(item.thumbnail).toBe('/uploads/products/first.png');
    expect(item.category).toEqual({ id: parents.categoryId, name: 'Điện thoại' });
    expect(item.brand.name).toBe('Apple');
    expect(item).not.toHaveProperty('specs'); // danh sách không trả dữ liệu nặng
    expect(res.body.items.find((i) => i.sku === 'XPS-13').thumbnail).toBeNull();
  });

  it('sắp xếp sản phẩm mới nhất lên đầu', async () => {
    const auth = await adminAuth();
    await seedList();

    const res = await request(app).get(url).set(auth);

    expect(res.body.items.map((i) => i.sku)).toEqual(['XPS-13', 'IP-2', 'IP-1']);
  });

  it('phân trang: trang 2 và tổng số', async () => {
    const auth = await adminAuth();
    await seedList();

    const res = await request(app).get(`${url}?page=2&pageSize=2`).set(auth);

    expect(res.body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
    expect(res.body.items).toHaveLength(1);
  });

  it.each([
    ['theo tên, không phân biệt hoa thường', 'search=IPHONE', ['IP-2', 'IP-1']],
    ['theo SKU', 'search=xps', ['XPS-13']],
    ['chỉ sản phẩm đang hiện', 'isActive=true', ['XPS-13', 'IP-1']],
    ['chỉ sản phẩm đang ẩn', 'isActive=false', ['IP-2']],
  ])('lọc %s', async (_name, query, expected) => {
    const auth = await adminAuth();
    await seedList();

    const res = await request(app).get(`${url}?${query}`).set(auth);

    expect(res.body.items.map((i) => i.sku)).toEqual(expected);
  });

  it('lọc theo danh mục và theo thương hiệu', async () => {
    const auth = await adminAuth();
    const { otherCategory, otherBrand } = await seedList();

    const byCategory = await request(app).get(`${url}?categoryId=${otherCategory.id}`).set(auth);
    const byBrand = await request(app).get(`${url}?brandId=${otherBrand.id}`).set(auth);

    expect(byCategory.body.items.map((i) => i.sku)).toEqual(['XPS-13']);
    expect(byBrand.body.total).toBe(1);
  });

  it.each([['page=0'], ['pageSize=100'], ['isActive=co'], ['categoryId=abc']])(
    'từ chối tham số sai: %s',
    async (query) => {
      const auth = await adminAuth();

      const res = await request(app).get(`${url}?${query}`).set(auth);

      expect(res.status).toBe(400);
    },
  );
});

describe('xóa (US-09 AC2, BR-09)', () => {
  it('xóa được sản phẩm chưa có trong đơn, dọn luôn giỏ hàng và file ảnh', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);

    // Một file ảnh thật trên đĩa và một dòng trong giỏ hàng của khách
    const folder = path.join(env.uploadDir, 'products');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'to-delete.png'), 'x');
    await prisma.productImage.create({
      data: { productId: product.id, url: '/uploads/products/to-delete.png' },
    });
    const customer = await createUser({ email: 'khach@example.com' });
    const cart = await prisma.cart.create({ data: { userId: customer.id } });
    await prisma.cartItem.create({ data: { cartId: cart.id, productId: product.id, quantity: 1 } });

    const del = await request(app).delete(`${url}/${product.id}`).set(auth);

    expect(del.status).toBe(204);
    expect(await prisma.product.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(0);
    expect(fs.existsSync(path.join(folder, 'to-delete.png'))).toBe(false);
  });

  it('đã có trong đơn hàng thì trả 409 và vẫn ẩn được', async () => {
    const auth = await adminAuth();
    const parents = await createParents();
    const product = await insertProduct(parents);
    const customer = await createUser({ email: 'khach@example.com' });
    const order = await prisma.order.create({
      data: {
        code: 'TS261022-0001',
        userId: customer.id,
        subtotal: 1000000,
        shippingFee: 30000,
        total: 1030000,
        recipientName: 'A',
        phone: '0912345678',
        shippingAddress: '1 Lê Duẩn',
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitPrice: 1000000,
        quantity: 1,
      },
    });

    const del = await request(app).delete(`${url}/${product.id}`).set(auth);
    const hide = await request(app)
      .patch(`${url}/${product.id}`)
      .set(auth)
      .send({ isActive: false });

    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('HAS_ORDERS');
    expect(hide.status).toBe(200);
    expect(await prisma.product.count()).toBe(1);
  });

  it('xóa sản phẩm không tồn tại trả 404', async () => {
    const auth = await adminAuth();

    const res = await request(app).delete(`${url}/999999`).set(auth);

    expect(res.status).toBe(404);
  });
});
