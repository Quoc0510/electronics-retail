/**
 * @feature [F00] Nền tảng - Lỗi nghiệp vụ có mã HTTP rõ ràng.
 * Service ném AppError (ví dụ: new AppError(404, 'Không tìm thấy sản phẩm')),
 * middleware errorHandler sẽ chuyển thành phản hồi JSON thống nhất.
 */
export class AppError extends Error {
  /**
   * @param {number} statusCode Mã HTTP (400, 401, 403, 404, 409...)
   * @param {string} message Thông báo hiển thị cho người dùng
   * @param {string} [code] Mã lỗi ngắn gọn cho frontend xử lý, ví dụ 'OUT_OF_STOCK'
   * @param {object} [details] Dữ liệu chi tiết kèm theo lỗi, ví dụ danh sách sản phẩm không đủ hàng (F06)
   */
  constructor(statusCode, message, code = 'ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
