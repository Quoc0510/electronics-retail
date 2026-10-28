/**
 * @feature [F06][F07] Đơn hàng - Nhãn và màu trạng thái đơn hàng. Nội dung nằm ở package dùng chung (shared/src/orderStatus.js)
 * để Admin dùng cùng một bộ nhãn; file này giữ đường dẫn import cũ của Client.
 */
export {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  ORDER_STATUSES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
} from '@techstore/shared';
