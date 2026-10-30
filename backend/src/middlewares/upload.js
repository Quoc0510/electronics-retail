/**
 * @feature [F03] Sản phẩm - Nhận file ảnh tải lên (multipart/form-data) bằng multer, US-08 AC6.
 * Giữ file trong bộ nhớ để kiểm tra nội dung thật (magic bytes) rồi mới ghi ra đĩa, nhờ đó file không hợp lệ
 * không bao giờ chạm tới ổ đĩa. Giới hạn dung lượng nên bộ nhớ dùng là có hạn (tối đa 6 file x 2MB).
 */
import multer from 'multer';
import { AppError } from '../utils/AppError.js';

export const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB mỗi ảnh
export const MAX_IMAGES_PER_PRODUCT = 6;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_IMAGES_PER_PRODUCT, fields: 0 },
});

// Chuyển lỗi của multer thành AppError để errorHandler trả JSON thống nhất
const translateUploadError = (error) => {
  if (!(error instanceof multer.MulterError)) return error;
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new AppError(413, 'Mỗi ảnh tối đa 2MB', 'IMAGE_TOO_LARGE');
  }
  if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError(
      400,
      `Mỗi lần chỉ tải tối đa ${MAX_IMAGES_PER_PRODUCT} ảnh`,
      'TOO_MANY_IMAGES',
    );
  }
  return new AppError(400, 'Không đọc được file tải lên', 'UPLOAD_ERROR');
};

// [F14] File Excel nhập sản phẩm: một file .xlsx tối đa 2MB, giữ trong bộ nhớ (không ghi ra đĩa); nội dung thật được kiểm tra ở service
export const MAX_SPREADSHEET_SIZE = 2 * 1024 * 1024;
const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SPREADSHEET_SIZE, files: 1, fields: 0 },
});

/** Middleware: đọc file ở trường "file" vào req.file; thiếu file hoặc file quá lớn thì báo lỗi rõ ràng */
export const uploadSpreadsheet = (req, res, next) => {
  spreadsheetUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'File Excel tối đa 2MB', 'IMPORT_FILE_TOO_LARGE'));
      }
      return next(new AppError(400, 'Chỉ tải lên một file Excel ở trường "file"', 'UPLOAD_ERROR'));
    }
    if (error) return next(error);
    if (!req.file)
      return next(new AppError(400, 'Vui lòng chọn file Excel (.xlsx)', 'IMPORT_NO_FILE'));
    return next();
  });
};

/** Middleware: đọc các file ở trường "images" vào req.files */
export const uploadImages = (req, res, next) => {
  upload.array('images', MAX_IMAGES_PER_PRODUCT)(req, res, (error) => {
    next(error ? translateUploadError(error) : undefined);
  });
};
