/**
 * @feature [F08] Yêu thích - Kiểm thử API danh sách yêu thích (US-22, BR-20): thêm/bỏ idempotent, chỉ của chính mình,
 * ẩn sản phẩm không còn bán, giới hạn 100 sản phẩm. Chạy trên PostgreSQL thật.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { WISHLIST_LIMIT } from '../src/services/wishlist.service.js';
import { createCatalog, createProduct, createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const auth = (token) => ({ Authorization: `Bearer ${token}` });

let catalog;
let seq = 0;
beforeEach(async () => {
  catalog = await createCatalog();
  seq = 0;
});

const makeProduct = () => {
  seq += 1;
  return createProduct({
    categoryId: catalog.category.id,
    brandId: catalog.brand.id,
    sku: `SKU-${seq}`,
  });
};

const signIn = async (email = 'a@example.com') => {
  const user = await createUser({ email });
  return { user, token: (await loginAs(request, app, email)).accessToken };
};

const getList = (token) => request(app).get('/api/wishlist').set(auth(token));
const add = (token, id) => request(app).put(`/api/wishlist/${id}`).set(auth(token));
const remove = (token, id) => request(app).delete(`/api/wishlist/${id}`).set(auth(token));

describe('Yêu cầu đăng nhập', () => {
  it('chưa đăng nhập thì 401 ở cả ba thao tác', async () => {
    const product = await makeProduct();

    expect((await request(app).get('/api/wishlist')).status).toBe(401);
    expect((await request(app).put(`/api/wishlist/${product.id}`)).status).toBe(401);
    expect((await request(app).delete(`/api/wishlist/${product.id}`)).status).toBe(401);
  });
});

describe('GET /api/wishlist', () => {
  it('danh sách trống ban đầu', async () => {
    const { token } = await signIn();

    expect((await getList(token)).body).toEqual({ items: [], total: 0 });
  });

  it('trả thẻ sản phẩm (kèm điểm đánh giá), sản phẩm thêm sau đứng trước (AC2)', async () => {
    const { token } = await signIn();
    const first = await makeProduct();
    const second = await makeProduct();
    await add(token, first.id);
    await add(token, second.id);

    const res = await getList(token);

    expect(res.body.total).toBe(2);
    expect(res.body.items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(res.body.items[0]).toEqual({
      id: second.id,
      name: second.name,
      slug: second.slug,
      price: second.price,
      salePrice: null,
      inStock: true,
      thumbnail: null,
      category: { name: 'Điện thoại', slug: 'dien-thoai' },
      brand: { name: 'Hãng A', slug: 'hang-a' },
      rating: { average: null, count: 0 },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/"sku"|"stock"|isActive/);
  });

  it('chỉ thấy danh sách của chính mình', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct();
    await add(a.token, product.id);

    expect((await getList(a.token)).body.total).toBe(1);
    expect((await getList(b.token)).body.total).toBe(0);
  });

  it('sản phẩm bị ẩn (hoặc danh mục bị ẩn) không hiện, bán lại thì hiện lại', async () => {
    const { token } = await signIn();
    const keep = await makeProduct();
    const hidden = await makeProduct();
    await add(token, keep.id);
    await add(token, hidden.id);

    await prisma.product.update({ where: { id: hidden.id }, data: { isActive: false } });
    expect((await getList(token)).body.items.map((item) => item.id)).toEqual([keep.id]);

    await prisma.product.update({ where: { id: hidden.id }, data: { isActive: true } });
    await prisma.category.update({ where: { id: catalog.category.id }, data: { isActive: false } });
    expect((await getList(token)).body.total).toBe(0);

    await prisma.category.update({ where: { id: catalog.category.id }, data: { isActive: true } });
    expect((await getList(token)).body.total).toBe(2);
  });
});

describe('PUT /api/wishlist/:id (thêm)', () => {
  it('thêm thành công và có trong danh sách (AC1)', async () => {
    const { user, token } = await signIn();
    const product = await makeProduct();

    const res = await add(token, product.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ productId: product.id, inWishlist: true });
    expect(await prisma.wishlistItem.count({ where: { userId: user.id } })).toBe(1);
  });

  it('thêm lại lần nữa vẫn thành công và không tạo bản ghi thứ hai', async () => {
    const { token } = await signIn();
    const product = await makeProduct();
    await add(token, product.id);

    const again = await add(token, product.id);

    expect(again.status).toBe(200);
    expect(await prisma.wishlistItem.count()).toBe(1);
  });

  it('hai request cùng lúc vẫn chỉ một bản ghi và không lỗi', async () => {
    const { token } = await signIn();
    const product = await makeProduct();

    const results = await Promise.all([add(token, product.id), add(token, product.id)]);

    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect(await prisma.wishlistItem.count()).toBe(1);
  });

  it('sản phẩm không tồn tại hoặc không hiển thị thì 404', async () => {
    const { token } = await signIn();
    const product = await makeProduct();
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

    expect((await add(token, 9999)).status).toBe(404);
    expect((await add(token, product.id)).status).toBe(404);
    expect(await prisma.wishlistItem.count()).toBe(0);
  });

  it('id không phải số nguyên dương thì 400', async () => {
    const { token } = await signIn();

    expect((await add(token, 'abc')).status).toBe(400);
    expect((await add(token, 0)).status).toBe(400);
  });

  it(`tối đa ${WISHLIST_LIMIT} sản phẩm: thêm cái thứ ${WISHLIST_LIMIT + 1} thì 400, thêm lại cái đã có vẫn được`, async () => {
    const { user, token } = await signIn();
    const products = [];
    for (let i = 0; i < WISHLIST_LIMIT + 1; i += 1) products.push(await makeProduct());
    await prisma.wishlistItem.createMany({
      data: products.slice(0, WISHLIST_LIMIT).map((product) => ({
        userId: user.id,
        productId: product.id,
      })),
    });

    const res = await add(token, products[WISHLIST_LIMIT].id);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WISHLIST_FULL');
    expect(await prisma.wishlistItem.count()).toBe(WISHLIST_LIMIT);
    expect((await add(token, products[0].id)).status).toBe(200);

    await remove(token, products[0].id);
    expect((await add(token, products[WISHLIST_LIMIT].id)).status).toBe(200);
  }, 60000);
});

describe('DELETE /api/wishlist/:id (bỏ)', () => {
  it('bỏ thành công trả 204 (AC1)', async () => {
    const { token } = await signIn();
    const product = await makeProduct();
    await add(token, product.id);

    const res = await remove(token, product.id);

    expect(res.status).toBe(204);
    expect((await getList(token)).body.total).toBe(0);
  });

  it('bỏ sản phẩm không có trong danh sách vẫn 204', async () => {
    const { token } = await signIn();
    const product = await makeProduct();

    expect((await remove(token, product.id)).status).toBe(204);
    expect((await remove(token, 9999)).status).toBe(204);
  });

  it('bỏ được cả sản phẩm đã bị ẩn khỏi cửa hàng', async () => {
    const { token, user } = await signIn();
    const product = await makeProduct();
    await add(token, product.id);
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

    expect((await remove(token, product.id)).status).toBe(204);
    expect(await prisma.wishlistItem.count({ where: { userId: user.id } })).toBe(0);
  });

  it('không bỏ nhầm sản phẩm trong danh sách của người khác', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct();
    await add(a.token, product.id);
    await add(b.token, product.id);

    await remove(a.token, product.id);

    expect((await getList(a.token)).body.total).toBe(0);
    expect((await getList(b.token)).body.total).toBe(1);
  });

  it('id sai thì 400', async () => {
    const { token } = await signIn();
    expect((await remove(token, 'abc')).status).toBe(400);
  });
});
