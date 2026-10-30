/**
 * @feature [F09] Mã giảm giá - Nghiệp vụ mã giảm giá: khách xem trước số tiền giảm, đặt hàng dùng mã, Admin quản lý mã
 * (US-24, US-25, BR-14).
 *
 * Số tiền giảm LUÔN do máy chủ tính lại khi đặt hàng (redeemCoupon) từ tiền hàng thật trong giỏ; con số Client xem trước
 * chỉ để hiển thị. Lượt dùng được giữ chỗ bằng một câu UPDATE có điều kiện (used_count < max_uses) trong CHÍNH transaction
 * đặt hàng: đơn lỗi thì lượt dùng được hoàn lại cùng transaction, hai đơn tranh lượt cuối thì chỉ một đơn thắng, và hủy
 * đơn thì trả lại lượt (releaseCoupon).
 *
 * Điều kiện phụ (BR-14): điểm thành viên tối thiểu và phạm vi áp dụng (sản phẩm, danh mục, thương hiệu). Mã có phạm vi chỉ
 * giảm trên các dòng hàng khớp phạm vi; "đơn tối thiểu" và số tiền giảm cùng tính trên phần tiền hàng đó. Xem trước và đặt
 * hàng dùng CHUNG một hàm kiểm tra (assertUsable) để hai nơi không bao giờ lệch nhau.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { escapeLike } from '../lib/like.js';
import { visibleProductWhere } from '../lib/productVisibility.js';
import {
  calculateDiscount,
  couponProblem,
  couponState,
  eligibleLines,
  hasScope,
  linesSubtotal,
} from '../lib/coupon.js';
import { AppError } from '../utils/AppError.js';
import { mergeDuplicates } from './cart.service.js';

const PROBLEM_MESSAGES = {
  COUPON_INACTIVE: 'Mã giảm giá này đã ngừng áp dụng',
  COUPON_NOT_STARTED: 'Mã giảm giá chưa đến thời gian áp dụng',
  COUPON_EXPIRED: 'Mã giảm giá đã hết hạn',
  COUPON_EXHAUSTED: 'Mã giảm giá đã hết lượt sử dụng',
};

const notFound = () => new AppError(404, 'Mã giảm giá không tồn tại', 'COUPON_NOT_FOUND');

const formatVnd = (amount) => `${amount.toLocaleString('vi-VN')} đ`;

/**
 * Ném lỗi đúng lý do mã không dùng được cho giỏ hàng này (US-25 AC2), theo thứ tự cố định: mã còn hiệu lực, đủ điểm thành
 * viên, có sản phẩm được áp dụng, đạt đơn tối thiểu. Trả về tiền hàng của các dòng được áp dụng.
 * @param {Array<{productId:number, categoryId:number, brandId:number, unitPrice:number, quantity:number}>} lines
 * @param {number|null} points điểm của người dùng; null = khách chưa đăng nhập
 * @returns {number} tiền hàng của các dòng được mã áp dụng
 */
const assertUsable = (coupon, lines, points, now) => {
  const problem = couponProblem(coupon, now);
  if (problem) throw new AppError(400, PROBLEM_MESSAGES[problem], problem);

  if (coupon.minPoints > 0 && (points ?? 0) < coupon.minPoints) {
    const message =
      points === null
        ? `Mã này dành cho thành viên có từ ${coupon.minPoints} điểm trở lên. Hãy đăng nhập để dùng mã`
        : `Bạn cần có từ ${coupon.minPoints} điểm thành viên để dùng mã này (hiện có ${points} điểm)`;
    throw new AppError(400, message, 'COUPON_MIN_POINTS', {
      minPoints: coupon.minPoints,
      points,
    });
  }

  const eligible = eligibleLines(coupon, lines);
  if (eligible.length === 0) {
    throw new AppError(
      400,
      'Mã giảm giá không áp dụng cho các sản phẩm trong giỏ hàng',
      'COUPON_NOT_APPLICABLE',
    );
  }

  const subtotal = linesSubtotal(eligible);
  if (subtotal < coupon.minOrder) {
    const scoped = hasScope(coupon);
    throw new AppError(
      400,
      scoped
        ? `Các sản phẩm được áp dụng cần từ ${formatVnd(coupon.minOrder)} tiền hàng để dùng mã này`
        : `Đơn hàng cần từ ${formatVnd(coupon.minOrder)} tiền hàng để dùng mã này`,
      'COUPON_MIN_ORDER',
      { minOrder: coupon.minOrder, scoped },
    );
  }
  return subtotal;
};

const toQuote = (coupon, eligibleSubtotal) => ({
  code: coupon.code,
  type: coupon.type,
  value: coupon.value,
  minOrder: coupon.minOrder,
  minPoints: coupon.minPoints,
  scoped: hasScope(coupon),
  eligibleSubtotal,
  discount: calculateDiscount(coupon, eligibleSubtotal),
});

// Điểm hiện có của người dùng; null cho khách chưa đăng nhập
const pointsOf = async (db, userId) => {
  if (userId === null || userId === undefined) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { points: true } });
  return user?.points ?? 0;
};

/**
 * US-25 AC1, AC2: xem trước số tiền giảm của một mã cho giỏ hàng `items` ({ productId, quantity }); không giữ chỗ lượt dùng.
 * Giá lấy từ CSDL (không tin giá Client gửi) nên số xem trước khớp với số đặt hàng sẽ tính.
 * @param {number|null} userId người đang đăng nhập (để kiểm tra điểm tối thiểu) hoặc null
 */
export const previewCoupon = async (code, items, userId = null) => {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) throw notFound();

  const requested = mergeDuplicates(items);
  const products = await prisma.product.findMany({
    where: { id: { in: requested.map((entry) => entry.productId) }, ...visibleProductWhere },
    select: { id: true, price: true, salePrice: true, categoryId: true, brandId: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines = requested
    .filter((entry) => byId.has(entry.productId))
    .map((entry) => {
      const product = byId.get(entry.productId);
      return {
        productId: product.id,
        categoryId: product.categoryId,
        brandId: product.brandId,
        unitPrice: product.salePrice ?? product.price, // BR-02
        quantity: entry.quantity,
      };
    });

  const eligibleSubtotal = assertUsable(coupon, lines, await pointsOf(prisma, userId), new Date());
  return toQuote(coupon, eligibleSubtotal);
};

/**
 * Dùng mã cho một đơn gồm các dòng `lines`, TRONG transaction đặt hàng của người gọi (US-25 AC4: mỗi đơn một mã).
 * @param {number|null} userId chủ đơn (null = khách vãng lai)
 * @returns {Promise<{ couponId: number, couponCode: string, discount: number }>}
 */
export const redeemCoupon = async (tx, code, lines, userId) => {
  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) throw notFound();
  // Điểm chỉ tăng (không có chỗ tiêu điểm) nên đọc không khóa là đủ: không thể giảm xuống dưới ngưỡng giữa chừng
  const points = await pointsOf(tx, userId);
  const eligibleSubtotal = assertUsable(coupon, lines, points, new Date());

  // Giữ chỗ một lượt: điều kiện nằm ngay trong câu UPDATE nên hai đơn tranh lượt cuối không cùng thắng
  const { count } = await tx.coupon.updateMany({
    where: { id: coupon.id, isActive: true, usedCount: { lt: coupon.maxUses } },
    data: { usedCount: { increment: 1 } },
  });
  if (count !== 1) {
    // Vừa hết lượt hoặc vừa bị tắt giữa lúc kiểm tra và giữ chỗ: đọc lại để báo đúng lý do
    const fresh = await tx.coupon.findUnique({ where: { id: coupon.id } });
    assertUsable(fresh, lines, points, new Date());
    throw new AppError(409, PROBLEM_MESSAGES.COUPON_EXHAUSTED, 'COUPON_EXHAUSTED');
  }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discount: calculateDiscount(coupon, eligibleSubtotal),
  };
};

/** Trả lại một lượt dùng khi đơn bị hủy (gọi một lần cho mỗi đơn, trong transaction hủy đơn). */
export const releaseCoupon = (tx, couponId) =>
  tx.coupon.update({ where: { id: couponId }, data: { usedCount: { decrement: 1 } } });

// ---------------------------------------------------------------------------
// Admin (US-24)
// ---------------------------------------------------------------------------

// Tên của các sản phẩm/danh mục/thương hiệu trong phạm vi để Admin đọc được; đã xóa thì name = null
const loadScopeNames = async (coupons) => {
  const idsOf = (key) => [...new Set(coupons.flatMap((coupon) => coupon[key]))];
  const lookup = async (model, key) => {
    const ids = idsOf(key);
    if (ids.length === 0) return new Map();
    const rows = await model.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  };
  const [products, categories, brands] = await Promise.all([
    lookup(prisma.product, 'productIds'),
    lookup(prisma.category, 'categoryIds'),
    lookup(prisma.brand, 'brandIds'),
  ]);
  return { products, categories, brands };
};

const describeIds = (ids, names) => ids.map((id) => ({ id, name: names.get(id) ?? null }));

const toAdminCoupon = (coupon, names, now = new Date()) => ({
  id: coupon.id,
  code: coupon.code,
  type: coupon.type,
  value: coupon.value,
  minOrder: coupon.minOrder,
  minPoints: coupon.minPoints,
  startsAt: coupon.startsAt,
  endsAt: coupon.endsAt,
  maxUses: coupon.maxUses,
  usedCount: coupon.usedCount,
  isActive: coupon.isActive,
  state: couponState(coupon, now),
  scoped: hasScope(coupon),
  scope: {
    products: describeIds(coupon.productIds, names.products),
    categories: describeIds(coupon.categoryIds, names.categories),
    brands: describeIds(coupon.brandIds, names.brands),
  },
  createdAt: coupon.createdAt,
});

export const listCoupons = async ({ page, pageSize, search, status }) => {
  const where = {
    ...(search ? { code: { contains: escapeLike(search.toUpperCase()) } } : {}),
    ...(status ? { isActive: status === 'on' } : {}),
  };
  const [coupons, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.coupon.count({ where }),
  ]);
  const names = await loadScopeNames(coupons);
  const now = new Date();
  return {
    items: coupons.map((coupon) => toAdminCoupon(coupon, names, now)),
    page,
    pageSize,
    total,
  };
};

const invalid = (field, message) =>
  new AppError(400, message, 'VALIDATION_ERROR', { [field]: [message] });

// Kiểm tra các quy tắc cần nhìn cả bộ giá trị sau khi sửa (không kiểm tra được từng trường riêng lẻ)
const assertConsistent = ({ type, value, startsAt, endsAt }) => {
  if (type === 'PERCENT' && value > 100) {
    throw invalid('value', 'Giảm theo phần trăm không được quá 100%');
  }
  if (endsAt <= startsAt) throw invalid('endsAt', 'Ngày kết thúc phải sau ngày bắt đầu');
};

// Phạm vi chỉ được chọn sản phẩm, danh mục, thương hiệu có thật (id đã xóa về sau thì vô hại, xem lib/coupon.js)
const assertScopeExists = async ({ productIds, categoryIds, brandIds }) => {
  const checks = [
    ['productIds', productIds, prisma.product, 'sản phẩm'],
    ['categoryIds', categoryIds, prisma.category, 'danh mục'],
    ['brandIds', brandIds, prisma.brand, 'thương hiệu'],
  ];
  for (const [field, ids, model, label] of checks) {
    if (!ids || ids.length === 0) continue;
    const found = await model.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw invalid(field, `Có ${label} được chọn không tồn tại`);
  }
};

export const createCoupon = async (input) => {
  assertConsistent(input);
  await assertScopeExists(input);
  try {
    const coupon = await prisma.coupon.create({ data: input });
    return toAdminCoupon(coupon, await loadScopeNames([coupon]));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(409, 'Mã giảm giá này đã tồn tại', 'COUPON_EXISTS');
    }
    throw error;
  }
};

/**
 * Sửa mã (không đổi được `code` vì đơn cũ đã lưu bản sao mã, BR-04). Đơn đã dùng mã không bị ảnh hưởng.
 * Không cho đặt số lượt tối đa thấp hơn số lượt đã dùng: điều kiện nằm trong chính câu UPDATE nên đơn vừa dùng mã
 * giữa lúc kiểm tra và ghi cũng không làm "đã dùng" vượt "tối đa".
 */
export const updateCoupon = async (id, patch) => {
  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current) throw notFound();

  assertConsistent({ ...current, ...patch });
  await assertScopeExists(patch);
  const maxUses = patch.maxUses ?? current.maxUses;
  const { count } = await prisma.coupon.updateMany({
    where: { id, usedCount: { lte: maxUses } },
    data: patch,
  });
  if (count !== 1) {
    throw new AppError(
      409,
      'Số lượt tối đa không được nhỏ hơn số lượt đã dùng',
      'COUPON_MAX_USES_TOO_LOW',
    );
  }
  const updated = await prisma.coupon.findUnique({ where: { id } });
  return toAdminCoupon(updated, await loadScopeNames([updated]));
};
