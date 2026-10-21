/**
 * @feature [F00] Nền tảng - Xử lý lỗi tập trung và trả về JSON thống nhất.
 * Định dạng lỗi: { error: { code, message, details? } }
 * Lỗi không lường trước (500) chỉ ghi vào log, không lộ chi tiết ra cho người dùng.
 */
import { ZodError, flattenError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';

// Route không tồn tại -> 404
export const notFound = (req, _res, next) => {
  next(new AppError(404, `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
};

// Express nhận diện error handler qua đủ 4 tham số, nên phải giữ _next dù không dùng
export const errorHandler = (err, _req, res, _next) => {
  // Dữ liệu gửi lên không hợp lệ (validate bằng zod)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        details: flattenError(err).fieldErrors,
      },
    });
  }

  // Lỗi nghiệp vụ do mình chủ động ném ra
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
  }

  // Body JSON bị sai cú pháp
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON không hợp lệ' } });
  }

  // Lỗi bất ngờ: ghi log đầy đủ, trả thông báo chung
  logger.error(err);
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: 'Đã có lỗi xảy ra, vui lòng thử lại sau' } });
};
