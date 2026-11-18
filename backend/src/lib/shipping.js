/**
 * @feature [F06][F16] Đặt hàng - Quy tắc phí vận chuyển (BR-05).
 * Phí gốc do Giao Hàng Nhanh tính theo địa chỉ và cân nặng (F16); chưa bật GHN hoặc GHN không trả lời được thì dùng phí cố
 * định SHIPPING_FALLBACK_FEE (mặc định 30.000 đ). Tiền hàng SAU giảm giá từ SHIPPING_FREE_THRESHOLD (mặc định 5.000.000 đ)
 * thì miễn phí (cửa hàng chịu phí GHN). Giá trị này do backend tính khi tạo đơn (nguồn sự thật); Client chỉ hiển thị ước tính.
 */
import { env } from '../config/env.js';

/** Áp quy tắc miễn phí lên phí gốc; threshold 0 nghĩa là không miễn phí cho đơn nào. */
export const applyFreeShipping = (
  baseFee,
  amountAfterDiscount,
  threshold = env.SHIPPING_FREE_THRESHOLD,
) => (threshold > 0 && amountAfterDiscount >= threshold ? 0 : baseFee);

/** Phí cố định (không qua GHN) cho một mức tiền hàng. */
export const calculateShippingFee = (subtotal) =>
  applyFreeShipping(env.SHIPPING_FALLBACK_FEE, subtotal);
