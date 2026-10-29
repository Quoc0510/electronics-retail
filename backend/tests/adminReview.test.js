/**
 * @feature [F08] Đánh giá sản phẩm - Kiểm thử API Admin xem và ẩn/bỏ ẩn đánh giá (US-23).
 * Chạy trên PostgreSQL thật.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createCatalog, createProduct, createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const auth = (token) => ({ Authorization: `Bearer ${token}` });

let product;
beforeEach(async () => {
  const { category, brand } = await createCatalog();
  product = await createProduct({ categoryId: category.id, brandId: brand.id });
});

const signInAdmin = async () => {
  await createUser({ email: 'admin@example.com', role: 'ADMIN', fullName: 'Quản trị viên' });
  return (await loginAs(request, app, 'admin@example.com')).accessToken;
};

let seq = 0;
const seedReview = async ({ email, fullName, forProduct = product, ...fields } = {}) => {
  seq += 1;
  const user = await createUser({
    email: email ?? `khach${seq}@example.com`,
    fullName: fullName ?? `Khách ${seq}`,
  });
  return prisma.review.create({
    data: {
      productId: forProduct.id,
      userId: user.id,
      rating: 5,
      comment: `Nhận xét ${seq}`,
      ...fields,
    },
  });
};

const list = (token, query = '') => request(app).get(`/api/admin/reviews${query}`).set(auth(token));
const setHidden = (token, id, body) =>
  request(app).patch(`/api/admin/reviews/${id}/visibility`).set(auth(token)).send(body);

describe('Quyền truy cập /api/admin/reviews', () => {
  it('chưa đăng nhập thì 401', async () => {
    expect((await request(app).get('/api/admin/reviews')).status).toBe(401);
    expect((await request(app).patch('/api/admin/reviews/1/visibility').send({})).status).toBe(401);
  });

  it('khách hàng thì 403 và không ẩn được đánh giá', async () => {
    const review = await seedReview();
    await createUser({ email: 'khach@example.com' });
    const { accessToken } = await loginAs(request, app, 'khach@example.com');

    expect((await list(accessToken)).status).toBe(403);
    expect((await setHidden(accessToken, review.id, { isHidden: true })).status).toBe(403);
    expect((await prisma.review.findUnique({ where: { id: review.id } })).isHidden).toBe(false);
  });
});

describe('GET /api/admin/reviews', () => {
  it('trả đủ thông tin kiểm duyệt: sản phẩm, người viết (email đầy đủ), nội dung, trạng thái ẩn', async () => {
    const token = await signInAdmin();
    const review = await seedReview({
      email: 'lan@example.com',
      fullName: 'Trần Thị Lan',
      rating: 2,
    });

    const res = await list(token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(res.body.items[0]).toEqual({
      id: review.id,
      rating: 2,
      comment: review.comment,
      isHidden: false,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      product: { id: product.id, name: product.name, slug: product.slug },
      user: { id: review.userId, email: 'lan@example.com', fullName: 'Trần Thị Lan' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
  });

  it('thấy cả đánh giá đang ẩn, mới nhất trước', async () => {
    const token = await signInAdmin();
    await seedReview({ comment: 'Cũ', createdAt: new Date('2026-10-01T00:00:00Z') });
    await seedReview({
      comment: 'Ẩn',
      isHidden: true,
      createdAt: new Date('2026-10-10T00:00:00Z'),
    });

    const res = await list(token);

    expect(res.body.items.map((item) => item.comment)).toEqual(['Ẩn', 'Cũ']);
  });

  it('lọc theo trạng thái ẩn/hiện và số sao', async () => {
    const token = await signInAdmin();
    await seedReview({ rating: 5 });
    await seedReview({ rating: 1, isHidden: true });
    await seedReview({ rating: 1 });

    expect((await list(token, '?status=hidden')).body.total).toBe(1);
    expect((await list(token, '?status=visible')).body.total).toBe(2);
    expect((await list(token, '?rating=1')).body.total).toBe(2);
    expect((await list(token, '?rating=1&status=visible')).body.total).toBe(1);
  });

  it('tìm theo tên sản phẩm, email, tên người viết hoặc nội dung, không phân biệt hoa thường', async () => {
    const token = await signInAdmin();
    const other = await createProduct({
      categoryId: product.categoryId,
      brandId: product.brandId,
      sku: 'SKU-2',
    });
    await prisma.product.update({ where: { id: other.id }, data: { name: 'Tai nghe Xyz' } });
    await seedReview({ forProduct: other, comment: 'Âm thanh tuyệt' });
    await seedReview({ email: 'thao@example.com', fullName: 'Lê Thảo', comment: 'Ổn' });

    const total = async (search) =>
      (await list(token, `?search=${encodeURIComponent(search)}`)).body.total;

    expect(await total('tai nghe xyz')).toBe(1);
    expect(await total('THAO@EXAMPLE')).toBe(1);
    expect(await total('lê thảo')).toBe(1);
    expect(await total('tuyệt')).toBe(1);
    expect(await total('không-có-gì')).toBe(0);
  });

  it('"%" và "_" trong từ khóa tìm đúng ký tự đó chứ không khớp tất cả', async () => {
    const token = await signInAdmin();
    await seedReview({ comment: 'Giảm 50% giá' });
    await seedReview({ comment: 'Bình thường' });

    expect((await list(token, '?search=%25')).body.total).toBe(1);
    expect((await list(token, '?search=_')).body.total).toBe(0);
  });

  it('phân trang', async () => {
    const token = await signInAdmin();
    for (let i = 0; i < 12; i += 1) await seedReview();

    const first = await list(token, '?pageSize=10');
    const second = await list(token, '?pageSize=10&page=2');

    expect(first.body.items).toHaveLength(10);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.total).toBe(12);
  });

  it.each(['?status=abc', '?rating=0', '?rating=6', '?page=0', '?pageSize=51'])(
    'tham số sai %s thì 400',
    async (query) => {
      const token = await signInAdmin();
      expect((await list(token, query)).status).toBe(400);
    },
  );
});

describe('PATCH /api/admin/reviews/:id/visibility (US-23)', () => {
  const publicList = () => request(app).get(`/api/products/${product.slug}/reviews`);

  it('ẩn đánh giá: biến mất khỏi Client và không tính vào điểm trung bình (AC1)', async () => {
    const token = await signInAdmin();
    const good = await seedReview({ rating: 5 });
    const bad = await seedReview({ rating: 1, comment: 'Lời lẽ vi phạm' });
    expect((await publicList()).body.summary).toMatchObject({ average: 3, count: 2 });

    const res = await setHidden(token, bad.id, { isHidden: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: bad.id, isHidden: true });
    const after = (await publicList()).body;
    expect(after.items.map((item) => item.id)).toEqual([good.id]);
    expect(after.summary).toMatchObject({ average: 5, count: 1 });
    const detail = await request(app).get(`/api/products/${product.slug}`);
    expect(detail.body.rating).toMatchObject({ average: 5, count: 1 });
  });

  it('bỏ ẩn thì hiện lại và tính lại điểm', async () => {
    const token = await signInAdmin();
    const review = await seedReview({ rating: 1, isHidden: true });
    expect((await publicList()).body.total).toBe(0);

    const res = await setHidden(token, review.id, { isHidden: false });

    expect(res.body.isHidden).toBe(false);
    expect((await publicList()).body.summary).toMatchObject({ average: 1, count: 1 });
  });

  it('đặt lại đúng trạng thái đang có vẫn thành công', async () => {
    const token = await signInAdmin();
    const review = await seedReview({ isHidden: true });

    const res = await setHidden(token, review.id, { isHidden: true });

    expect(res.status).toBe(200);
    expect(res.body.isHidden).toBe(true);
  });

  it('không đụng tới nội dung đánh giá', async () => {
    const token = await signInAdmin();
    const review = await seedReview({ rating: 3, comment: 'Giữ nguyên' });

    await setHidden(token, review.id, { isHidden: true });

    expect(await prisma.review.findUnique({ where: { id: review.id } })).toMatchObject({
      rating: 3,
      comment: 'Giữ nguyên',
      userId: review.userId,
    });
  });

  it('không có đánh giá thì 404', async () => {
    const token = await signInAdmin();
    const res = await setHidden(token, 9999, { isHidden: true });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('REVIEW_NOT_FOUND');
  });

  it('id sai hoặc isHidden không phải boolean thì 400', async () => {
    const token = await signInAdmin();
    const review = await seedReview();

    expect((await setHidden(token, 'abc', { isHidden: true })).status).toBe(400);
    expect((await setHidden(token, review.id, { isHidden: 'true' })).status).toBe(400);
    expect((await setHidden(token, review.id, {})).status).toBe(400);
    expect((await prisma.review.findUnique({ where: { id: review.id } })).isHidden).toBe(false);
  });
});
