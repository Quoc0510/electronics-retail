/**
 * @feature [F04] Duyệt và tìm sản phẩm - Kiểm thử API công khai /api/products (US-10 → US-13).
 * Không cần đăng nhập: các test không gửi token.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// Tạo danh mục và thương hiệu, trả về id để gắn vào sản phẩm
const makeCategory = (name, slug, isActive = true) =>
  prisma.category.create({ data: { name, slug, isActive } });
const makeBrand = (name, slug, isActive = true) =>
  prisma.brand.create({ data: { name, slug, isActive } });

let counter = 0;
const makeProduct = async ({ category, brand, name = 'Sản phẩm', ...overrides }) => {
  counter += 1;
  return prisma.product.create({
    data: {
      sku: `SKU-${counter}`,
      name,
      slug: `san-pham-${counter}`,
      price: 1000000,
      stock: 5,
      categoryId: category.id,
      brandId: brand.id,
      ...overrides,
    },
  });
};

// Bộ dữ liệu dùng chung cho nhóm test danh sách
const seed = async () => {
  const phone = await makeCategory('Điện thoại', 'dien-thoai');
  const laptop = await makeCategory('Laptop', 'laptop');
  const apple = await makeBrand('Apple', 'apple');
  const dell = await makeBrand('Dell', 'dell');

  const iphone = await makeProduct({
    category: phone,
    brand: apple,
    name: 'iPhone 15',
    price: 20000000,
    salePrice: 18000000,
  });
  const iphonePro = await makeProduct({
    category: phone,
    brand: apple,
    name: 'iPhone 15 Pro',
    price: 30000000,
  });
  const xps = await makeProduct({
    category: laptop,
    brand: dell,
    name: 'Dell XPS 13',
    price: 25000000,
    salePrice: 22000000,
  });
  const cable = await makeProduct({
    category: phone,
    brand: apple,
    name: 'Cáp sạc 100%',
    price: 300000,
    stock: 0,
  });
  return { phone, laptop, apple, dell, iphone, iphonePro, xps, cable };
};

const names = (res) => res.body.items.map((item) => item.name);

describe('GET /api/products - danh sách', () => {
  it('không cần đăng nhập và trả dữ liệu phân trang mặc định 12 sản phẩm/trang (US-11 AC3)', async () => {
    await seed();

    const res = await request(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 12, total: 4 });
    expect(res.body.items).toHaveLength(4);
  });

  it('mỗi sản phẩm chỉ có thông tin cần cho khách, không lộ tồn kho, SKU, trạng thái ẩn/hiện', async () => {
    await seed();

    const res = await request(app).get('/api/products?search=iphone 15 pro');

    expect(res.body.items[0]).toEqual({
      id: expect.any(Number),
      name: 'iPhone 15 Pro',
      slug: expect.any(String),
      price: 30000000,
      salePrice: null,
      inStock: true,
      thumbnail: null,
      category: { name: 'Điện thoại', slug: 'dien-thoai' },
      brand: { name: 'Apple', slug: 'apple' },
    });
  });

  it('inStock là false khi hết hàng', async () => {
    await seed();

    const res = await request(app).get('/api/products?search=Cáp');

    expect(res.body.items[0].inStock).toBe(false);
  });

  it('ảnh đại diện là ảnh có sortOrder nhỏ nhất', async () => {
    const { iphone } = await seed();
    await prisma.productImage.createMany({
      data: [
        { productId: iphone.id, url: '/uploads/products/second.png', sortOrder: 1 },
        { productId: iphone.id, url: '/uploads/products/first.png', sortOrder: 0 },
      ],
    });

    const res = await request(app).get('/api/products?search=iPhone 15&sort=price_asc');

    expect(res.body.items[0].thumbnail).toBe('/uploads/products/first.png');
  });

  describe('chỉ hiện những gì khách được xem (US-06 AC3, US-09 AC1)', () => {
    it('ẩn sản phẩm đang ẩn', async () => {
      const { iphone } = await seed();
      await prisma.product.update({ where: { id: iphone.id }, data: { isActive: false } });

      const res = await request(app).get('/api/products');

      expect(names(res)).not.toContain('iPhone 15');
      expect(res.body.total).toBe(3);
    });

    it('ẩn sản phẩm thuộc danh mục đang ẩn', async () => {
      const { laptop } = await seed();
      await prisma.category.update({ where: { id: laptop.id }, data: { isActive: false } });

      const res = await request(app).get('/api/products');

      expect(names(res)).not.toContain('Dell XPS 13');
    });

    it('ẩn sản phẩm thuộc thương hiệu đang ẩn', async () => {
      const { dell } = await seed();
      await prisma.brand.update({ where: { id: dell.id }, data: { isActive: false } });

      const res = await request(app).get('/api/products');

      expect(names(res)).not.toContain('Dell XPS 13');
    });
  });

  describe('sắp xếp (US-11 AC2)', () => {
    it('mặc định: mới nhất trước', async () => {
      await seed();

      const res = await request(app).get('/api/products');

      expect(names(res)).toEqual(['Cáp sạc 100%', 'Dell XPS 13', 'iPhone 15 Pro', 'iPhone 15']);
    });

    it('giá tăng dần theo GIÁ BÁN HIỆN HÀNH (khuyến mãi nếu có)', async () => {
      await seed();

      const res = await request(app).get('/api/products?sort=price_asc');

      // 300k, 18tr (iPhone 15 giảm từ 20tr), 22tr (XPS giảm từ 25tr), 30tr
      expect(names(res)).toEqual(['Cáp sạc 100%', 'iPhone 15', 'Dell XPS 13', 'iPhone 15 Pro']);
    });

    it('giá giảm dần theo giá bán hiện hành', async () => {
      await seed();

      const res = await request(app).get('/api/products?sort=price_desc');

      expect(names(res)).toEqual(['iPhone 15 Pro', 'Dell XPS 13', 'iPhone 15', 'Cáp sạc 100%']);
    });
  });

  describe('lọc (US-11 AC1)', () => {
    it('theo danh mục (slug)', async () => {
      await seed();

      const res = await request(app).get('/api/products?category=laptop');

      expect(names(res)).toEqual(['Dell XPS 13']);
    });

    it('theo thương hiệu (slug)', async () => {
      await seed();

      const res = await request(app).get('/api/products?brand=apple&sort=price_asc');

      expect(names(res)).toEqual(['Cáp sạc 100%', 'iPhone 15', 'iPhone 15 Pro']);
    });

    it('chỉ sản phẩm đang khuyến mãi (onSale=true)', async () => {
      await seed();

      const res = await request(app).get('/api/products?onSale=true&sort=price_asc');

      expect(names(res)).toEqual(['iPhone 15', 'Dell XPS 13']);
    });

    it('onSale chỉ nhận giá trị true', async () => {
      await seed();

      const res = await request(app).get('/api/products?onSale=false');

      expect(res.status).toBe(400);
    });

    it('theo khoảng giá, tính trên giá bán hiện hành', async () => {
      await seed();

      // iPhone 15 giá gốc 20tr nhưng đang giảm còn 18tr nên nằm trong khoảng 15tr - 19tr
      const res = await request(app).get('/api/products?minPrice=15000000&maxPrice=19000000');

      expect(names(res)).toEqual(['iPhone 15']);
    });

    it('chỉ có giá tối thiểu hoặc chỉ có giá tối đa', async () => {
      await seed();

      const min = await request(app).get('/api/products?minPrice=25000000');
      const max = await request(app).get('/api/products?maxPrice=1000000');

      expect(names(min)).toEqual(['iPhone 15 Pro']);
      expect(names(max)).toEqual(['Cáp sạc 100%']);
    });

    it('kết hợp nhiều bộ lọc cùng lúc', async () => {
      await seed();

      const res = await request(app).get(
        '/api/products?category=dien-thoai&brand=apple&minPrice=1000000&sort=price_desc',
      );

      expect(names(res)).toEqual(['iPhone 15 Pro', 'iPhone 15']);
    });

    it('ô giá để trống (?minPrice=&maxPrice=) được coi là không lọc', async () => {
      await seed();

      const res = await request(app).get('/api/products?minPrice=&maxPrice=');

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(4);
    });

    it('danh mục không tồn tại trả danh sách rỗng, không lỗi', async () => {
      await seed();

      const res = await request(app).get('/api/products?category=khong-co');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ items: [], total: 0 });
    });
  });

  describe('tìm kiếm (US-12)', () => {
    it('không phân biệt hoa thường, khớp một phần tên (AC1)', async () => {
      await seed();

      const res = await request(app).get('/api/products?search=IPHONE&sort=price_asc');

      expect(names(res)).toEqual(['iPhone 15', 'iPhone 15 Pro']);
    });

    it('từ khóa rỗng hoặc toàn khoảng trắng trả toàn bộ danh sách (AC3)', async () => {
      await seed();

      const empty = await request(app).get('/api/products?search=');
      const spaces = await request(app).get('/api/products?search=%20%20');

      expect(empty.body.total).toBe(4);
      expect(spaces.body.total).toBe(4);
    });

    it('ký tự đặc biệt của LIKE được tìm đúng nghĩa: "%" không khớp mọi thứ', async () => {
      await seed();

      const percent = await request(app).get('/api/products?search=100%25');
      const onlyPercent = await request(app).get('/api/products?search=%25');
      const underscore = await request(app).get('/api/products?search=_');

      expect(names(percent)).toEqual(['Cáp sạc 100%']);
      expect(names(onlyPercent)).toEqual(['Cáp sạc 100%']);
      expect(underscore.body.total).toBe(0);
    });

    it('chống SQL injection: chuỗi tấn công chỉ là từ khóa không khớp, bảng vẫn còn nguyên', async () => {
      await seed();

      const res = await request(app).get(
        `/api/products?search=${encodeURIComponent("'; DROP TABLE products; --")}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(await prisma.product.count()).toBe(4);
    });

    it('kết hợp tìm kiếm với bộ lọc và không có kết quả', async () => {
      await seed();

      const res = await request(app).get('/api/products?search=iphone&category=laptop');

      expect(res.body.items).toEqual([]);
    });
  });

  describe('phân trang (US-11 AC3)', () => {
    it('trang 2 và tổng số kết quả', async () => {
      await seed();

      const res = await request(app).get('/api/products?pageSize=3&page=2&sort=price_asc');

      expect(res.body).toMatchObject({ page: 2, pageSize: 3, total: 4 });
      expect(names(res)).toEqual(['iPhone 15 Pro']);
    });

    it('trang vượt quá số trang trả mảng rỗng nhưng vẫn có tổng số', async () => {
      await seed();

      const res = await request(app).get('/api/products?page=99');

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(4);
    });
  });

  it.each([
    ['page=0'],
    ['page=abc'],
    ['pageSize=0'],
    ['pageSize=49'],
    ['sort=ngau-nhien'],
    ['minPrice=-1'],
    ['minPrice=1.5'],
    ['minPrice=abc'],
    ['minPrice=5000&maxPrice=1000'],
    [`search=${'a'.repeat(101)}`],
  ])('từ chối tham số sai: %s', async (query) => {
    const res = await request(app).get(`/api/products?${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/products/:slug - chi tiết (US-13)', () => {
  it('trả đủ thông tin kèm thông số, mô tả và danh sách ảnh theo thứ tự', async () => {
    const { phone, apple } = await seed();
    const product = await makeProduct({
      category: phone,
      brand: apple,
      name: 'iPhone 16',
      description: 'Mô tả chi tiết',
      specs: { Chip: 'A18', RAM: '8GB' },
      price: 25000000,
      salePrice: 23000000,
    });
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: '/uploads/products/b.png', sortOrder: 1 },
        { productId: product.id, url: '/uploads/products/a.png', sortOrder: 0 },
      ],
    });

    const res = await request(app).get(`/api/products/${product.slug}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: product.id,
      name: 'iPhone 16',
      description: 'Mô tả chi tiết',
      specs: { Chip: 'A18', RAM: '8GB' },
      price: 25000000,
      salePrice: 23000000,
      inStock: true,
      category: { name: 'Điện thoại', slug: 'dien-thoai' },
      brand: { name: 'Apple', slug: 'apple' },
    });
    expect(res.body.images.map((i) => i.url)).toEqual([
      '/uploads/products/a.png',
      '/uploads/products/b.png',
    ]);
    expect(res.body).not.toHaveProperty('stock');
    expect(res.body).not.toHaveProperty('isActive');
  });

  it('hết hàng: inStock false (AC2)', async () => {
    const { cable } = await seed();

    const res = await request(app).get(`/api/products/${cable.slug}`);

    expect(res.status).toBe(200);
    expect(res.body.inStock).toBe(false);
  });

  it('slug không tồn tại trả 404 (AC3)', async () => {
    const res = await request(app).get('/api/products/khong-ton-tai');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('sản phẩm đang ẩn trả 404 (AC3)', async () => {
    const { iphone } = await seed();
    await prisma.product.update({ where: { id: iphone.id }, data: { isActive: false } });

    const res = await request(app).get(`/api/products/${iphone.slug}`);

    expect(res.status).toBe(404);
  });

  it('sản phẩm thuộc danh mục hoặc thương hiệu đang ẩn trả 404', async () => {
    const { xps, iphone, laptop, apple } = await seed();
    await prisma.category.update({ where: { id: laptop.id }, data: { isActive: false } });
    await prisma.brand.update({ where: { id: apple.id }, data: { isActive: false } });

    const hiddenCategory = await request(app).get(`/api/products/${xps.slug}`);
    const hiddenBrand = await request(app).get(`/api/products/${iphone.slug}`);

    expect(hiddenCategory.status).toBe(404);
    expect(hiddenBrand.status).toBe(404);
  });
});
