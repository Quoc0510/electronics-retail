/**
 * @feature [F00] Nền tảng - Quy tắc kiểm tra dùng chung cho nhiều tính năng.
 */
import { z } from 'zod';

// Tham số :id trên đường dẫn phải là số nguyên dương (chuỗi như "abc" bị từ chối với 400)
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
