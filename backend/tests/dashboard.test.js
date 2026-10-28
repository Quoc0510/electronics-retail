/**
 * @feature [F10] Dashboard - Kiểm thử thống kê kinh doanh (US-26): doanh thu 30 ngày chỉ tính đơn COMPLETED theo giờ Việt Nam,
 * số đơn theo trạng thái, 5 sản phẩm bán chạy, sản phẩm tồn kho thấp. Chạy trên PostgreSQL thật.
 * Test thời gian gọi thẳng service với "bây giờ" cố định để kết quả không phụ thuộc ngày chạy test.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { ORDER_CODE_PATTERN } from '../src/lib/orderCode.js';
import { LOW_STOCK_THRESHOLD, getDashboardStats, lastDays } from '../src/services/stats.service.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// 10:00 UTC = 17:00 giờ Việt Nam ngày 28/10/2026, nên 30 ngày gần nhất là 29/09 đến 28/10
const NOW = new Date('2026-10-28T10:00:00.000Z');
const DAY_ONE = '2026-09-29';
const TODAY = '2026-10-28';

// ---------------------------------------------------------------------------
// Dữ liệu và hàm hỗ trợ
// ---------------------------------------------------------------------------
let productSeq = 0;
let orderSeq = 0;
let category;
let brand;

beforeEach(async () => {
  productSeq = 0;
  orderSeq = 0;
  category = await prisma.category.create({ data: { name: 'Điện thoại', slug: 'dien-thoai' } });
  brand = await prisma.brand.create({ data: { name: 'Hãng A', slug: 'hang-a' } });
});

const makeProduct = (overrides = {}) => {
  productSeq += 1;
  return prisma.product.create({
    data: {
      sku: `SKU-${productSeq}`,
      name: `Sản phẩm ${productSeq}`,
      slug: `san-pham-${productSeq}`,
      price: 1000000,
      stock: 50,
      categoryId: category.id,
      brandId: brand.id,
      ...overrides,
    },
  });
};

// Mã đơn hợp lệ theo BR-12 (bảng chữ cái không có I, O, 0, 1), khác nhau cho mỗi đơn
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const nextCode = () => {
  orderSeq += 1;
  const suffix = [0, 1, 2, 3].map((i) => ALPHABET[Math.floor(orderSeq / 24 ** i) % 24]).join('');
  return `TS261020-${suffix}`;
};

/**
 * Tạo thẳng một đơn (của khách vãng lai) trong DB để kiểm soát chính xác thời điểm.
 * completedAt: lúc đơn chuyển sang COMPLETED, ghi vào lịch sử trạng thái (nguồn tính doanh thu theo ngày).
 * Tổng tiền = tiền hàng + 30.000 phí vận chuyển; doanh thu thống kê lấy theo tổng tiền.
 */
const makeOrder = async ({
  status = 'COMPLETED',
  items = [],
  createdAt = new Date('2026-10-20T03:00:00.000Z'),
  completedAt = status === 'COMPLETED' ? createdAt : undefined,
} = {}) => {
  const lines = items.map(({ product, unitPrice = 1000000, quantity = 1 }) => ({
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    unitPrice,
    quantity,
  }));
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const code = nextCode();
  expect(code).toMatch(ORDER_CODE_PATTERN);
  return prisma.order.create({
    data: {
      code,
      status,
      subtotal,
      shippingFee: 30000,
      total: subtotal + 30000,
      recipientName: 'Nguyễn Văn A',
      phone: '0912345678',
      shippingAddress: '12 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
      createdAt,
      items: { create: lines },
      history: {
        create: [
          { status: 'PENDING', createdAt },
          ...(completedAt ? [{ status: 'COMPLETED', createdAt: completedAt }] : []),
        ],
      },
    },
  });
};

const day = (stats, date) => stats.revenueByDay.find((entry) => entry.date === date);

// ---------------------------------------------------------------------------
// Phân quyền và hình dạng kết quả
// ---------------------------------------------------------------------------
describe('GET /api/admin/stats - quyền truy cập', () => {
  it('chưa đăng nhập thì 401', async () => {
    expect((await request(app).get('/api/admin/stats')).status).toBe(401);
  });

  it('khách hàng thì 403', async () => {
    await createUser({ email: 'khach@example.com' });
    const { accessToken } = await loginAs(request, app, 'khach@example.com');

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it('quản trị viên nhận đủ các khối số liệu; chưa có dữ liệu thì toàn số 0', async () => {
    await createUser({ email: 'admin@example.com', role: 'ADMIN' });
    const { accessToken } = await loginAs(request, app, 'admin@example.com');

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
    expect(res.body.revenueByDay).toHaveLength(30);
    expect(res.body.revenueByDay.every((entry) => entry.revenue === 0 && entry.orders === 0)).toBe(
      true,
    );
    expect(res.body.summary).toEqual({
      revenue: 0,
      completedOrders: 0,
      pendingOrders: 0,
      customers: 0,
    });
    expect(res.body.ordersByStatus).toEqual({
      PENDING: 0,
      CONFIRMED: 0,
      SHIPPING: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    });
    expect(res.body.topProducts).toEqual([]);
    expect(res.body.lowStock).toEqual({ threshold: LOW_STOCK_THRESHOLD, total: 0, items: [] });
  });
});

// ---------------------------------------------------------------------------
// Danh sách 30 ngày
// ---------------------------------------------------------------------------
describe('lastDays - danh sách ngày theo giờ Việt Nam', () => {
  it('đủ 30 ngày liên tiếp, cũ nhất trước, kết thúc ở hôm nay', () => {
    const days = lastDays(NOW);

    expect(days).toHaveLength(30);
    expect(days[0]).toBe(DAY_ONE);
    expect(days[29]).toBe(TODAY);
  });

  it('sau 17:00 UTC thì đã sang ngày mới ở Việt Nam', () => {
    // 18:00 UTC ngày 28/10 = 01:00 ngày 29/10 giờ Việt Nam
    expect(lastDays(new Date('2026-10-28T18:00:00.000Z')).at(-1)).toBe('2026-10-29');
    expect(lastDays(new Date('2026-10-28T16:59:59.000Z')).at(-1)).toBe('2026-10-28');
  });

  it('đi qua ranh giới tháng và năm', () => {
    const days = lastDays(new Date('2027-01-02T05:00:00.000Z'), 5);

    expect(days).toEqual(['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });
});

// ---------------------------------------------------------------------------
// US-26 AC1: doanh thu theo ngày
// ---------------------------------------------------------------------------
describe('Doanh thu theo ngày (US-26 AC1)', () => {
  it('chỉ tính đơn COMPLETED, cộng dồn các đơn trong cùng ngày', async () => {
    const product = await makeProduct();
    const completedAt = new Date('2026-10-25T03:00:00.000Z');
    await makeOrder({ items: [{ product, quantity: 2 }], completedAt });
    await makeOrder({ items: [{ product, unitPrice: 500000 }], completedAt });
    await makeOrder({ status: 'PENDING', items: [{ product }] });
    await makeOrder({ status: 'CONFIRMED', items: [{ product }] });
    await makeOrder({ status: 'SHIPPING', items: [{ product }] });
    await makeOrder({ status: 'CANCELLED', items: [{ product }] });

    const stats = await getDashboardStats(NOW);

    // (2 x 1.000.000 + 30.000) + (500.000 + 30.000) = 2.560.000
    expect(day(stats, '2026-10-25')).toEqual({
      date: '2026-10-25',
      revenue: 2560000,
      orders: 2,
    });
    expect(stats.summary.revenue).toBe(2560000);
    expect(stats.summary.completedOrders).toBe(2);
    expect(stats.revenueByDay.filter((entry) => entry.orders > 0)).toHaveLength(1);
  });

  it('chia các ngày khác nhau thành các cột riêng', async () => {
    const product = await makeProduct();
    await makeOrder({ items: [{ product }], completedAt: new Date('2026-10-01T03:00:00.000Z') });
    await makeOrder({
      items: [{ product, quantity: 3 }],
      completedAt: new Date('2026-10-02T03:00:00.000Z'),
    });

    const stats = await getDashboardStats(NOW);

    expect(day(stats, '2026-10-01').revenue).toBe(1030000);
    expect(day(stats, '2026-10-02').revenue).toBe(3030000);
    expect(stats.summary.revenue).toBe(4060000);
  });

  it('tính ngày theo giờ Việt Nam: 00:30 sáng ngày 28 (17:30 UTC ngày 27) thuộc ngày 28', async () => {
    const product = await makeProduct();
    await makeOrder({ items: [{ product }], completedAt: new Date('2026-10-27T17:30:00.000Z') });
    await makeOrder({ items: [{ product }], completedAt: new Date('2026-10-27T16:59:59.000Z') });

    const stats = await getDashboardStats(NOW);

    expect(day(stats, '2026-10-28').orders).toBe(1);
    expect(day(stats, '2026-10-27').orders).toBe(1);
  });

  it('ranh giới cửa sổ: 00:00 ngày đầu tiên vẫn tính, 23:59 ngày liền trước thì không', async () => {
    const product = await makeProduct();
    // 17:00 UTC ngày 28/9 = 00:00 ngày 29/9 giờ Việt Nam (ngày đầu của cửa sổ)
    await makeOrder({ items: [{ product }], completedAt: new Date('2026-09-28T17:00:00.000Z') });
    await makeOrder({ items: [{ product }], completedAt: new Date('2026-09-28T16:59:59.000Z') });

    const stats = await getDashboardStats(NOW);

    expect(day(stats, DAY_ONE).orders).toBe(1);
    expect(stats.summary.completedOrders).toBe(1);
  });

  it('ngày hoàn thành mới là ngày tính doanh thu, không phải ngày đặt', async () => {
    const product = await makeProduct();
    await makeOrder({
      items: [{ product }],
      createdAt: new Date('2026-09-01T03:00:00.000Z'), // đặt từ trước cửa sổ
      completedAt: new Date('2026-10-10T03:00:00.000Z'),
    });

    const stats = await getDashboardStats(NOW);

    expect(day(stats, '2026-10-10').orders).toBe(1);
  });

  it('đơn có trạng thái COMPLETED nhưng chưa ghi lịch sử hoàn thành thì không làm hỏng thống kê', async () => {
    const product = await makeProduct();
    await makeOrder({ status: 'COMPLETED', items: [{ product }], completedAt: null });

    const stats = await getDashboardStats(NOW);

    expect(stats.summary.revenue).toBe(0);
    expect(stats.ordersByStatus.COMPLETED).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// US-26 AC2: số đơn theo trạng thái
// ---------------------------------------------------------------------------
describe('Số đơn theo trạng thái (US-26 AC2)', () => {
  it('đếm đủ năm trạng thái, trạng thái không có đơn là 0, tính toàn bộ thời gian', async () => {
    const product = await makeProduct();
    const old = new Date('2025-01-01T03:00:00.000Z');
    await makeOrder({ status: 'PENDING', items: [{ product }] });
    await makeOrder({ status: 'PENDING', items: [{ product }], createdAt: old });
    await makeOrder({ status: 'SHIPPING', items: [{ product }] });
    await makeOrder({ status: 'CANCELLED', items: [{ product }] });
    await makeOrder({ status: 'CANCELLED', items: [{ product }] });
    await makeOrder({ status: 'CANCELLED', items: [{ product }] });

    const stats = await getDashboardStats(NOW);

    expect(stats.ordersByStatus).toEqual({
      PENDING: 2,
      CONFIRMED: 0,
      SHIPPING: 1,
      COMPLETED: 0,
      CANCELLED: 3,
    });
    expect(stats.summary.pendingOrders).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// US-26 AC3: sản phẩm bán chạy
// ---------------------------------------------------------------------------
describe('5 sản phẩm bán chạy nhất (US-26 AC3)', () => {
  it('chỉ lấy 5 sản phẩm, xếp theo số lượng bán giảm dần', async () => {
    const products = [];
    for (let i = 0; i < 6; i += 1) products.push(await makeProduct());
    // Sản phẩm i bán (i + 1) cái; sản phẩm bán ít nhất (1 cái) phải bị loại
    for (const [i, product] of products.entries()) {
      await makeOrder({ status: 'PENDING', items: [{ product, quantity: i + 1 }] });
    }

    const stats = await getDashboardStats(NOW);

    expect(stats.topProducts.map((item) => item.sold)).toEqual([6, 5, 4, 3, 2]);
    expect(stats.topProducts[0]).toEqual({
      id: products[5].id,
      sku: products[5].sku,
      name: products[5].name,
      sold: 6,
      revenue: 6000000,
    });
    expect(stats.topProducts.map((item) => item.id)).not.toContain(products[0].id);
  });

  it('cộng dồn nhiều đơn của cùng một sản phẩm', async () => {
    const a = await makeProduct();
    const b = await makeProduct();
    await makeOrder({ status: 'PENDING', items: [{ product: a, quantity: 2 }] });
    await makeOrder({ status: 'COMPLETED', items: [{ product: a, quantity: 2 }] });
    await makeOrder({ status: 'SHIPPING', items: [{ product: b, quantity: 3 }] });

    const stats = await getDashboardStats(NOW);

    expect(stats.topProducts.map((item) => [item.id, item.sold])).toEqual([
      [a.id, 4],
      [b.id, 3],
    ]);
  });

  it('không tính đơn đã hủy và đơn đặt trước cửa sổ 30 ngày', async () => {
    const hot = await makeProduct();
    const normal = await makeProduct();
    await makeOrder({ status: 'CANCELLED', items: [{ product: hot, quantity: 50 }] });
    await makeOrder({
      status: 'COMPLETED',
      items: [{ product: hot, quantity: 40 }],
      createdAt: new Date('2026-09-01T03:00:00.000Z'),
    });
    await makeOrder({ status: 'PENDING', items: [{ product: normal, quantity: 1 }] });

    const stats = await getDashboardStats(NOW);

    expect(stats.topProducts.map((item) => item.id)).toEqual([normal.id]);
  });

  it('bằng số lượng thì sản phẩm có doanh thu cao hơn đứng trước, bằng nữa thì theo mã', async () => {
    const cheap = await makeProduct();
    const pricey = await makeProduct();
    const twinA = await makeProduct();
    const twinB = await makeProduct();
    await makeOrder({ status: 'PENDING', items: [{ product: cheap, unitPrice: 100000 }] });
    await makeOrder({ status: 'PENDING', items: [{ product: pricey, unitPrice: 900000 }] });
    await makeOrder({ status: 'PENDING', items: [{ product: twinB, unitPrice: 50000 }] });
    await makeOrder({ status: 'PENDING', items: [{ product: twinA, unitPrice: 50000 }] });

    const stats = await getDashboardStats(NOW);

    expect(stats.topProducts.map((item) => item.id)).toEqual([
      pricey.id,
      cheap.id,
      twinA.id,
      twinB.id,
    ]);
  });

  it('doanh thu sản phẩm dùng đơn giá lúc đặt (BR-04), không phải giá hiện tại', async () => {
    const product = await makeProduct({ price: 9999999 });
    await makeOrder({ status: 'PENDING', items: [{ product, unitPrice: 1200000, quantity: 2 }] });

    const stats = await getDashboardStats(NOW);

    expect(stats.topProducts[0].revenue).toBe(2400000);
  });

  it('không tràn số nguyên 32 bit khi cộng nhiều đơn lớn (mỗi đơn vừa Int, tổng thì không)', async () => {
    const product = await makeProduct();
    const completedAt = new Date('2026-10-25T03:00:00.000Z');
    for (let i = 0; i < 2; i += 1) {
      await makeOrder({ items: [{ product, unitPrice: 100000000, quantity: 20 }], completedAt });
    }

    const stats = await getDashboardStats(NOW);

    expect(stats.topProducts[0].revenue).toBe(4000000000);
    expect(day(stats, '2026-10-25').revenue).toBe(4000060000);
    expect(stats.summary.revenue).toBe(4000060000);
  });
});

// ---------------------------------------------------------------------------
// US-26 AC4: tồn kho thấp
// ---------------------------------------------------------------------------
describe('Sản phẩm tồn kho thấp (US-26 AC4)', () => {
  it('lấy sản phẩm tồn kho từ 5 trở xuống (kể cả 0), ít nhất trước; 6 trở lên không lấy', async () => {
    const out = await makeProduct({ stock: 0 });
    const five = await makeProduct({ stock: 5 });
    const two = await makeProduct({ stock: 2 });
    await makeProduct({ stock: 6 });
    await makeProduct({ stock: 100 });

    const { lowStock } = await getDashboardStats(NOW);

    expect(lowStock.threshold).toBe(5);
    expect(lowStock.total).toBe(3);
    expect(lowStock.items.map((item) => [item.id, item.stock])).toEqual([
      [out.id, 0],
      [two.id, 2],
      [five.id, 5],
    ]);
    expect(lowStock.items[0]).toEqual({
      id: out.id,
      sku: out.sku,
      name: out.name,
      stock: 0,
    });
  });

  it('bỏ qua sản phẩm đã ẩn', async () => {
    await makeProduct({ stock: 1, isActive: false });
    const visible = await makeProduct({ stock: 1 });

    const { lowStock } = await getDashboardStats(NOW);

    expect(lowStock.items.map((item) => item.id)).toEqual([visible.id]);
    expect(lowStock.total).toBe(1);
  });

  it('danh sách tối đa 10 dòng nhưng total cho biết tổng số thật', async () => {
    for (let i = 0; i < 13; i += 1) await makeProduct({ stock: i % 6 });

    const { lowStock } = await getDashboardStats(NOW);

    expect(lowStock.total).toBe(13);
    expect(lowStock.items).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// Tổng hợp
// ---------------------------------------------------------------------------
describe('Số khách hàng', () => {
  it('chỉ đếm tài khoản khách hàng, không đếm quản trị viên', async () => {
    await createUser({ email: 'a@example.com' });
    await createUser({ email: 'b@example.com' });
    await createUser({ email: 'admin@example.com', role: 'ADMIN' });

    const stats = await getDashboardStats(NOW);

    expect(stats.summary.customers).toBe(2);
  });
});
