/**
 * @feature [F02] Danh mục và thương hiệu - Kiểm thử API quản trị và API công khai (US-06, US-07).
 * Danh mục và thương hiệu có cùng quy tắc nên cùng một bộ test chạy cho cả hai (describe.each).
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createProduct, createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// Thông tin khác nhau giữa hai loại
const resources = [
  { label: 'danh mục', path: 'categories', model: 'category', urlField: 'imageUrl' },
  { label: 'thương hiệu', path: 'brands', model: 'brand', urlField: 'logoUrl' },
];

// Đăng nhập admin và trả về header Authorization
const adminAuth = async () => {
  await createUser({ email: 'admin@example.com', role: 'ADMIN' });
  const { accessToken } = await loginAs(request, app, 'admin@example.com');
  return { Authorization: `Bearer ${accessToken}` };
};

// Tạo một danh mục và một thương hiệu để gắn vào sản phẩm
const createParents = async () => {
  const category = await prisma.category.create({
    data: { name: 'Điện thoại', slug: 'dien-thoai' },
  });
  const brand = await prisma.brand.create({ data: { name: 'Apple', slug: 'apple' } });
  return { categoryId: category.id, brandId: brand.id };
};

describe.each(resources)(
  'Quản lý $label (/api/admin/$path)',
  ({ label, path, model, urlField }) => {
    const url = `/api/admin/${path}`;

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
          request(app).post(url).set(auth).send({ name: 'Mới' }),
          request(app).patch(`${url}/1`).set(auth).send({ name: 'Sửa' }),
          request(app).delete(`${url}/1`).set(auth),
        ]);

        expect(results.map((r) => r.status)).toEqual([403, 403, 403, 403]);
      });
    });

    describe('tạo mới', () => {
      it('tạo thành công, tự sinh slug từ tên tiếng Việt, mặc định đang hiện', async () => {
        const auth = await adminAuth();
        const res = await request(app).post(url).set(auth).send({ name: 'Điện thoại thông minh' });

        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
          name: 'Điện thoại thông minh',
          slug: 'dien-thoai-thong-minh',
          isActive: true,
          productCount: 0,
        });
      });

      it('lưu được đường dẫn ảnh/logo hợp lệ và xóa được bằng chuỗi rỗng', async () => {
        const auth = await adminAuth();
        const created = await request(app)
          .post(url)
          .set(auth)
          .send({ name: 'Có ảnh', [urlField]: 'https://example.com/a.png' });
        expect(created.body[urlField]).toBe('https://example.com/a.png');

        const cleared = await request(app)
          .patch(`${url}/${created.body.id}`)
          .set(auth)
          .send({ [urlField]: '' });
        expect(cleared.body[urlField]).toBeNull();
      });

      it('AC1: từ chối tên trùng, không phân biệt hoa thường và khoảng trắng', async () => {
        const auth = await adminAuth();
        await request(app).post(url).set(auth).send({ name: 'Laptop' });

        const same = await request(app).post(url).set(auth).send({ name: 'Laptop' });
        const differentCase = await request(app).post(url).set(auth).send({ name: '  laptop ' });

        expect(same.status).toBe(409);
        expect(same.body.error.code).toBe('NAME_TAKEN');
        expect(differentCase.status).toBe(409);
      });

      it('từ chối hai tên khác nhau nhưng cùng slug (Laptop và Laptop!)', async () => {
        const auth = await adminAuth();
        await request(app).post(url).set(auth).send({ name: 'Laptop' });

        const res = await request(app).post(url).set(auth).send({ name: 'Laptop!' });

        expect(res.status).toBe(409);
      });

      it.each([
        ['tên trống', { name: '   ' }, 'name'],
        ['thiếu tên', {}, 'name'],
        ['tên quá dài', { name: 'a'.repeat(101) }, 'name'],
        [
          'đường dẫn ảnh không phải http(s)',
          { name: 'X', [urlField]: 'javascript:alert(1)' },
          urlField,
        ],
        ['đường dẫn ảnh sai định dạng', { name: 'X', [urlField]: 'khong-phai-url' }, urlField],
      ])('từ chối dữ liệu sai: %s', async (_name, body, field) => {
        const auth = await adminAuth();
        const res = await request(app).post(url).set(auth).send(body);

        expect(res.status).toBe(400);
        expect(res.body.error.details[field]).toBeDefined();
      });

      it('từ chối tên chỉ gồm ký tự đặc biệt vì không tạo được slug', async () => {
        const auth = await adminAuth();
        const res = await request(app).post(url).set(auth).send({ name: '***' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_NAME');
      });
    });

    describe('xem danh sách và chi tiết', () => {
      it('danh sách sắp theo tên, có cả mục đang ẩn và số sản phẩm', async () => {
        const auth = await adminAuth();
        await prisma[model].create({ data: { name: 'Bbb', slug: 'bbb' } });
        await prisma[model].create({ data: { name: 'Aaa', slug: 'aaa', isActive: false } });

        const res = await request(app).get(url).set(auth);

        expect(res.status).toBe(200);
        expect(res.body.map((i) => i.name)).toEqual(['Aaa', 'Bbb']);
        expect(res.body[0].isActive).toBe(false);
        expect(res.body[0].productCount).toBe(0);
      });

      it('tìm theo tên không phân biệt hoa thường', async () => {
        const auth = await adminAuth();
        await prisma[model].create({ data: { name: 'Samsung', slug: 'samsung' } });
        await prisma[model].create({ data: { name: 'Sony', slug: 'sony' } });

        const res = await request(app).get(`${url}?search=SAM`).set(auth);

        expect(res.body.map((i) => i.name)).toEqual(['Samsung']);
      });

      it('xem chi tiết một mục, mục không tồn tại trả 404', async () => {
        const auth = await adminAuth();
        const item = await prisma[model].create({ data: { name: 'Một', slug: 'mot' } });

        const found = await request(app).get(`${url}/${item.id}`).set(auth);
        const missing = await request(app).get(`${url}/999999`).set(auth);

        expect(found.body.name).toBe('Một');
        expect(missing.status).toBe(404);
        expect(missing.body.error.message).toBe(`Không tìm thấy ${label}`);
      });

      it('id không phải số trả 400', async () => {
        const auth = await adminAuth();
        const res = await request(app).get(`${url}/abc`).set(auth);

        expect(res.status).toBe(400);
      });
    });

    describe('sửa và ẩn/hiện', () => {
      it('đổi tên thì slug đổi theo', async () => {
        const auth = await adminAuth();
        const created = await request(app).post(url).set(auth).send({ name: 'Tên cũ' });

        const res = await request(app)
          .patch(`${url}/${created.body.id}`)
          .set(auth)
          .send({ name: 'Tên mới' });

        expect(res.status).toBe(200);
        expect(res.body.slug).toBe('ten-moi');
      });

      it('giữ nguyên tên của chính mình khi sửa trường khác (không báo trùng với chính nó)', async () => {
        const auth = await adminAuth();
        const created = await request(app).post(url).set(auth).send({ name: 'Giữ tên' });

        const res = await request(app)
          .patch(`${url}/${created.body.id}`)
          .set(auth)
          .send({ name: 'Giữ tên', isActive: false });

        expect(res.status).toBe(200);
        expect(res.body.isActive).toBe(false);
      });

      it('không đổi sang tên của mục khác', async () => {
        const auth = await adminAuth();
        await request(app).post(url).set(auth).send({ name: 'Mục A' });
        const b = await request(app).post(url).set(auth).send({ name: 'Mục B' });

        const res = await request(app)
          .patch(`${url}/${b.body.id}`)
          .set(auth)
          .send({ name: 'mục a' });

        expect(res.status).toBe(409);
      });

      it('ẩn rồi hiện lại', async () => {
        const auth = await adminAuth();
        const created = await request(app).post(url).set(auth).send({ name: 'Bật tắt' });

        const hidden = await request(app)
          .patch(`${url}/${created.body.id}`)
          .set(auth)
          .send({ isActive: false });
        const shown = await request(app)
          .patch(`${url}/${created.body.id}`)
          .set(auth)
          .send({ isActive: true });

        expect(hidden.body.isActive).toBe(false);
        expect(shown.body.isActive).toBe(true);
      });

      it('sửa mục không tồn tại trả 404; gửi body rỗng trả 400', async () => {
        const auth = await adminAuth();
        const created = await request(app).post(url).set(auth).send({ name: 'Có thật' });

        const missing = await request(app).patch(`${url}/999999`).set(auth).send({ name: 'X' });
        const empty = await request(app).patch(`${url}/${created.body.id}`).set(auth).send({});

        expect(missing.status).toBe(404);
        expect(empty.status).toBe(400);
      });
    });

    describe('xóa (US-06 AC2, BR-09)', () => {
      it('xóa được khi chưa có sản phẩm', async () => {
        const auth = await adminAuth();
        const created = await request(app).post(url).set(auth).send({ name: 'Xóa được' });

        const del = await request(app).delete(`${url}/${created.body.id}`).set(auth);
        const after = await request(app).get(`${url}/${created.body.id}`).set(auth);

        expect(del.status).toBe(204);
        expect(after.status).toBe(404);
      });

      it('trả 409 khi đã có sản phẩm, dữ liệu vẫn còn, và vẫn ẩn được', async () => {
        const auth = await adminAuth();
        const parents = await createParents();
        await createProduct(parents);
        const id = parents[path === 'categories' ? 'categoryId' : 'brandId'];

        const del = await request(app).delete(`${url}/${id}`).set(auth);
        const hide = await request(app).patch(`${url}/${id}`).set(auth).send({ isActive: false });
        const detail = await request(app).get(`${url}/${id}`).set(auth);

        expect(del.status).toBe(409);
        expect(del.body.error.code).toBe('HAS_PRODUCTS');
        expect(hide.status).toBe(200);
        expect(detail.body.productCount).toBe(1);
      });

      it('xóa mục không tồn tại trả 404', async () => {
        const auth = await adminAuth();
        const res = await request(app).delete(`${url}/999999`).set(auth);

        expect(res.status).toBe(404);
      });
    });
  },
);

describe.each(resources)(
  'Xem $label ở website khách hàng (GET /api/$path)',
  ({ path, model, urlField }) => {
    it('không cần đăng nhập, chỉ trả mục đang hiện (US-06 AC3) và không lộ trường nội bộ', async () => {
      await prisma[model].create({
        data: { name: 'Hiện', slug: 'hien', [urlField]: 'https://example.com/a.png' },
      });
      await prisma[model].create({ data: { name: 'Ẩn', slug: 'an', isActive: false } });

      const res = await request(app).get(`/api/${path}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ name: 'Hiện', slug: 'hien', productCount: 0 });
      expect(res.body[0]).not.toHaveProperty('isActive');
      expect(res.body[0]).not.toHaveProperty('createdAt');
    });

    it('số sản phẩm chỉ tính sản phẩm đang bán', async () => {
      const parents = await createParents();
      await createProduct({ ...parents, sku: 'A' });
      await createProduct({ ...parents, sku: 'B', isActive: false });

      const res = await request(app).get(`/api/${path}`);

      expect(res.body[0].productCount).toBe(1);
    });

    it('trả mảng rỗng khi chưa có dữ liệu', async () => {
      const res = await request(app).get(`/api/${path}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  },
);
