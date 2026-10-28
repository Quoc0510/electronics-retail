/**
 * @feature [F07] Quản lý đơn hàng - Luồng trạng thái đơn hàng (BR-06).
 * PENDING -> CONFIRMED -> SHIPPING -> COMPLETED; được hủy (CANCELLED) khi đang PENDING hoặc CONFIRMED.
 * Không đi lùi và không đổi trạng thái của đơn đã COMPLETED hoặc CANCELLED. Là nguồn sự thật duy nhất cho cả
 * khách (chỉ hủy được khi PENDING) lẫn quản trị viên; giao diện chỉ dùng bản sao để hiện nút đúng.
 */
export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'];

export const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const allowedNext = (status) => TRANSITIONS[status] ?? [];

export const canTransition = (from, to) => allowedNext(from).includes(to);
