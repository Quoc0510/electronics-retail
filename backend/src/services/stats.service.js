/**
 * @feature [F10] Dashboard - Số liệu thống kê kinh doanh cho Admin (US-26).
 *  - AC1: doanh thu từng ngày trong 30 ngày gần nhất, chỉ tính đơn COMPLETED.
 *  - AC2: số đơn theo từng trạng thái.
 *  - AC3: 5 sản phẩm bán chạy nhất.
 *  - AC4: sản phẩm tồn kho thấp (stock <= LOW_STOCK_THRESHOLD).
 * Ngày được tính theo giờ Việt Nam (UTC+7, không có giờ mùa hè) vì cửa hàng chốt doanh thu theo ngày địa phương;
 * nếu tính theo UTC thì đơn hoàn thành lúc 00:30 sáng sẽ bị tính vào ngày hôm trước.
 */
import { prisma } from '../lib/prisma.js';
import { ORDER_STATUSES } from '../lib/orderStatus.js';

export const REVENUE_DAYS = 30;
export const TOP_PRODUCT_LIMIT = 5;
export const LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_LIST_SIZE = 10;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Danh sách REVENUE_DAYS ngày (YYYY-MM-DD, giờ Việt Nam) kết thúc ở hôm nay, cũ nhất trước. */
export const lastDays = (now = new Date(), count = REVENUE_DAYS) => {
  const today = new Date(now.getTime() + VN_OFFSET_MS);
  return Array.from({ length: count }, (_, index) =>
    new Date(today.getTime() - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10),
  );
};

// Các hàm tổng hợp của PostgreSQL trả về BigInt; JSON không chứa được BigInt nên đổi sang số thường
const toNumber = (value) => Number(value);

const revenueByDay = async (days) => {
  const start = new Date(`${days[0]}T00:00:00.000+07:00`);
  // Ngày tính doanh thu là ngày đơn chuyển sang COMPLETED (lúc thu tiền COD, BR-08), lấy từ lịch sử trạng thái.
  // Cột created_at lưu UTC dạng timestamp không múi giờ nên phải gắn UTC rồi mới đổi sang giờ Việt Nam.
  const rows = await prisma.$queryRaw`
    SELECT to_char((h.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day,
           SUM(o.total)::bigint AS revenue,
           COUNT(*)::int AS orders
    FROM orders o
    JOIN order_status_history h ON h.order_id = o.id AND h.status = 'COMPLETED'
    WHERE o.status = 'COMPLETED' AND h.created_at >= ${start}
    GROUP BY day`;
  const byDay = new Map(rows.map((row) => [row.day, row]));
  // Ngày không có đơn vẫn phải có mặt (doanh thu 0) để biểu đồ đủ 30 cột
  return days.map((date) => ({
    date,
    revenue: toNumber(byDay.get(date)?.revenue ?? 0),
    orders: toNumber(byDay.get(date)?.orders ?? 0),
  }));
};

const ordersByStatus = async () => {
  const groups = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
  const counts = Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  return Object.fromEntries(ORDER_STATUSES.map((status) => [status, counts[status] ?? 0]));
};

// "Bán chạy" tính theo số lượng bán ra trong cùng khoảng 30 ngày, không tính đơn đã hủy (hàng đã hoàn kho, BR-07)
const topProducts = async (since) => {
  const rows = await prisma.$queryRaw`
    SELECT p.id, p.sku, p.name,
           SUM(oi.quantity)::int AS sold,
           SUM(oi.quantity::bigint * oi.unit_price)::bigint AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.status <> 'CANCELLED' AND o.created_at >= ${since}
    GROUP BY p.id
    ORDER BY sold DESC, revenue DESC, p.id ASC
    LIMIT ${TOP_PRODUCT_LIMIT}`;
  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    sold: toNumber(row.sold),
    revenue: toNumber(row.revenue),
  }));
};

// Chỉ xét sản phẩm đang bán: sản phẩm đã ẩn không cần nhập thêm
const lowStock = async () => {
  const where = { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } };
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: { id: true, sku: true, name: true, stock: true },
      orderBy: [{ stock: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      take: LOW_STOCK_LIST_SIZE,
    }),
    prisma.product.count({ where }),
  ]);
  return { threshold: LOW_STOCK_THRESHOLD, total, items };
};

export const getDashboardStats = async (now = new Date()) => {
  const days = lastDays(now);
  const since = new Date(`${days[0]}T00:00:00.000+07:00`);

  const [revenue, byStatus, top, stock, customers] = await Promise.all([
    revenueByDay(days),
    ordersByStatus(),
    topProducts(since),
    lowStock(),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
  ]);

  return {
    days: REVENUE_DAYS,
    summary: {
      revenue: revenue.reduce((sum, day) => sum + day.revenue, 0),
      completedOrders: revenue.reduce((sum, day) => sum + day.orders, 0),
      pendingOrders: byStatus.PENDING,
      customers,
    },
    revenueByDay: revenue,
    ordersByStatus: byStatus,
    topProducts: top,
    lowStock: stock,
  };
};
