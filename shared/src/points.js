/**
 * @feature [F13] Điểm thành viên - Quy tắc tính điểm (BR-15), dùng chung cho Client và Admin để hiển thị điểm dự kiến.
 * Điểm tính theo TỔNG tiền hàng của mọi đơn đã hoàn thành, mỗi 1.000.000 ₫ được 1 điểm, làm tròn xuống; không tính phí vận chuyển.
 * Bản gốc tính điểm thật nằm ở backend/src/lib/points.js (test đối chiếu hai bản).
 */
export const POINT_UNIT_VND = 1_000_000;

/** Điểm tương ứng với một tổng số tiền đã mua. */
export const pointsForSpent = (totalSpent) => Math.floor(Math.max(0, totalSpent) / POINT_UNIT_VND);

/** Điểm được cộng thêm khi một đơn tiền hàng `subtotal` hoàn thành, biết trước đó thành viên đã mua `spentBefore`. */
export const calculatePoints = (spentBefore, subtotal) =>
  pointsForSpent(Math.max(0, spentBefore) + Math.max(0, subtotal)) - pointsForSpent(spentBefore);

/** Số tiền còn thiếu để được thêm 1 điểm nữa (luôn từ 1 đến POINT_UNIT_VND). */
export const amountToNextPoint = (totalSpent) =>
  POINT_UNIT_VND - (Math.max(0, totalSpent) % POINT_UNIT_VND);
