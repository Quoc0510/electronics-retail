/**
 * @feature [F13] Điểm thành viên - Quy tắc tính điểm (BR-15), dùng chung cho Client và Admin để hiển thị điểm dự kiến.
 * Mỗi 10.000 ₫ tiền hàng được 1 điểm, làm tròn xuống; không tính phí vận chuyển.
 * Bản gốc tính điểm thật nằm ở backend/src/lib/points.js (test đối chiếu hai bản).
 */
export const POINT_UNIT_VND = 10_000;

export const calculatePoints = (subtotal) => Math.floor(Math.max(0, subtotal) / POINT_UNIT_VND);
