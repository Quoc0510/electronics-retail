/**
 * @feature [F03] Sản phẩm - Kiểm thử tải lên, sắp xếp và xóa ảnh sản phẩm (US-08 AC6).
 * File được ghi vào thư mục tạm (UPLOAD_DIR của môi trường test), không đụng tới backend/uploads.
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

// Các "ảnh" giả chỉ có chữ ký đầu file đúng loại (đủ để backend nhận diện)
const png = () =>
  Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const webp = () =>
  Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(64)]);

const adminAuth = async () => {
  await createUser({ email: 'admin@example.com', role: 'ADMIN' });
  const { accessToken } = await loginAs(request, app, 'admin@example.com');
  return { Authorization: `Bearer ${accessToken}` };
};

const createProduct = async (sku = 'SKU-1') => {
  const category = await prisma.category.upsert({
    where: { slug: 'dien-thoai' },
    update: {},
    create: { name: 'Điện thoại', slug: 'dien-thoai' },
  });
  const brand = await prisma.brand.upsert({
    where: { slug: 'apple' },
    update: {},
    create: { name: 'Apple', slug: 'apple' },
  });
  return prisma.product.create({
    data: {
      sku,
      name: `Sản phẩm ${sku}`,
      slug: sku.toLowerCase(),
      price: 1000000,
      categoryId: category.id,
      brandId: brand.id,
    },
  });
};

// Gửi các file lên: files là mảng [buffer, tên file]
const upload = (auth, productId, files) => {
  const req = request(app).post(`/api/admin/products/${productId}/images`).set(auth);
  files.forEach(([buffer, filename]) => req.attach('images', buffer, { filename }));
  return req;
};

const filePathOf = (imageUrl) => path.join(env.uploadDir, imageUrl.replace('/uploads/', ''));

describe('tải ảnh lên', () => {
  it('nhận jpg, png, webp; lưu file thật; ảnh đầu tiên là ảnh đại diện', async () => {
    const auth = await adminAuth();
    const product = await createProduct();

    const res = await upload(auth, product.id, [
      [png(), 'a.png'],
      [jpg(), 'b.jpg'],
      [webp(), 'c.webp'],
    ]);

    expect(res.status).toBe(201);
    expect(res.body.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
    expect(res.body.map((i) => path.extname(i.url))).toEqual(['.png', '.jpg', '.webp']);
    res.body.forEach((image) => expect(fs.existsSync(filePathOf(image.url))).toBe(true));
  });

  it('đặt tên file do hệ thống sinh, không dùng tên người dùng gửi (chống ghi đè và chèn đường dẫn)', async () => {
    const auth = await adminAuth();
    const product = await createProduct();

    const res = await upload(auth, product.id, [[png(), '../../../evil.png']]);

    expect(res.status).toBe(201);
    expect(res.body[0].url).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.png$/);
    expect(fs.existsSync(path.join(env.uploadDir, '..', '..', 'evil.png'))).toBe(false);
  });

  it('ảnh tải lên được phục vụ lại qua /uploads, cho phép tải chéo origin', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    const uploaded = await upload(auth, product.id, [[png(), 'a.png']]);

    const res = await request(app).get(uploaded.body[0].url);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('ảnh mới thêm xếp sau các ảnh đã có', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    await upload(auth, product.id, [[png(), 'a.png']]);

    const res = await upload(auth, product.id, [[jpg(), 'b.jpg']]);

    expect(res.body.map((i) => i.sortOrder)).toEqual([0, 1]);
  });

  it('từ chối file không phải ảnh dù đã đổi đuôi thành .jpg, và không lưu gì', async () => {
    const auth = await adminAuth();
    const product = await createProduct();

    const res = await upload(auth, product.id, [
      [png(), 'tot.png'],
      [Buffer.from('<script>alert(1)</script>'), 'fake.jpg'],
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE_TYPE');
    expect(await prisma.productImage.count()).toBe(0);
  });

  it('từ chối ảnh lớn hơn 2MB', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    const big = Buffer.concat([png(), Buffer.alloc(2 * 1024 * 1024)]);

    const res = await upload(auth, product.id, [[big, 'big.png']]);

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('IMAGE_TOO_LARGE');
  });

  it('nhận ảnh đúng 2MB (giới hạn dưới ngưỡng)', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    const exact = Buffer.concat([png(), Buffer.alloc(2 * 1024 * 1024 - png().length)]);

    const res = await upload(auth, product.id, [[exact, 'exact.png']]);

    expect(res.status).toBe(201);
  });

  it('từ chối khi một lần gửi quá 6 ảnh', async () => {
    const auth = await adminAuth();
    const product = await createProduct();

    const res = await upload(
      auth,
      product.id,
      Array.from({ length: 7 }, (_, i) => [png(), `${i}.png`]),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_IMAGES');
    expect(await prisma.productImage.count()).toBe(0);
  });

  it('tối đa 6 ảnh mỗi sản phẩm: thêm vượt quá thì từ chối cả lượt, không lưu ảnh nào của lượt đó', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    await upload(
      auth,
      product.id,
      Array.from({ length: 5 }, (_, i) => [png(), `${i}.png`]),
    );

    const tooMany = await upload(auth, product.id, [
      [png(), 'x.png'],
      [png(), 'y.png'],
    ]);
    const exactlyOne = await upload(auth, product.id, [[png(), 'z.png']]);

    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error.message).toMatch(/tối đa 6 ảnh/);
    expect(exactlyOne.status).toBe(201);
    expect(await prisma.productImage.count()).toBe(6);
  });

  it('không chọn file nào trả 400', async () => {
    const auth = await adminAuth();
    const product = await createProduct();

    const res = await request(app).post(`/api/admin/products/${product.id}/images`).set(auth);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_FILE');
  });

  it('sản phẩm không tồn tại trả 404', async () => {
    const auth = await adminAuth();

    const res = await upload(auth, 999999, [[png(), 'a.png']]);

    expect(res.status).toBe(404);
  });
});

describe('sắp xếp ảnh', () => {
  const setup = async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    const uploaded = await upload(auth, product.id, [
      [png(), 'a.png'],
      [jpg(), 'b.jpg'],
      [webp(), 'c.webp'],
    ]);
    return { auth, product, ids: uploaded.body.map((i) => i.id) };
  };

  it('đổi thứ tự, ảnh đầu danh sách mới thành ảnh đại diện', async () => {
    const { auth, product, ids } = await setup();
    const reversed = [...ids].reverse();

    const res = await request(app)
      .put(`/api/admin/products/${product.id}/images/order`)
      .set(auth)
      .send({ imageIds: reversed });

    expect(res.status).toBe(200);
    expect(res.body.map((i) => i.id)).toEqual(reversed);
    expect(res.body.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it.each([
    ['thiếu một ảnh', (ids) => ids.slice(1)],
    ['thừa một ảnh lạ', (ids) => [...ids, 999999]],
    ['trùng ảnh', (ids) => [ids[0], ids[0], ids[1]]],
  ])('từ chối danh sách %s', async (_name, build) => {
    const { auth, product, ids } = await setup();

    const res = await request(app)
      .put(`/api/admin/products/${product.id}/images/order`)
      .set(auth)
      .send({ imageIds: build(ids) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE_ORDER');
  });

  it('không sắp xếp bằng ảnh của sản phẩm khác', async () => {
    const { auth, ids } = await setup();
    const other = await createProduct('SKU-2');

    const res = await request(app)
      .put(`/api/admin/products/${other.id}/images/order`)
      .set(auth)
      .send({ imageIds: ids });

    expect(res.status).toBe(400);
  });
});

describe('xóa ảnh', () => {
  it('xóa dòng trong DB và file trên đĩa', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    const uploaded = await upload(auth, product.id, [
      [png(), 'a.png'],
      [jpg(), 'b.jpg'],
    ]);
    const [first, second] = uploaded.body;

    const res = await request(app)
      .delete(`/api/admin/products/${product.id}/images/${first.id}`)
      .set(auth);

    expect(res.status).toBe(204);
    expect(fs.existsSync(filePathOf(first.url))).toBe(false);
    expect(fs.existsSync(filePathOf(second.url))).toBe(true);
    expect(await prisma.productImage.count()).toBe(1);
  });

  it('không xóa được ảnh qua sản phẩm khác (trả 404)', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    const other = await createProduct('SKU-2');
    const uploaded = await upload(auth, product.id, [[png(), 'a.png']]);

    const res = await request(app)
      .delete(`/api/admin/products/${other.id}/images/${uploaded.body[0].id}`)
      .set(auth);

    expect(res.status).toBe(404);
    expect(await prisma.productImage.count()).toBe(1);
  });

  it('xóa ảnh ngoài (đường dẫn http, ví dụ dữ liệu mẫu) chỉ xóa trong DB, không lỗi', async () => {
    const auth = await adminAuth();
    const product = await createProduct();
    const image = await prisma.productImage.create({
      data: { productId: product.id, url: 'https://placehold.co/600x600?text=Demo' },
    });

    const res = await request(app)
      .delete(`/api/admin/products/${product.id}/images/${image.id}`)
      .set(auth);

    expect(res.status).toBe(204);
  });

  it('xóa ảnh không tồn tại trả 404', async () => {
    const auth = await adminAuth();
    const product = await createProduct();

    const res = await request(app)
      .delete(`/api/admin/products/${product.id}/images/999999`)
      .set(auth);

    expect(res.status).toBe(404);
  });
});
