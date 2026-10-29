/**
 * @feature [F08] Đánh giá sản phẩm - Kiểm thử API khách hàng (US-21): chỉ người đã nhận hàng mới đánh giá (BR-13),
 * 1-5 sao kèm bình luận tối đa 500 ký tự, mỗi người một đánh giá cho mỗi sản phẩm (BR-19), điểm trung bình.
 * Chạy trên PostgreSQL thật.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { maskName } from '../src/services/review.service.js';
import {
  createCatalog,
  createOrderWith,
  createProduct,
  createUser,
  loginAs,
  resetDatabase,
} from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const auth = (token) => ({ Authorization: `Bearer ${token}` });

let product;
beforeEach(async () => {
  const { category, brand } = await createCatalog();
  product = await createProduct({ categoryId: category.id, brandId: brand.id });
});

// Người dùng đã đăng nhập; purchased = true thì có sẵn một đơn COMPLETED chứa sản phẩm
const signIn = async (email, { purchased = true, fullName } = {}) => {
  const user = await createUser({ email, fullName });
  const { accessToken } = await loginAs(request, app, email);
  if (purchased) await createOrderWith({ userId: user.id, product });
  return { user, token: accessToken };
};

const post = (token, body, slug = product.slug) =>
  request(app).post(`/api/products/${slug}/reviews`).set(auth(token)).send(body);
const patchMine = (token, body, slug = product.slug) =>
  request(app).patch(`/api/products/${slug}/reviews/mine`).set(auth(token)).send(body);
const getList = (query = '', slug = product.slug) =>
  request(app).get(`/api/products/${slug}/reviews${query}`);

// Tạo đánh giá trực tiếp trong DB (bỏ qua điều kiện đã mua) để chuẩn bị dữ liệu danh sách và điểm
let seq = 0;
const seedReview = async (fields = {}) => {
  seq += 1;
  const user = await createUser({ email: `seed${seq}@example.com`, fullName: `Khách ${seq}` });
  return prisma.review.create({
    data: {
      productId: product.id,
      userId: user.id,
      rating: 5,
      comment: `Bình luận ${seq}`,
      ...fields,
    },
  });
};

describe('maskName', () => {
  it('rút gọn thành "tên gọi + chữ cái đầu họ"', () => {
    expect(maskName('Phạm Anh Quốc')).toBe('Quốc P.');
    expect(maskName('Nguyễn Văn A')).toBe('A N.');
    expect(maskName('  đinh   hữu tài ')).toBe('tài Đ.');
  });

  it('tên một từ giữ nguyên, tên rỗng thành "Khách hàng"', () => {
    expect(maskName('Quốc')).toBe('Quốc');
    expect(maskName('   ')).toBe('Khách hàng');
  });
});

// ---------------------------------------------------------------------------
// Xem đánh giá (công khai)
// ---------------------------------------------------------------------------
describe('GET /api/products/:slug/reviews', () => {
  it('sản phẩm chưa có đánh giá: danh sách rỗng, điểm null (không phải 0)', async () => {
    const res = await getList();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [],
      page: 1,
      pageSize: 5,
      total: 0,
      summary: { average: null, count: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
    });
  });

  it('không cần đăng nhập, mới nhất trước, tên người viết được rút gọn và không lộ email', async () => {
    await seedReview({ comment: 'Cũ', createdAt: new Date('2026-10-01T00:00:00Z') });
    const recent = await seedReview({
      comment: 'Mới',
      createdAt: new Date('2026-10-20T00:00:00Z'),
    });
    const author = await createUser({ email: 'ten@example.com', fullName: 'Phạm Anh Quốc' });
    await prisma.review.update({ where: { id: recent.id }, data: { userId: author.id } });

    const res = await getList();

    expect(res.body.items.map((item) => item.comment)).toEqual(['Mới', 'Cũ']);
    expect(res.body.items[0]).toEqual({
      id: recent.id,
      rating: 5,
      comment: 'Mới',
      authorName: 'Quốc P.',
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com|Phạm Anh Quốc|userId|isHidden/);
  });

  it('điểm trung bình làm tròn 1 chữ số và đếm theo từng mức sao', async () => {
    for (const rating of [5, 4, 4]) await seedReview({ rating });

    const { summary } = (await getList()).body;

    expect(summary).toEqual({
      average: 4.3, // (5+4+4)/3 = 4.333...
      count: 3,
      breakdown: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 1 },
    });
  });

  it('đánh giá bị ẩn không hiện và không tính vào điểm, tổng số (US-23 AC1)', async () => {
    await seedReview({ rating: 5 });
    await seedReview({ rating: 1, isHidden: true });

    const res = await getList();

    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.summary).toMatchObject({ average: 5, count: 1 });
    expect(res.body.summary.breakdown[1]).toBe(0);
  });

  it('phân trang, mặc định 5 đánh giá mỗi trang', async () => {
    for (let i = 0; i < 7; i += 1) await seedReview();

    const first = await getList();
    const second = await getList('?page=2');

    expect(first.body.items).toHaveLength(5);
    expect(second.body.items).toHaveLength(2);
    expect(second.body).toMatchObject({ page: 2, total: 7 });
    const ids = [...first.body.items, ...second.body.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(7);
  });

  it('tham số phân trang sai thì 400', async () => {
    expect((await getList('?page=0')).status).toBe(400);
    expect((await getList('?pageSize=51')).status).toBe(400);
    expect((await getList('?pageSize=abc')).status).toBe(400);
  });

  it('sản phẩm không tồn tại, đã ẩn hoặc thuộc danh mục bị ẩn thì 404', async () => {
    expect((await getList('', 'khong-co')).status).toBe(404);

    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    expect((await getList()).status).toBe(404);

    await prisma.product.update({ where: { id: product.id }, data: { isActive: true } });
    await prisma.category.update({ where: { id: product.categoryId }, data: { isActive: false } });
    expect((await getList()).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /reviews/mine: điều kiện được đánh giá (BR-13)
// ---------------------------------------------------------------------------
describe('GET /api/products/:slug/reviews/mine', () => {
  const getMine = (token, slug = product.slug) =>
    request(app).get(`/api/products/${slug}/reviews/mine`).set(auth(token));

  it('chưa đăng nhập thì 401', async () => {
    expect((await request(app).get(`/api/products/${product.slug}/reviews/mine`)).status).toBe(401);
  });

  it('chưa mua: canReview false, chưa có đánh giá', async () => {
    const { token } = await signIn('a@example.com', { purchased: false });

    expect((await getMine(token)).body).toEqual({ canReview: false, review: null });
  });

  it('chỉ đơn COMPLETED của chính mình mới cho đánh giá (đơn chờ, đã hủy, của người khác, của khách vãng lai không tính)', async () => {
    const { user, token } = await signIn('a@example.com', { purchased: false });
    const other = await createUser({ email: 'b@example.com' });

    await createOrderWith({ userId: user.id, product, status: 'PENDING' });
    await createOrderWith({ userId: user.id, product, status: 'SHIPPING' });
    await createOrderWith({ userId: user.id, product, status: 'CANCELLED' });
    await createOrderWith({ userId: other.id, product });
    await createOrderWith({ userId: null, product });
    expect((await getMine(token)).body.canReview).toBe(false);

    await createOrderWith({ userId: user.id, product });
    expect((await getMine(token)).body.canReview).toBe(true);
  });

  it('đơn COMPLETED của sản phẩm khác không cho đánh giá sản phẩm này', async () => {
    const { user, token } = await signIn('a@example.com', { purchased: false });
    const other = await createProduct({
      categoryId: product.categoryId,
      brandId: product.brandId,
      sku: 'SKU-2',
    });
    await createOrderWith({ userId: user.id, product: other });

    expect((await getMine(token)).body.canReview).toBe(false);
  });

  it('trả đánh giá của mình kể cả khi đang bị ẩn (kèm cờ isHidden)', async () => {
    const { user, token } = await signIn('a@example.com');
    await prisma.review.create({
      data: { productId: product.id, userId: user.id, rating: 2, comment: 'Tệ', isHidden: true },
    });

    const { body } = await getMine(token);

    expect(body.canReview).toBe(true);
    expect(body.review).toEqual({
      id: expect.any(Number),
      rating: 2,
      comment: 'Tệ',
      isHidden: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('sản phẩm không hiển thị thì 404', async () => {
    const { token } = await signIn('a@example.com');
    expect((await getMine(token, 'khong-co')).status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST: tạo đánh giá (US-21)
// ---------------------------------------------------------------------------
describe('POST /api/products/:slug/reviews', () => {
  it('chưa đăng nhập thì 401', async () => {
    const res = await request(app)
      .post(`/api/products/${product.slug}/reviews`)
      .send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it('chưa nhận hàng thì 403 và không tạo gì (AC1)', async () => {
    const { token } = await signIn('a@example.com', { purchased: false });

    const res = await post(token, { rating: 5, comment: 'Hay' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REVIEW_NOT_ALLOWED');
    expect(await prisma.review.count()).toBe(0);
  });

  it('đã nhận hàng thì tạo được, trả 201 và hiện ngay trong danh sách (AC1, AC4)', async () => {
    const { user, token } = await signIn('a@example.com', { fullName: 'Lê Thị B' });

    const res = await post(token, { rating: 4, comment: '  Dùng tốt  ' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ rating: 4, comment: 'Dùng tốt', isHidden: false });
    expect(await prisma.review.count({ where: { userId: user.id, productId: product.id } })).toBe(
      1,
    );

    const list = (await getList()).body;
    expect(list.items[0]).toMatchObject({ rating: 4, comment: 'Dùng tốt', authorName: 'B L.' });
    expect(list.summary).toMatchObject({ average: 4, count: 1 });
  });

  it('bình luận không bắt buộc (mặc định rỗng)', async () => {
    const { token } = await signIn('a@example.com');

    const res = await post(token, { rating: 3 });

    expect(res.status).toBe(201);
    expect(res.body.comment).toBe('');
  });

  it('bình luận đúng 500 ký tự được, 501 ký tự thì 400 (AC2)', async () => {
    const { token } = await signIn('a@example.com');

    const tooLong = await post(token, { rating: 5, comment: 'a'.repeat(501) });
    expect(tooLong.status).toBe(400);
    expect(await prisma.review.count()).toBe(0);

    expect((await post(token, { rating: 5, comment: 'a'.repeat(500) })).status).toBe(201);
  });

  it('khoảng trắng đầu cuối không tính vào giới hạn 500 ký tự', async () => {
    const { token } = await signIn('a@example.com');

    const res = await post(token, { rating: 5, comment: ` ${'a'.repeat(500)} ` });

    expect(res.status).toBe(201);
    expect(res.body.comment).toHaveLength(500);
  });

  it.each([
    ['0 sao', { rating: 0 }],
    ['6 sao', { rating: 6 }],
    ['số sao lẻ', { rating: 4.5 }],
    ['số sao là chuỗi', { rating: '5' }],
    ['thiếu số sao', { comment: 'Hay' }],
    ['bình luận không phải chuỗi', { rating: 5, comment: 123 }],
  ])('%s thì 400 (AC2)', async (_label, body) => {
    const { token } = await signIn('a@example.com');

    expect((await post(token, body)).status).toBe(400);
    expect(await prisma.review.count()).toBe(0);
  });

  it('đánh giá lần hai thì 409 và giữ nguyên đánh giá cũ (AC3)', async () => {
    const { token } = await signIn('a@example.com');
    await post(token, { rating: 5, comment: 'Lần đầu' });

    const res = await post(token, { rating: 1, comment: 'Lần hai' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('REVIEW_EXISTS');
    const [only] = await prisma.review.findMany();
    expect(only).toMatchObject({ rating: 5, comment: 'Lần đầu' });
  });

  it('hai request gửi cùng lúc chỉ tạo một đánh giá (ràng buộc UNIQUE của DB)', async () => {
    const { token } = await signIn('a@example.com');

    const results = await Promise.all([post(token, { rating: 5 }), post(token, { rating: 4 })]);

    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await prisma.review.count()).toBe(1);
  });

  it('mua nhiều đơn vẫn chỉ một đánh giá cho sản phẩm', async () => {
    const { user, token } = await signIn('a@example.com');
    await createOrderWith({ userId: user.id, product });

    expect((await post(token, { rating: 5 })).status).toBe(201);
    expect((await post(token, { rating: 5 })).status).toBe(409);
  });

  it('sản phẩm không hiển thị thì 404', async () => {
    const { token } = await signIn('a@example.com');
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

    expect((await post(token, { rating: 5 })).status).toBe(404);
  });

  it('DB cũng từ chối số sao ngoài 1-5 và bình luận quá dài (CHECK) dù đi đường khác', async () => {
    const user = await createUser({ email: 'a@example.com' });
    const base = { productId: product.id, userId: user.id };

    await expect(prisma.review.create({ data: { ...base, rating: 6 } })).rejects.toThrow();
    await expect(prisma.review.create({ data: { ...base, rating: 0 } })).rejects.toThrow();
    await expect(
      prisma.review.create({ data: { ...base, rating: 5, comment: 'a'.repeat(501) } }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// PATCH: sửa đánh giá của mình
// ---------------------------------------------------------------------------
describe('PATCH /api/products/:slug/reviews/mine', () => {
  it('chưa đăng nhập thì 401', async () => {
    const res = await request(app)
      .patch(`/api/products/${product.slug}/reviews/mine`)
      .send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it('chưa có đánh giá thì 404', async () => {
    const { token } = await signIn('a@example.com');

    const res = await patchMine(token, { rating: 5 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REVIEW_NOT_FOUND');
  });

  it('sửa số sao và bình luận, điểm trung bình cập nhật theo', async () => {
    const { token } = await signIn('a@example.com');
    await post(token, { rating: 5, comment: 'Ban đầu' });

    const res = await patchMine(token, { rating: 2, comment: 'Đổi ý' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ rating: 2, comment: 'Đổi ý' });
    expect(await prisma.review.count()).toBe(1);
    expect((await getList()).body.summary).toMatchObject({ average: 2, count: 1 });
  });

  it('chỉ sửa được đánh giá của chính mình', async () => {
    const mine = await signIn('a@example.com');
    const theirs = await signIn('b@example.com');
    await post(theirs.token, { rating: 5, comment: 'Của B' });

    // A chưa đánh giá nên không thể chạm vào đánh giá của B
    expect((await patchMine(mine.token, { rating: 1, comment: 'Phá' })).status).toBe(404);
    const [review] = await prisma.review.findMany();
    expect(review).toMatchObject({ rating: 5, comment: 'Của B' });
  });

  it('đánh giá đang bị ẩn vẫn bị ẩn sau khi sửa (chỉ quản trị viên mới bỏ ẩn)', async () => {
    const { user, token } = await signIn('a@example.com');
    await prisma.review.create({
      data: {
        productId: product.id,
        userId: user.id,
        rating: 1,
        comment: 'Vi phạm',
        isHidden: true,
      },
    });

    const res = await patchMine(token, { rating: 5, comment: 'Đã sửa' });

    expect(res.status).toBe(200);
    expect(res.body.isHidden).toBe(true);
    expect((await getList()).body.total).toBe(0);
  });

  it('dữ liệu sai thì 400', async () => {
    const { token } = await signIn('a@example.com');
    await post(token, { rating: 5 });

    expect((await patchMine(token, { rating: 9 })).status).toBe(400);
    expect((await patchMine(token, { rating: 5, comment: 'a'.repeat(501) })).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Điểm đánh giá trên danh sách và chi tiết sản phẩm (US-21 AC4)
// ---------------------------------------------------------------------------
describe('điểm đánh giá trên API sản phẩm', () => {
  it('chi tiết có điểm, số đánh giá và phân bố theo sao', async () => {
    await seedReview({ rating: 5 });
    await seedReview({ rating: 3 });

    const res = await request(app).get(`/api/products/${product.slug}`);

    expect(res.body.rating).toEqual({
      average: 4,
      count: 2,
      breakdown: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 },
    });
  });

  it('danh sách có điểm cho từng sản phẩm; sản phẩm chưa có đánh giá thì average null', async () => {
    const other = await createProduct({
      categoryId: product.categoryId,
      brandId: product.brandId,
      sku: 'SKU-2',
    });
    await seedReview({ rating: 4 });
    await seedReview({ rating: 5, isHidden: true });

    const res = await request(app).get('/api/products');

    const byId = Object.fromEntries(res.body.items.map((item) => [item.id, item.rating]));
    expect(byId[product.id]).toEqual({ average: 4, count: 1 });
    expect(byId[other.id]).toEqual({ average: null, count: 0 });
  });
});
