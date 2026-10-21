/**
 * @feature [F01] Xác thực (frontend) - Chuyển lỗi của axios thành thông báo tiếng Việt cho người dùng.
 * Phân biệt lỗi do máy chủ trả về (có sẵn message), hết thời gian chờ và mất kết nối
 * (xử lý các trạng thái biên theo rubric TC2.2).
 */

/** Lỗi do chính frontend tạo ra, có message đã là câu hoàn chỉnh để hiển thị thẳng cho người dùng. */
export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export const getErrorMessage = (error, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại') => {
  if (error instanceof UserFacingError) return error.message;
  const serverMessage = error?.response?.data?.error?.message;
  if (serverMessage) return serverMessage;
  if (error?.code === 'ECONNABORTED') return 'Máy chủ phản hồi quá chậm, vui lòng thử lại';
  if (!error?.response) return 'Không kết nối được máy chủ, vui lòng kiểm tra đường truyền';
  return fallback;
};

/**
 * Lấy lỗi theo từng trường từ phản hồi VALIDATION_ERROR của backend.
 * Backend trả { details: { password: ['msg1', 'msg2'] } }; hàm này lấy thông báo đầu tiên của mỗi trường.
 * @returns {Record<string, string>} Ví dụ { password: 'Mật khẩu phải có ít nhất 8 ký tự' }
 */
export const getFieldErrors = (error) => {
  const details = error?.response?.data?.error?.details ?? {};
  return Object.fromEntries(
    Object.entries(details)
      .filter(([, messages]) => messages?.length)
      .map(([field, messages]) => [field, messages[0]]),
  );
};
