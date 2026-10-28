/**
 * @feature [F13] Điểm thành viên - Quy tắc tính điểm (BR-15): mỗi 10.000 ₫ tiền hàng được 1 điểm, làm tròn xuống.
 * Chỉ tính trên tiền hàng (subtotal), không tính phí vận chuyển. Bản sao của shared/src/points.js để Client hiển thị
 * đúng số điểm dự kiến; test đối chiếu hai bản (cùng cách làm với orderStatus).
 */
export const POINT_UNIT_VND = 10_000;

export const calculatePoints = (subtotal) => Math.floor(Math.max(0, subtotal) / POINT_UNIT_VND);
