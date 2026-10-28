/**
 * @feature [F05] Giỏ hàng - Kiểm thử API /api/cart (US-14, US-15, BR-02, BR-03, BR-11).
 * Chạy trên PostgreSQL thật (schema "test") để kiểm tra cả việc nhiều request cùng lúc không làm vượt tồn kho.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { clearCart } from '../src/services/cart.service.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

let counter = 0;
const makeProduct = async (overrides = {}) => {
  counter += 1;
  const { category: givenCategory, brand: givenBrand, ...rest } = overrides;
  const category =
    givenCategory ??
    (await prisma.category.create({
      data: { name: `Danh mục ${counter}`, slug: `dm-${counter}` },
    }));
  const brand =
    givenBrand ??
    (await prisma.brand.create({ data: { name: `Hãng ${counter}`, slug: `hang-${counter}` } }));
  return prisma.product.create({
    data: {
      sku: `SKU-${counter}`,
      name: `Sản phẩm ${counter}`,
      slug: `san-pham-${counter}`,
      price: 1000000,
      stock: 5,
      categoryId: category.id,
      brandId: brand.id,
      ...rest,
    },
  });
};

// Đăng ký người dùng và trả về access token + id
const signIn = async (email = 'khach@example.com') => {
  const user = await createUser({ email });
  const { accessToken } = await loginAs(request, app, email);
  return { user, token: accessToken };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const getCart = (token) => request(app).get('/api/cart').set(auth(token));
const addItem = (token, body) => request(app).post('/api/cart/items').set(auth(token)).send(body);
const patchItem = (token, id, body) =>
  request(app).patch(`/api/cart/items/${id}`).set(auth(token)).send(body);
const deleteItem = (token, id) => request(app).delete(`/api/cart/items/${id}`).set(auth(token));

describe('Yêu cầu đăng nhập (BR-11, US-14 AC1)', () => {
  it('chưa đăng nhập thì mọi thao tác giỏ hàng đều 401', async () => {
    const product = await makeProduct();

    expect((await request(app).get('/api/cart')).status).toBe(401);
    expect(
      (await request(app).post('/api/cart/items').send({ productId: product.id })).status,
    ).toBe(401);
    expect((await request(app).patch('/api/cart/items/1').send({ quantity: 2 })).status).toBe(401);
    expect((await request(app).delete('/api/cart/items/1')).status).toBe(401);
  });

  it('token sai thì 401', async () => {
    const res = await request(app).get('/api/cart').set(auth('khong-phai-token'));
    expect(res.status).toBe(401);
  });
});

describe('Xem giỏ hàng', () => {
  it('giỏ mới là giỏ trống và không cho phép thanh toán', async () => {
    const { token } = await signIn();

    const res = await getCart(token);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], totalQuantity: 0, subtotal: 0, canCheckout: false });
  });

  it('mỗi người dùng đúng một giỏ dù gọi nhiều lần (BR-11)', async () => {
    const { token } = await signIn();

    await getCart(token);
    await getCart(token);
    const product = await makeProduct();
    await addItem(token, { productId: product.id });

    expect(await prisma.cart.count()).toBe(1);
  });

  it('giỏ của mỗi người tách biệt', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct();
    await addItem(a.token, { productId: product.id, quantity: 2 });

    const cartB = await getCart(b.token);

    expect(cartB.body.items).toEqual([]);
    expect((await getCart(a.token)).body.totalQuantity).toBe(2);
  });
});

describe('Thêm vào giỏ (US-14)', () => {
  it('không gửi số lượng thì thêm 1; trả về dòng đầy đủ với đơn giá và thành tiền', async () => {
    const { token } = await signIn();
    const product = await makeProduct({ price: 2000000 });
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: '/uploads/b.png', sortOrder: 2 },
        { productId: product.id, url: '/uploads/a.png', sortOrder: 1 },
      ],
    });

    const res = await addItem(token, { productId: product.id });

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      productId: product.id,
      quantity: 1,
      unitPrice: 2000000,
      lineTotal: 2000000,
      stock: 5,
      status: 'OK',
      product: {
        name: product.name,
        slug: product.slug,
        price: 2000000,
        salePrice: null,
        thumbnail: '/uploads/a.png', // ảnh có sortOrder nhỏ nhất
      },
    });
    expect(res.body).toMatchObject({ totalQuantity: 1, subtotal: 2000000, canCheckout: true });
  });

  it('đơn giá là giá khuyến mãi nếu có (BR-02)', async () => {
    const { token } = await signIn();
    const product = await makeProduct({ price: 20000000, salePrice: 18000000 });

    const res = await addItem(token, { productId: product.id, quantity: 2 });

    expect(res.body.items[0]).toMatchObject({ unitPrice: 18000000, lineTotal: 36000000 });
    expect(res.body.subtotal).toBe(36000000);
  });

  it('thêm sản phẩm đã có thì cộng dồn số lượng, không tạo dòng mới (AC2)', async () => {
    const { token } = await signIn();
    const product = await makeProduct();

    await addItem(token, { productId: product.id, quantity: 2 });
    const res = await addItem(token, { productId: product.id, quantity: 1 });

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(3);
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it('tổng số lượng cộng mọi dòng (AC4); thứ tự dòng theo thời điểm thêm', async () => {
    const { token } = await signIn();
    const first = await makeProduct();
    const second = await makeProduct();

    await addItem(token, { productId: first.id, quantity: 2 });
    const res = await addItem(token, { productId: second.id, quantity: 3 });

    expect(res.body.totalQuantity).toBe(5);
    expect(res.body.items.map((item) => item.productId)).toEqual([first.id, second.id]);
  });

  describe('không vượt tồn kho (BR-03, AC3)', () => {
    it('thêm nhiều hơn tồn kho thì 409 và báo số còn lại, giỏ không đổi', async () => {
      const { token } = await signIn();
      const product = await makeProduct({ stock: 5 });

      const res = await addItem(token, { productId: product.id, quantity: 6 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
      expect(res.body.error.message).toBe('Chỉ còn 5 sản phẩm trong kho');
      expect((await getCart(token)).body.items).toEqual([]);
    });

    it('thêm đúng bằng tồn kho thì được', async () => {
      const { token } = await signIn();
      const product = await makeProduct({ stock: 5 });

      const res = await addItem(token, { productId: product.id, quantity: 5 });

      expect(res.status).toBe(200);
      expect(res.body.items[0].quantity).toBe(5);
    });

    it('cộng dồn vượt tồn kho thì báo cả số còn lại và số đã có trong giỏ', async () => {
      const { token } = await signIn();
      const product = await makeProduct({ stock: 5 });
      await addItem(token, { productId: product.id, quantity: 3 });

      const res = await addItem(token, { productId: product.id, quantity: 3 });

      expect(res.status).toBe(409);
      expect(res.body.error.message).toBe(
        'Chỉ còn 5 sản phẩm trong kho, bạn đã có 3 sản phẩm này trong giỏ',
      );
      expect((await getCart(token)).body.items[0].quantity).toBe(3);
    });

    it('sản phẩm hết hàng (tồn kho 0) thì 409 OUT_OF_STOCK', async () => {
      const { token } = await signIn();
      const product = await makeProduct({ stock: 0 });

      const res = await addItem(token, { productId: product.id });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OUT_OF_STOCK');
    });

    it('nhiều request cùng lúc không bao giờ làm tổng vượt tồn kho (tồn 3, 6 request thêm 1)', async () => {
      const { token } = await signIn();
      const product = await makeProduct({ stock: 3 });

      const results = await Promise.all(
        Array.from({ length: 6 }, () => addItem(token, { productId: product.id, quantity: 1 })),
      );

      const ok = results.filter((res) => res.status === 200).length;
      const rejected = results.filter((res) => res.status === 409).length;
      expect(ok).toBe(3);
      expect(rejected).toBe(3);
      const item = await prisma.cartItem.findFirst();
      expect(item.quantity).toBe(3);
      expect(await prisma.cartItem.count()).toBe(1);
    });
  });

  describe('chỉ thêm được sản phẩm khách đang thấy', () => {
    it('sản phẩm không tồn tại thì 404', async () => {
      const { token } = await signIn();

      const res = await addItem(token, { productId: 9999 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('sản phẩm đã ẩn, hoặc danh mục/thương hiệu bị ẩn thì 404 như không tồn tại', async () => {
      const { token } = await signIn();
      const hidden = await makeProduct({ isActive: false });
      const hiddenCategory = await makeProduct({
        category: await prisma.category.create({
          data: { name: 'Ẩn', slug: 'an', isActive: false },
        }),
      });
      const hiddenBrand = await makeProduct({
        brand: await prisma.brand.create({
          data: { name: 'Hãng ẩn', slug: 'hang-an', isActive: false },
        }),
      });

      for (const product of [hidden, hiddenCategory, hiddenBrand]) {
        const res = await addItem(token, { productId: product.id });
        expect(res.status).toBe(404);
      }
      expect(await prisma.cartItem.count()).toBe(0);
    });
  });

  describe('kiểm tra dữ liệu gửi lên', () => {
    it.each([
      ['thiếu productId', {}],
      ['productId là chuỗi', { productId: '1' }],
      ['productId bằng 0', { productId: 0 }],
      ['productId âm', { productId: -3 }],
      ['productId là số thực', { productId: 1.5 }],
      ['số lượng bằng 0', { productId: 1, quantity: 0 }],
      ['số lượng âm', { productId: 1, quantity: -2 }],
      ['số lượng là số thực', { productId: 1, quantity: 1.5 }],
      ['số lượng là chuỗi', { productId: 1, quantity: '2' }],
      ['số lượng quá lớn', { productId: 1, quantity: 100 }],
    ])('%s thì 400', async (_name, body) => {
      const { token } = await signIn();

      const res = await addItem(token, body);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('Sửa số lượng (US-15)', () => {
  const setup = async (stock = 5) => {
    const { token, user } = await signIn();
    const product = await makeProduct({ stock });
    const cart = (await addItem(token, { productId: product.id, quantity: 2 })).body;
    return { token, user, product, itemId: cart.items[0].id };
  };

  it('đặt số lượng mới và tổng tiền tính lại ngay (AC2)', async () => {
    const { token, itemId } = await setup();

    const res = await patchItem(token, itemId, { quantity: 4 });

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ quantity: 4, lineTotal: 4000000 });
    expect(res.body.subtotal).toBe(4000000);
    expect(res.body.totalQuantity).toBe(4);
  });

  it('đặt số lượng đúng bằng tồn kho thì được, vượt thì 409 và giữ nguyên số cũ (AC1)', async () => {
    const { token, itemId } = await setup(5);

    expect((await patchItem(token, itemId, { quantity: 5 })).status).toBe(200);
    const res = await patchItem(token, itemId, { quantity: 6 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.message).toBe('Chỉ còn 5 sản phẩm trong kho');
    expect((await getCart(token)).body.items[0].quantity).toBe(5);
  });

  it.each([
    ['0', 0],
    ['âm', -1],
    ['số thực', 2.5],
    ['chuỗi', '3'],
    ['quá lớn', 100],
  ])('số lượng %s thì 400 (tối thiểu 1)', async (_name, quantity) => {
    const { token, itemId } = await setup();

    const res = await patchItem(token, itemId, { quantity });

    expect(res.status).toBe(400);
  });

  it('thiếu số lượng thì 400', async () => {
    const { token, itemId } = await setup();
    expect((await patchItem(token, itemId, {})).status).toBe(400);
  });

  it('id không phải số thì 400; id không tồn tại thì 404', async () => {
    const { token } = await setup();

    expect((await patchItem(token, 'abc', { quantity: 1 })).status).toBe(400);
    const res = await patchItem(token, 9999, { quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CART_ITEM_NOT_FOUND');
  });

  it('không sửa được dòng trong giỏ của người khác (404, không lộ sự tồn tại)', async () => {
    const { itemId } = await setup();
    const other = await signIn('khac@example.com');

    const res = await patchItem(other.token, itemId, { quantity: 1 });

    expect(res.status).toBe(404);
    expect((await prisma.cartItem.findUnique({ where: { id: itemId } })).quantity).toBe(2);
  });

  it('sản phẩm đã bị ẩn thì không sửa số lượng được (409), chỉ xóa', async () => {
    const { token, product, itemId } = await setup();
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

    const res = await patchItem(token, itemId, { quantity: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PRODUCT_UNAVAILABLE');
  });
});

describe('Xóa khỏi giỏ (US-15)', () => {
  it('xóa một dòng, các dòng khác giữ nguyên, trả về giỏ mới', async () => {
    const { token } = await signIn();
    const a = await makeProduct();
    const b = await makeProduct();
    await addItem(token, { productId: a.id });
    const cart = (await addItem(token, { productId: b.id, quantity: 2 })).body;

    const res = await deleteItem(token, cart.items[0].id);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item) => item.productId)).toEqual([b.id]);
    expect(res.body.totalQuantity).toBe(2);
  });

  it('xóa dòng cuối thì giỏ về trống (AC3)', async () => {
    const { token } = await signIn();
    const product = await makeProduct();
    const cart = (await addItem(token, { productId: product.id })).body;

    const res = await deleteItem(token, cart.items[0].id);

    expect(res.body).toEqual({ items: [], totalQuantity: 0, subtotal: 0, canCheckout: false });
  });

  it('không xóa được dòng của người khác; id không tồn tại hoặc sai dạng', async () => {
    const owner = await signIn('chu@example.com');
    const other = await signIn('khac@example.com');
    const product = await makeProduct();
    const cart = (await addItem(owner.token, { productId: product.id })).body;

    expect((await deleteItem(other.token, cart.items[0].id)).status).toBe(404);
    expect(await prisma.cartItem.count()).toBe(1);
    expect((await deleteItem(owner.token, 9999)).status).toBe(404);
    expect((await deleteItem(owner.token, 'abc')).status).toBe(400);
  });
});

describe('Trạng thái từng dòng khi sản phẩm thay đổi sau lúc thêm (US-15 AC4)', () => {
  const addOne = async (overrides = {}, quantity = 2) => {
    const { token } = await signIn();
    const product = await makeProduct(overrides);
    await addItem(token, { productId: product.id, quantity });
    return { token, product };
  };

  it('sản phẩm bị ẩn: UNAVAILABLE, không tính vào tổng tiền, không cho thanh toán', async () => {
    const { token, product } = await addOne();
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });

    const { body } = await getCart(token);

    expect(body.items[0].status).toBe('UNAVAILABLE');
    expect(body).toMatchObject({ subtotal: 0, canCheckout: false, totalQuantity: 2 });
  });

  it('danh mục hoặc thương hiệu bị ẩn cũng là UNAVAILABLE', async () => {
    const { token, product } = await addOne();
    await prisma.category.update({ where: { id: product.categoryId }, data: { isActive: false } });
    expect((await getCart(token)).body.items[0].status).toBe('UNAVAILABLE');

    await prisma.category.update({ where: { id: product.categoryId }, data: { isActive: true } });
    await prisma.brand.update({ where: { id: product.brandId }, data: { isActive: false } });
    expect((await getCart(token)).body.items[0].status).toBe('UNAVAILABLE');
  });

  it('hết hàng sau khi thêm: OUT_OF_STOCK', async () => {
    const { token, product } = await addOne();
    await prisma.product.update({ where: { id: product.id }, data: { stock: 0 } });

    const { body } = await getCart(token);

    expect(body.items[0]).toMatchObject({ status: 'OUT_OF_STOCK', stock: 0 });
    expect(body).toMatchObject({ subtotal: 0, canCheckout: false });
  });

  it('tồn kho giảm xuống dưới số lượng trong giỏ: EXCEEDS_STOCK kèm số còn lại', async () => {
    const { token, product } = await addOne({ stock: 5 }, 4);
    await prisma.product.update({ where: { id: product.id }, data: { stock: 2 } });

    const { body } = await getCart(token);

    expect(body.items[0]).toMatchObject({ status: 'EXCEEDS_STOCK', stock: 2, quantity: 4 });
    expect(body.canCheckout).toBe(false);
  });

  it('giỏ lẫn lộn: tổng tiền chỉ cộng dòng mua được, vẫn không cho thanh toán', async () => {
    const { token } = await signIn();
    const good = await makeProduct({ price: 1000000 });
    const bad = await makeProduct({ price: 5000000 });
    await addItem(token, { productId: good.id, quantity: 2 });
    await addItem(token, { productId: bad.id, quantity: 1 });
    await prisma.product.update({ where: { id: bad.id }, data: { isActive: false } });

    const { body } = await getCart(token);

    expect(body.subtotal).toBe(2000000);
    expect(body.canCheckout).toBe(false);
    expect(body.items.map((item) => item.status)).toEqual(['OK', 'UNAVAILABLE']);
  });

  it('thay đổi giá sau lúc thêm thì giỏ luôn hiển thị giá hiện tại', async () => {
    const { token, product } = await addOne({ price: 1000000 }, 2);
    await prisma.product.update({ where: { id: product.id }, data: { price: 1200000 } });

    const { body } = await getCart(token);

    expect(body.items[0]).toMatchObject({ unitPrice: 1200000, lineTotal: 2400000 });
  });
});

describe('clearCart (dùng ở F06 sau khi đặt hàng)', () => {
  it('xóa mọi dòng của đúng người dùng, giữ nguyên giỏ của người khác', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct();
    await addItem(a.token, { productId: product.id });
    await addItem(b.token, { productId: product.id });

    await clearCart(a.user.id);

    expect((await getCart(a.token)).body.items).toEqual([]);
    expect((await getCart(b.token)).body.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Giỏ của khách chưa đăng nhập: xem trước (công khai) và gộp khi đăng nhập
// ---------------------------------------------------------------------------
const preview = (items) => request(app).post('/api/cart/preview').send({ items });
const merge = (token, items) =>
  request(app).post('/api/cart/merge').set(auth(token)).send({ items });

describe('Xem trước giỏ của khách (POST /api/cart/preview, công khai)', () => {
  it('không cần đăng nhập, tính giá hiện hành, thành tiền, tồn kho và trạng thái từng dòng', async () => {
    const a = await makeProduct({ price: 20000000, salePrice: 18000000, stock: 4 });
    const b = await makeProduct({ price: 1000000, stock: 9 });

    const res = await preview([
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
    ]);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      id: a.id, // giỏ của khách dùng id sản phẩm làm id dòng
      productId: a.id,
      quantity: 2,
      unitPrice: 18000000,
      lineTotal: 36000000,
      stock: 4,
      status: 'OK',
    });
    expect(res.body).toMatchObject({
      totalQuantity: 3,
      subtotal: 37000000,
      canCheckout: true,
    });
  });

  it('không ghi gì vào CSDL (không tạo giỏ)', async () => {
    const product = await makeProduct();

    await preview([{ productId: product.id, quantity: 1 }]);

    expect(await prisma.cart.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(0);
  });

  it('danh sách rỗng thì trả giỏ trống', async () => {
    const res = await preview([]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], totalQuantity: 0, subtotal: 0, canCheckout: false });
  });

  it('giữ thứ tự khách gửi lên; sản phẩm trùng thì cộng số lượng', async () => {
    const a = await makeProduct();
    const b = await makeProduct();

    const res = await preview([
      { productId: b.id, quantity: 1 },
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 3 },
    ]);

    expect(res.body.items.map((item) => [item.productId, item.quantity])).toEqual([
      [b.id, 4],
      [a.id, 2],
    ]);
  });

  it('sản phẩm không tồn tại bị bỏ qua, không làm hỏng cả giỏ', async () => {
    const product = await makeProduct();

    const res = await preview([
      { productId: 9999, quantity: 1 },
      { productId: product.id, quantity: 1 },
    ]);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item) => item.productId)).toEqual([product.id]);
  });

  it('đánh dấu sản phẩm bị ẩn, hết hàng, vượt tồn kho; tổng tiền chỉ cộng dòng mua được', async () => {
    const good = await makeProduct({ price: 1000000, stock: 5 });
    const hidden = await makeProduct({ isActive: false });
    const soldOut = await makeProduct({ stock: 0 });
    const tooMany = await makeProduct({ stock: 2 });

    const res = await preview([
      { productId: good.id, quantity: 2 },
      { productId: hidden.id, quantity: 1 },
      { productId: soldOut.id, quantity: 1 },
      { productId: tooMany.id, quantity: 5 },
    ]);

    expect(res.body.items.map((item) => item.status)).toEqual([
      'OK',
      'UNAVAILABLE',
      'OUT_OF_STOCK',
      'EXCEEDS_STOCK',
    ]);
    expect(res.body.subtotal).toBe(2000000);
    expect(res.body.canCheckout).toBe(false);
  });

  it.each([
    ['thiếu items', {}],
    ['items không phải mảng', { items: 'abc' }],
    ['productId sai', { items: [{ productId: 0, quantity: 1 }] }],
    ['productId là chuỗi', { items: [{ productId: '1', quantity: 1 }] }],
    ['thiếu số lượng', { items: [{ productId: 1 }] }],
    ['số lượng bằng 0', { items: [{ productId: 1, quantity: 0 }] }],
    ['số lượng quá lớn', { items: [{ productId: 1, quantity: 100 }] }],
  ])('%s thì 400', async (_name, body) => {
    const res = await request(app).post('/api/cart/preview').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('chặn danh sách quá dài (tối đa 50 sản phẩm) để API công khai không bị lạm dụng', async () => {
    const items = Array.from({ length: 51 }, (_unused, index) => ({
      productId: index + 1,
      quantity: 1,
    }));

    expect((await preview(items)).status).toBe(400);
    expect((await preview(items.slice(0, 50))).status).toBe(200);
  });
});

describe('Gộp giỏ của khách vào tài khoản (POST /api/cart/merge)', () => {
  it('yêu cầu đăng nhập', async () => {
    const res = await request(app).post('/api/cart/merge').send({ items: [] });

    expect(res.status).toBe(401);
  });

  it('gộp vào giỏ trống: thêm đủ các sản phẩm, không có ghi chú', async () => {
    const { token } = await signIn();
    const a = await makeProduct({ stock: 5 });
    const b = await makeProduct({ stock: 5 });

    const res = await merge(token, [
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
    ]);

    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([]);
    expect(res.body.cart.items.map((item) => [item.productId, item.quantity])).toEqual([
      [a.id, 2],
      [b.id, 1],
    ]);
    expect(res.body.cart.totalQuantity).toBe(3);
  });

  it('cộng dồn vào sản phẩm đã có trong giỏ tài khoản', async () => {
    const { token } = await signIn();
    const product = await makeProduct({ stock: 10 });
    await addItem(token, { productId: product.id, quantity: 3 });

    const res = await merge(token, [{ productId: product.id, quantity: 2 }]);

    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(5);
  });

  it('thiếu tồn kho thì thêm tối đa số còn được phép và ghi chú lại, không báo lỗi', async () => {
    const { token } = await signIn();
    const product = await makeProduct({ stock: 5, name: 'Máy A' });
    await addItem(token, { productId: product.id, quantity: 3 });

    const res = await merge(token, [{ productId: product.id, quantity: 4 }]);

    expect(res.status).toBe(200);
    expect(res.body.cart.items[0].quantity).toBe(5); // chỉ cộng thêm 2 (còn lại 5 - 3)
    expect(res.body.notes).toEqual(['Máy A: chỉ thêm được 2 trên 4 sản phẩm vì tồn kho không đủ']);
  });

  it('giỏ tài khoản đã đủ tồn kho hoặc hết hàng thì không thêm gì và ghi chú', async () => {
    const { token } = await signIn();
    const full = await makeProduct({ stock: 3, name: 'Máy đầy' });
    const soldOut = await makeProduct({ stock: 0, name: 'Máy hết' });
    await addItem(token, { productId: full.id, quantity: 3 });

    const res = await merge(token, [
      { productId: full.id, quantity: 1 },
      { productId: soldOut.id, quantity: 2 },
    ]);

    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(3);
    expect(res.body.notes).toHaveLength(2);
    expect(res.body.notes[0]).toContain('Máy đầy: không thêm được');
    expect(res.body.notes[1]).toContain('Máy hết: không thêm được');
  });

  it('bỏ qua sản phẩm đã ẩn hoặc không tồn tại và báo số lượng bị bỏ qua (không lộ tên)', async () => {
    const { token } = await signIn();
    const good = await makeProduct();
    const hidden = await makeProduct({ isActive: false, name: 'Hàng ẩn bí mật' });

    const res = await merge(token, [
      { productId: good.id, quantity: 1 },
      { productId: hidden.id, quantity: 1 },
      { productId: 9999, quantity: 1 },
    ]);

    expect(res.body.cart.items.map((item) => item.productId)).toEqual([good.id]);
    expect(res.body.notes).toEqual([
      '2 sản phẩm trong giỏ tạm không còn được bán nên không được thêm vào giỏ',
    ]);
    expect(JSON.stringify(res.body)).not.toContain('Hàng ẩn bí mật');
  });

  it('mục trùng sản phẩm trong danh sách gửi lên được cộng lại trước khi gộp', async () => {
    const { token } = await signIn();
    const product = await makeProduct({ stock: 10 });

    const res = await merge(token, [
      { productId: product.id, quantity: 2 },
      { productId: product.id, quantity: 3 },
    ]);

    expect(res.body.cart.items[0].quantity).toBe(5);
  });

  it('danh sách rỗng thì giữ nguyên giỏ tài khoản', async () => {
    const { token } = await signIn();
    const product = await makeProduct();
    await addItem(token, { productId: product.id, quantity: 2 });

    const res = await merge(token, []);

    expect(res.status).toBe(200);
    expect(res.body.cart.totalQuantity).toBe(2);
    expect(res.body.notes).toEqual([]);
  });

  it('chỉ ảnh hưởng giỏ của chính người đăng nhập', async () => {
    const a = await signIn('a@example.com');
    const b = await signIn('b@example.com');
    const product = await makeProduct();

    await merge(a.token, [{ productId: product.id, quantity: 2 }]);

    expect((await getCart(b.token)).body.items).toEqual([]);
    expect((await getCart(a.token)).body.totalQuantity).toBe(2);
  });

  it('kiểm tra dữ liệu gửi lên: số lượng sai thì 400', async () => {
    const { token } = await signIn();

    expect((await merge(token, [{ productId: 1, quantity: 0 }])).status).toBe(400);
    expect((await request(app).post('/api/cart/merge').set(auth(token)).send({})).status).toBe(400);
  });

  it('gộp đồng thời hai lần không bao giờ vượt tồn kho (tồn 3, hai lần gộp 2 sản phẩm)', async () => {
    const { token } = await signIn();
    const product = await makeProduct({ stock: 3 });

    await Promise.all([
      merge(token, [{ productId: product.id, quantity: 2 }]),
      merge(token, [{ productId: product.id, quantity: 2 }]),
    ]);

    const item = await prisma.cartItem.findFirst();
    expect(item.quantity).toBeLessThanOrEqual(3);
  });
});
