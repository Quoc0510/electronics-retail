/**
 * @feature [F10] Quản lý người dùng - Kiểm tra dữ liệu vào cho API quản trị người dùng (US-27).
 */
import { z } from 'zod';

// US-27 AC1: tìm theo email (hoặc tên), lọc theo trạng thái khóa, phân trang
export const listAdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z
    .string()
    .trim()
    .max(100, 'Từ khóa tối đa 100 ký tự')
    .optional()
    .transform((value) => value || undefined),
  status: z.enum(['active', 'locked'], { error: 'Trạng thái tài khoản không hợp lệ' }).optional(),
});

// Phải là boolean thật: chuỗi "false" bị từ chối để không vô tình mở khóa (hoặc khóa) nhầm
export const updateUserStatusSchema = z.object({
  isActive: z.boolean({ error: 'Trạng thái tài khoản phải là true hoặc false' }),
});
