/**
 * @feature [F01] Xác thực (frontend) - Quy tắc kiểm tra form phía trình duyệt.
 * Giống hệt quy tắc ở backend (backend/src/validators/auth.validator.js) để báo lỗi ngay khi nhập,
 * không phải chờ gửi lên máy chủ. Backend vẫn kiểm tra lại, đây chỉ để cải thiện trải nghiệm.
 */

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

// US-04 AC4: số điện thoại Việt Nam, 10 số và bắt đầu bằng 0
export const isValidPhone = (value) => /^0\d{9}$/.test(value.trim());

// US-01 AC2: >= 8 ký tự, có cả chữ và số. Trả về thông báo lỗi, hoặc chuỗi rỗng nếu hợp lệ
export const validatePassword = (value) => {
  if (value.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự';
  if (value.length > 72) return 'Mật khẩu tối đa 72 ký tự';
  if (!/[A-Za-z]/.test(value)) return 'Mật khẩu phải có ít nhất một chữ cái';
  if (!/\d/.test(value)) return 'Mật khẩu phải có ít nhất một chữ số';
  return '';
};
