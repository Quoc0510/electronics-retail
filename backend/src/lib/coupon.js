/**
 * @feature [F09] Mã giảm giá - Cách tính số tiền được giảm (US-25 AC3, BR-14) và trạng thái của một mã.
 * Hàm thuần, không đụng CSDL, nên test được riêng và dùng chung cho xem trước, đặt hàng và trang Admin.
 */

/**
 * Số tiền giảm trên tiền hàng (VND, số nguyên - BR-01): PERCENT làm tròn xuống, FIXED không vượt quá tiền hàng.
 * Kết quả luôn nằm trong [0, subtotal] nên tổng tiền sau giảm không bao giờ âm.
 */
export const calculateDiscount = ({ type, value }, subtotal) => {
  const base = Math.max(0, subtotal);
  const raw = type === 'PERCENT' ? Math.floor((base * value) / 100) : value;
  return Math.min(base, Math.max(0, raw));
};

/**
 * Lý do một mã chưa dùng được tại thời điểm `now`, hoặc null nếu dùng được (chưa xét đơn tối thiểu).
 * Thứ tự kiểm tra cố định để cùng một mã luôn báo cùng một lý do.
 */
export const couponProblem = (coupon, now) => {
  if (!coupon.isActive) return 'COUPON_INACTIVE';
  if (now < coupon.startsAt) return 'COUPON_NOT_STARTED';
  if (now >= coupon.endsAt) return 'COUPON_EXPIRED';
  if (coupon.usedCount >= coupon.maxUses) return 'COUPON_EXHAUSTED';
  return null;
};

const STATE_BY_PROBLEM = {
  COUPON_INACTIVE: 'DISABLED',
  COUPON_NOT_STARTED: 'UPCOMING',
  COUPON_EXPIRED: 'EXPIRED',
  COUPON_EXHAUSTED: 'EXHAUSTED',
};

/** Trạng thái hiển thị cho Admin: DISABLED, UPCOMING, EXPIRED, EXHAUSTED hoặc RUNNING (đang dùng được). */
export const couponState = (coupon, now) =>
  STATE_BY_PROBLEM[couponProblem(coupon, now)] ?? 'RUNNING';
