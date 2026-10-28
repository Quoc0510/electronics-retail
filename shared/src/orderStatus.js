/**
 * @feature [F06][F07] Đơn hàng - Nhãn tiếng Việt, màu và luồng trạng thái của đơn hàng, dùng chung cho Client và Admin.
 * Luồng (BR-06) ở đây chỉ để giao diện hiện đúng nút; backend (backend/src/lib/orderStatus.js) mới là nơi quyết định và
 * từ chối bước sai, nên nếu BR-06 đổi phải sửa ở cả hai nơi.
 */
export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPING', 'COMPLETED', 'CANCELLED'];

export const ORDER_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao hàng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const ORDER_STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-sky-100 text-sky-800',
  SHIPPING: 'bg-violet-100 text-violet-800',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-200 text-slate-600',
};

export const PAYMENT_METHOD_LABELS = { COD: 'Thanh toán khi nhận hàng (COD)' };
export const PAYMENT_STATUS_LABELS = { UNPAID: 'Chưa thanh toán', PAID: 'Đã thanh toán' };

// Các bước tiếp theo được phép từ mỗi trạng thái
export const ORDER_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

/** Ngày giờ kiểu Việt Nam, ví dụ "09:15 28/10/2026". */
export const formatDateTime = (value) =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
