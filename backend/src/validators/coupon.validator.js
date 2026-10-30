/**
 * @feature [F09] Mã giảm giá - Kiểm tra dữ liệu vào cho API mã giảm giá (US-24, US-25).
 */
import { z } from 'zod';

const COUPON_TYPES = ['PERCENT', 'FIXED'];
const MAX_AMOUNT = 2_000_000_000; // giữ trong giới hạn Int của PostgreSQL

// Mã luôn lưu in hoa: khách gõ "giam10" vẫn dùng được mã GIAM10
export const couponCode = z
  .string({ error: 'Vui lòng nhập mã giảm giá' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{3,30}$/, 'Mã gồm 3-30 ký tự: chữ, số, dấu gạch ngang hoặc gạch dưới');

const money = (label) =>
  z
    .number({ error: `${label} phải là số` })
    .int(`${label} phải là số nguyên`)
    .min(0, `${label} không được âm`)
    .max(MAX_AMOUNT, `${label} quá lớn`);

const date = (label) => z.coerce.date({ error: `${label} không hợp lệ` });

const fields = {
  type: z.enum(COUPON_TYPES, { error: 'Loại mã phải là PERCENT hoặc FIXED' }),
  value: money('Mức giảm').min(1, 'Mức giảm phải lớn hơn 0'),
  minOrder: money('Đơn tối thiểu'),
  startsAt: date('Ngày bắt đầu'),
  endsAt: date('Ngày kết thúc'),
  maxUses: z
    .number({ error: 'Số lượt tối đa phải là số' })
    .int('Số lượt tối đa phải là số nguyên')
    .min(1, 'Số lượt tối đa phải từ 1')
    .max(1_000_000, 'Số lượt tối đa quá lớn'),
  isActive: z.boolean({ error: 'Trạng thái phải là true hoặc false' }),
};

export const createCouponSchema = z.object({
  code: couponCode,
  type: fields.type,
  value: fields.value,
  minOrder: fields.minOrder.default(0),
  startsAt: fields.startsAt,
  endsAt: fields.endsAt,
  maxUses: fields.maxUses,
  isActive: fields.isActive.default(true),
});

// Sửa từng phần; không nhận `code` (không đổi được mã). Quy tắc nhìn cả bộ giá trị do service kiểm tra
export const updateCouponSchema = z
  .strictObject({
    type: fields.type.optional(),
    value: fields.value.optional(),
    minOrder: fields.minOrder.optional(),
    startsAt: fields.startsAt.optional(),
    endsAt: fields.endsAt.optional(),
    maxUses: fields.maxUses.optional(),
    isActive: fields.isActive.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Không có thông tin nào để cập nhật',
  });

// US-25: tiền hàng hiện tại của khách (chỉ để xem trước, đặt hàng tính lại từ giỏ thật)
export const previewCouponSchema = z.object({
  code: couponCode,
  subtotal: money('Tiền hàng'),
});

export const listCouponsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z
    .string()
    .trim()
    .max(30, 'Từ khóa tối đa 30 ký tự')
    .optional()
    .transform((value) => value || undefined),
  status: z.enum(['on', 'off'], { error: 'Trạng thái không hợp lệ' }).optional(),
});

// Mã khách nhập khi đặt hàng; chuỗi rỗng coi như không dùng mã
export const orderCouponCode = z
  .union([couponCode, z.literal('').transform(() => undefined)])
  .optional();
