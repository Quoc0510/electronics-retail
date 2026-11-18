/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Kiểm tra dữ liệu vào cho API địa chỉ và ước tính phí (US-37).
 */
import { z } from 'zod';
import { guestCartSchema } from './cart.validator.js';

export const provinceParamsSchema = z.object({
  provinceId: z.coerce.number().int().positive('Mã tỉnh/thành không hợp lệ'),
});

// Tên tỉnh và phường/xã phải lấy từ danh mục GHN (các endpoint trên), nên không cần quy tắc khác ngoài độ dài
export const quoteShippingSchema = z.object({
  items: guestCartSchema.shape.items.min(1, 'Giỏ hàng đang trống'),
  province: z.string().trim().min(1, 'Vui lòng chọn tỉnh/thành phố').max(100),
  ward: z.string().trim().min(1, 'Vui lòng chọn phường/xã').max(100),
  street: z.string().trim().max(200).optional(),
  recipientName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(20).optional(),
});
