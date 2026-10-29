/**
 * @feature [F13] Điểm thành viên - Quy tắc tính điểm (BR-15): điểm tính theo TỔNG tiền hàng của mọi đơn đã hoàn thành,
 * mỗi 1.000.000 ₫ được 1 điểm, làm tròn xuống. Chỉ tính trên tiền hàng (subtotal), không tính phí vận chuyển.
 * Cộng dồn nên phần lẻ không mất: đơn 600.000 ₫ rồi đơn 600.000 ₫ nữa thì đơn thứ hai mới được điểm đầu tiên.
 * Bản sao của shared/src/points.js để Client hiển thị đúng số điểm dự kiến; test đối chiếu hai bản (cùng cách làm với orderStatus).
 */
export const POINT_UNIT_VND = 1_000_000;

/** Điểm tương ứng với một tổng số tiền đã mua. */
export const pointsForSpent = (totalSpent) => Math.floor(Math.max(0, totalSpent) / POINT_UNIT_VND);

/**
 * Điểm được cộng thêm khi một đơn tiền hàng `subtotal` hoàn thành, biết trước đó thành viên đã mua `spentBefore`.
 * Là phần điểm tăng thêm sau khi cộng đơn vào tổng.
 */
export const calculatePoints = (spentBefore, subtotal) =>
  pointsForSpent(Math.max(0, spentBefore) + Math.max(0, subtotal)) - pointsForSpent(spentBefore);

/** Số tiền còn thiếu để được thêm 1 điểm nữa (luôn từ 1 đến POINT_UNIT_VND). */
export const amountToNextPoint = (totalSpent) =>
  POINT_UNIT_VND - (Math.max(0, totalSpent) % POINT_UNIT_VND);
