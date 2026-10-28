/**
 * @feature [F13] Đặt hàng không cần đăng nhập - Hỗ trợ cho khách vãng lai ở trình duyệt.
 *  - requestId: mã sinh MỖI LẦN mở trang đặt hàng, gửi kèm đơn để máy chủ không tạo hai đơn khi bấm đúp hoặc thử lại.
 *  - Số điện thoại của đơn vừa đặt/vừa tra cứu được nhớ trong sessionStorage (chỉ trong tab, mất khi đóng tab) để tải lại
 *    trang đơn hàng vẫn xem được mà không đưa số điện thoại lên đường dẫn. Không dùng được sessionStorage thì chỉ là
 *    phải nhập lại ở trang tra cứu.
 */

const storageKey = (code) => `techstore.guestOrder.${code}`;

export const rememberGuestOrder = (code, phone) => {
  try {
    sessionStorage.setItem(storageKey(code), phone);
  } catch {
    // Bị chặn (chế độ riêng tư): bỏ qua, khách tra cứu lại bằng mã đơn + số điện thoại
  }
};

export const getGuestOrderPhone = (code) => {
  try {
    return sessionStorage.getItem(storageKey(code));
  } catch {
    return null;
  }
};

/** UUID v4. Dùng crypto.randomUUID khi có; trang chạy trên http ngoài localhost không có hàm này nên tự dựng từ getRandomValues. */
export const newRequestId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // phiên bản 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // biến thể RFC 4122
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
