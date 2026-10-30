/**
 * @feature [F14] Nhập sản phẩm từ Excel - Kiểm tra tham số của API nhập (US-35, US-36).
 * Chế độ nằm trên query (không nằm trong form tải file) vì multer chỉ đọc file, các trường văn bản bị tắt.
 */
import { z } from 'zod';

export const IMPORT_MODES = ['create', 'update'];

export const importQuerySchema = z.object({
  mode: z.enum(IMPORT_MODES, {
    error: 'Chế độ nhập phải là create (thêm mới) hoặc update (cập nhật)',
  }),
});
