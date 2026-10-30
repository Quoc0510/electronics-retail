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

/** Mã có giới hạn phạm vi không (có ít nhất một sản phẩm, danh mục hoặc thương hiệu được chọn). */
export const hasScope = (coupon) =>
  coupon.productIds.length + coupon.categoryIds.length + coupon.brandIds.length > 0;

/**
 * Dòng hàng có được mã áp dụng không. Phạm vi là HỢP của ba danh sách: khớp sản phẩm, HOẶC danh mục, HOẶC thương hiệu.
 * Mã không chọn gì (cả ba rỗng) áp dụng cho mọi dòng. Danh sách còn id nhưng sản phẩm/danh mục đó đã bị xóa thì chỉ
 * không khớp ai, KHÔNG biến mã thành "áp dụng tất cả".
 * @param {{ productId: number, categoryId: number, brandId: number }} line
 */
export const isLineEligible = (coupon, line) =>
  !hasScope(coupon) ||
  coupon.productIds.includes(line.productId) ||
  coupon.categoryIds.includes(line.categoryId) ||
  coupon.brandIds.includes(line.brandId);

/** Các dòng hàng được mã áp dụng và tiền hàng của riêng chúng (số tiền giảm và đơn tối thiểu tính trên phần này). */
export const eligibleLines = (coupon, lines) =>
  lines.filter((line) => isLineEligible(coupon, line));

export const linesSubtotal = (lines) =>
  lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

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
