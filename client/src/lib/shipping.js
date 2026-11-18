/**
 * @feature [F05][F16] Giỏ hàng, đặt hàng - Quy tắc phí vận chuyển ở Client (BR-05).
 * Mặc định là phí cố định 30.000 đ, miễn phí từ 5.000.000 đ. Cửa hàng đổi hai số này bằng biến môi trường của backend nên các
 * hàm nhận thêm `config` ({ fallbackFee, freeThreshold }) lấy từ API /shipping/config; không truyền thì dùng mặc định (giống
 * backend). Khi bật Giao Hàng Nhanh, phí gốc theo địa chỉ lấy từ API /shipping/quote và đi qua `applyFreeShipping`.
 * Giá trị cuối cùng luôn do backend tính khi đặt hàng; ở đây chỉ để hiển thị.
 */
export const SHIPPING_FEE = 30000;
export const FREE_SHIPPING_THRESHOLD = 5000000;

export const DEFAULT_SHIPPING_CONFIG = {
  provider: 'FIXED',
  fallbackFee: SHIPPING_FEE,
  freeThreshold: FREE_SHIPPING_THRESHOLD,
};

/** Miễn phí khi tiền hàng (sau giảm giá) đạt ngưỡng; ngưỡng 0 nghĩa là không miễn phí cho đơn nào. */
export const applyFreeShipping = (baseFee, payable, freeThreshold = FREE_SHIPPING_THRESHOLD) =>
  freeThreshold > 0 && payable >= freeThreshold ? 0 : baseFee;

/** Phí cố định (chưa bật GHN hoặc chưa có địa chỉ để hỏi GHN); giỏ trống thì không có phí. */
export const shippingFee = (subtotal, config = DEFAULT_SHIPPING_CONFIG) =>
  subtotal === 0 ? 0 : applyFreeShipping(config.fallbackFee, subtotal, config.freeThreshold);

/** Số tiền còn thiếu để được miễn phí vận chuyển; 0 nếu đã đủ, giỏ trống hoặc cửa hàng không có ngưỡng miễn phí. */
export const amountToFreeShipping = (subtotal, freeThreshold = FREE_SHIPPING_THRESHOLD) =>
  subtotal === 0 || freeThreshold <= 0 ? 0 : Math.max(0, freeThreshold - subtotal);
