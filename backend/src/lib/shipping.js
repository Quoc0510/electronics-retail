/**
 * @feature [F06] Đặt hàng - Phí vận chuyển (BR-05): cố định 30.000 đ, miễn phí khi tổng tiền hàng từ 5.000.000 đ.
 * Giá trị này do backend tính khi tạo đơn (nguồn sự thật); giỏ hàng ở Client chỉ hiển thị ước tính theo cùng quy tắc.
 */
export const SHIPPING_FEE = 30000;
export const FREE_SHIPPING_THRESHOLD = 5000000;

export const calculateShippingFee = (subtotal) =>
  subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
