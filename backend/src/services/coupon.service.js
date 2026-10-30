/**
 * @feature [F09] Mã giảm giá - Nghiệp vụ mã giảm giá: khách xem trước số tiền giảm, đặt hàng dùng mã, Admin quản lý mã
 * (US-24, US-25, BR-14).
 *
 * Số tiền giảm LUÔN do máy chủ tính lại khi đặt hàng (redeemCoupon) từ tiền hàng thật trong giỏ; con số Client xem trước
 * chỉ để hiển thị. Lượt dùng được giữ chỗ bằng một câu UPDATE có điều kiện (used_count < max_uses) trong CHÍNH transaction
 * đặt hàng: đơn lỗi thì lượt dùng được hoàn lại cùng transaction, hai đơn tranh lượt cuối thì chỉ một đơn thắng, và hủy
 * đơn thì trả lại lượt (releaseCoupon).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { escapeLike } from '../lib/like.js';
import { calculateDiscount, couponProblem, couponState } from '../lib/coupon.js';
import { AppError } from '../utils/AppError.js';

const PROBLEM_MESSAGES = {
  COUPON_INACTIVE: 'Mã giảm giá này đã ngừng áp dụng',
  COUPON_NOT_STARTED: 'Mã giảm giá chưa đến thời gian áp dụng',
  COUPON_EXPIRED: 'Mã giảm giá đã hết hạn',
  COUPON_EXHAUSTED: 'Mã giảm giá đã hết lượt sử dụng',
};

const notFound = () => new AppError(404, 'Mã giảm giá không tồn tại', 'COUPON_NOT_FOUND');

const formatVnd = (amount) => `${amount.toLocaleString('vi-VN')} đ`;

// Ném lỗi đúng lý do mã không dùng được cho tiền hàng này (US-25 AC2)
const assertUsable = (coupon, subtotal, now) => {
  const problem = couponProblem(coupon, now);
  if (problem) throw new AppError(400, PROBLEM_MESSAGES[problem], problem);
  if (subtotal < coupon.minOrder) {
    throw new AppError(
      400,
      `Đơn hàng cần từ ${formatVnd(coupon.minOrder)} tiền hàng để dùng mã này`,
      'COUPON_MIN_ORDER',
      { minOrder: coupon.minOrder },
    );
  }
};

const toQuote = (coupon, subtotal) => ({
  code: coupon.code,
  type: coupon.type,
  value: coupon.value,
  minOrder: coupon.minOrder,
  discount: calculateDiscount(coupon, subtotal),
});

/** US-25 AC1, AC2: xem trước số tiền giảm của một mã với tiền hàng hiện tại; không giữ chỗ lượt dùng. */
export const previewCoupon = async (code, subtotal) => {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon) throw notFound();
  assertUsable(coupon, subtotal, new Date());
  return toQuote(coupon, subtotal);
};

/**
 * Dùng mã cho một đơn có tiền hàng `subtotal`, TRONG transaction đặt hàng của người gọi (US-25 AC4: mỗi đơn một mã).
 * @returns {Promise<{ couponId: number, couponCode: string, discount: number }>}
 */
export const redeemCoupon = async (tx, code, subtotal) => {
  const coupon = await tx.coupon.findUnique({ where: { code } });
  if (!coupon) throw notFound();
  assertUsable(coupon, subtotal, new Date());

  // Giữ chỗ một lượt: điều kiện nằm ngay trong câu UPDATE nên hai đơn tranh lượt cuối không cùng thắng
  const { count } = await tx.coupon.updateMany({
    where: { id: coupon.id, isActive: true, usedCount: { lt: coupon.maxUses } },
    data: { usedCount: { increment: 1 } },
  });
  if (count !== 1) {
    // Vừa hết lượt hoặc vừa bị tắt giữa lúc kiểm tra và giữ chỗ: đọc lại để báo đúng lý do
    const fresh = await tx.coupon.findUnique({ where: { id: coupon.id } });
    assertUsable(fresh, subtotal, new Date());
    throw new AppError(409, PROBLEM_MESSAGES.COUPON_EXHAUSTED, 'COUPON_EXHAUSTED');
  }
  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    discount: calculateDiscount(coupon, subtotal),
  };
};

/** Trả lại một lượt dùng khi đơn bị hủy (gọi một lần cho mỗi đơn, trong transaction hủy đơn). */
export const releaseCoupon = (tx, couponId) =>
  tx.coupon.update({ where: { id: couponId }, data: { usedCount: { decrement: 1 } } });

// ---------------------------------------------------------------------------
// Admin (US-24)
// ---------------------------------------------------------------------------

const toAdminCoupon = (coupon, now = new Date()) => ({
  id: coupon.id,
  code: coupon.code,
  type: coupon.type,
  value: coupon.value,
  minOrder: coupon.minOrder,
  startsAt: coupon.startsAt,
  endsAt: coupon.endsAt,
  maxUses: coupon.maxUses,
  usedCount: coupon.usedCount,
  isActive: coupon.isActive,
  state: couponState(coupon, now),
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
  const now = new Date();
  return { items: coupons.map((coupon) => toAdminCoupon(coupon, now)), page, pageSize, total };
};

const invalid = (field, message) =>
  new AppError(400, message, 'VALIDATION_ERROR', { fields: { [field]: [message] } });

// Kiểm tra các quy tắc cần nhìn cả bộ giá trị sau khi sửa (không kiểm tra được từng trường riêng lẻ)
const assertConsistent = ({ type, value, startsAt, endsAt }) => {
  if (type === 'PERCENT' && value > 100) {
    throw invalid('value', 'Giảm theo phần trăm không được quá 100%');
  }
  if (endsAt <= startsAt) throw invalid('endsAt', 'Ngày kết thúc phải sau ngày bắt đầu');
};

export const createCoupon = async (input) => {
  assertConsistent(input);
  try {
    return toAdminCoupon(await prisma.coupon.create({ data: input }));
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
  return toAdminCoupon(await prisma.coupon.findUnique({ where: { id } }));
};
