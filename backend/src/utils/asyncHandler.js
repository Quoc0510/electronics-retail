/**
 * @feature [F00] Nền tảng - Bọc controller async để lỗi tự chuyển sang errorHandler.
 * Express 5 đã tự bắt lỗi của hàm async, nhưng vẫn giữ hàm này để mọi controller viết thống nhất
 * và còn hoạt động đúng nếu sau này đổi phiên bản Express.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
