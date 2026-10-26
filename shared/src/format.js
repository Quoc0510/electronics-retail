/**
 * @feature [F03] Sản phẩm - Hàm định dạng và xử lý đường dẫn dùng chung cho Client và Admin.
 */

/** Định dạng tiền VND: 19990000 -> "19.990.000 ₫" (BR-01: tiền là số nguyên đồng). */
export const formatVnd = (amount) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;

/**
 * Đổi đường dẫn ảnh thành địa chỉ đầy đủ để dùng trong thẻ <img>.
 *  - Ảnh ngoài (http/https, ví dụ dữ liệu mẫu) giữ nguyên.
 *  - Ảnh do backend lưu có dạng "/uploads/..." nên cần thêm địa chỉ gốc của backend (origin).
 *    Khi dev, origin để rỗng vì Vite chuyển tiếp /uploads sang backend; khi deploy đặt VITE_ASSET_URL.
 * @returns {string|null} null nếu không có ảnh
 */
export const resolveAssetUrl = (url, origin = '') => {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : `${origin}${url}`;
};
