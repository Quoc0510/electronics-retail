/**
 * @feature [F06] Đặt hàng - Quy tắc kiểm tra dữ liệu đặt hàng (US-16 AC1).
 * Khách chọn MỘT địa chỉ đã lưu (addressId) HOẶC nhập địa chỉ mới (shipping), không phải cả hai, không phải không có gì.
 * Tồn kho, giỏ trống, sản phẩm đã ẩn được kiểm tra ở service trong transaction vì cần dữ liệu hiện tại của CSDL.
 */
import { z } from 'zod';
import { ORDER_CODE_PATTERN } from '../lib/orderCode.js';
import { addressSchema } from './auth.validator.js';

// Địa chỉ nhập trực tiếp khi đặt hàng: giống địa chỉ trong sổ nhưng không có cờ "mặc định"
const shippingSchema = addressSchema.omit({ isDefault: true });

export const createOrderSchema = z
  .object({
    addressId: z
      .number({ error: 'Mã địa chỉ phải là số' })
      .int('Mã địa chỉ phải là số nguyên')
      .positive('Mã địa chỉ không hợp lệ')
      .optional(),
    shipping: shippingSchema.optional(),
    // Ghi chú cho người giao hàng; chuỗi rỗng coi như không có
    note: z
      .string()
      .trim()
      .max(500, 'Ghi chú tối đa 500 ký tự')
      .optional()
      .transform((value) => value || undefined),
  })
  .refine((data) => (data.addressId === undefined) !== (data.shipping === undefined), {
    message: 'Hãy chọn một địa chỉ đã lưu hoặc nhập địa chỉ giao hàng mới (chỉ một trong hai)',
    path: ['shipping'],
  });

export const orderCodeParamSchema = z.object({
  code: z.string().regex(ORDER_CODE_PATTERN, 'Mã đơn hàng không hợp lệ'),
});
