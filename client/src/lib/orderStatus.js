/**
 * @feature [F06] Đặt hàng - Nhãn tiếng Việt và màu của trạng thái đơn hàng, trạng thái thanh toán (BR-06, BR-08).
 * Dùng chung cho trang đơn hàng của khách (F06, F07) và trang quản lý đơn của Admin.
 */
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

/** Ngày giờ kiểu Việt Nam, ví dụ "28/10/2026 09:15". */
export const formatDateTime = (value) =>
  new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
