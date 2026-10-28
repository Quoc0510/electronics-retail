/**
 * @feature [F05] Giỏ hàng - Phí vận chuyển ước tính hiển thị ở giỏ hàng (BR-05).
 * Phí cố định 30.000 đ; miễn phí khi tổng tiền hàng từ 5.000.000 đ. Giá trị cuối cùng do backend tính khi đặt hàng (F06),
 * hai nơi dùng chung một quy tắc nên nếu BR-05 đổi phải sửa ở cả hai.
 */
export const SHIPPING_FEE = 30000;
export const FREE_SHIPPING_THRESHOLD = 5000000;

export const shippingFee = (subtotal) =>
  subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

/** Số tiền còn thiếu để được miễn phí vận chuyển; 0 nếu đã đủ hoặc giỏ trống. */
export const amountToFreeShipping = (subtotal) =>
  subtotal === 0 ? 0 : Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
