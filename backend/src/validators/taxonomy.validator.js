/**
 * @feature [F02] Danh mục và thương hiệu - Quy tắc kiểm tra dữ liệu gửi lên (Zod), theo US-06, US-07.
 * Danh mục và thương hiệu có cùng cấu trúc (tên, ảnh, trạng thái ẩn/hiện) nên dùng chung các quy tắc nhỏ.
 */
import { z } from 'zod';

const name = z.string().trim().min(1, 'Vui lòng nhập tên').max(100, 'Tên tối đa 100 ký tự');

// Chỉ nhận đường dẫn http/https (từ chối javascript:, data:...). Chuỗi rỗng nghĩa là xóa ảnh
const optionalUrl = z
  .union([
    z.literal('').transform(() => null),
    z
      .url({ protocol: /^https?$/, error: 'Đường dẫn phải bắt đầu bằng http:// hoặc https://' })
      .max(500, 'Đường dẫn tối đa 500 ký tự'),
  ])
  .nullable()
  .optional();

const description = z
  .string()
  .trim()
  .max(500, 'Mô tả tối đa 500 ký tự')
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

// Dùng cho cả hai: chỉ khác tên trường ảnh (imageUrl cho danh mục, logoUrl cho thương hiệu)
const withAtLeastOneField = (schema) =>
  schema.partial().refine((data) => Object.keys(data).length > 0, {
    message: 'Không có dữ liệu để cập nhật',
  });

export const createCategorySchema = z.object({
  name,
  description,
  imageUrl: optionalUrl,
  isActive: z.boolean().optional(),
});
export const updateCategorySchema = withAtLeastOneField(createCategorySchema);

export const createBrandSchema = z.object({
  name,
  logoUrl: optionalUrl,
  isActive: z.boolean().optional(),
});
export const updateBrandSchema = withAtLeastOneField(createBrandSchema);

// Tìm theo tên ở trang quản trị
export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
});
