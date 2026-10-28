/**
 * @feature [F06] Đặt hàng - Quy tắc kiểm tra dữ liệu đặt hàng (US-16 AC1).
 * Khách chọn MỘT địa chỉ đã lưu (addressId) HOẶC nhập địa chỉ mới (shipping), không phải cả hai, không phải không có gì.
 * Tồn kho, giỏ trống, sản phẩm đã ẩn được kiểm tra ở service trong transaction vì cần dữ liệu hiện tại của CSDL.
 */
import { z } from 'zod';
import { ORDER_CODE_PATTERN } from '../lib/orderCode.js';
import { ORDER_STATUSES } from '../lib/orderStatus.js';
import { addressSchema, phone } from './auth.validator.js';
import { guestCartSchema } from './cart.validator.js';

// Địa chỉ nhập trực tiếp khi đặt hàng: giống địa chỉ trong sổ nhưng không có cờ "mặc định"
const shippingSchema = addressSchema.omit({ isDefault: true });

// Ghi chú cho người giao hàng; chuỗi rỗng coi như không có
const note = z
  .string()
  .trim()
  .max(500, 'Ghi chú tối đa 500 ký tự')
  .optional()
  .transform((value) => value || undefined);

export const createOrderSchema = z
  .object({
    addressId: z
      .number({ error: 'Mã địa chỉ phải là số' })
      .int('Mã địa chỉ phải là số nguyên')
      .positive('Mã địa chỉ không hợp lệ')
      .optional(),
    shipping: shippingSchema.optional(),
    note,
  })
  .refine((data) => (data.addressId === undefined) !== (data.shipping === undefined), {
    message: 'Hãy chọn một địa chỉ đã lưu hoặc nhập địa chỉ giao hàng mới (chỉ một trong hai)',
    path: ['shipping'],
  });

export const orderCodeParamSchema = z.object({
  code: z.string().regex(ORDER_CODE_PATTERN, 'Mã đơn hàng không hợp lệ'),
});

// ---------------------------------------------------------------------------
// [F07] Danh sách đơn, hủy đơn, đổi trạng thái
// ---------------------------------------------------------------------------
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
};

const status = z.enum(ORDER_STATUSES, { error: 'Trạng thái đơn hàng không hợp lệ' });

// US-17 AC1: khách lọc đơn của mình theo trạng thái
export const listMyOrdersQuerySchema = z.object({ ...pagination, status: status.optional() });

// US-19 AC1: Admin lọc theo trạng thái, tìm theo mã đơn (hoặc tên, số điện thoại người nhận), phân trang
export const listAdminOrdersQuerySchema = z.object({
  ...pagination,
  status: status.optional(),
  search: z
    .string()
    .trim()
    .max(50, 'Từ khóa tối đa 50 ký tự')
    .optional()
    .transform((value) => value || undefined),
});

const reason = z
  .string({ error: 'Vui lòng nhập lý do hủy đơn' })
  .trim()
  .min(3, 'Lý do hủy đơn cần ít nhất 3 ký tự')
  .max(200, 'Lý do hủy đơn tối đa 200 ký tự');

// US-18 AC3: khách hủy đơn phải ghi lý do
export const cancelOrderSchema = z.object({ reason });

// US-19: Admin đổi trạng thái; hủy đơn bắt buộc có lý do, các bước khác có thể kèm ghi chú
export const updateOrderStatusSchema = z
  .object({
    status,
    note: z
      .string()
      .trim()
      .max(200, 'Ghi chú tối đa 200 ký tự')
      .optional()
      .transform((value) => value || undefined),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'CANCELLED' && (!data.note || data.note.length < 3)) {
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Vui lòng nhập lý do hủy đơn (ít nhất 3 ký tự)',
      });
    }
  });

// ---------------------------------------------------------------------------
// [F13] Đặt hàng không cần đăng nhập, tra cứu và hủy đơn bằng mã đơn + số điện thoại
// ---------------------------------------------------------------------------

// Khách vãng lai gửi giỏ lưu trên trình duyệt và địa chỉ nhập tay (không có sổ địa chỉ).
// requestId do trình duyệt sinh mỗi lần mở trang đặt hàng: gửi lại cùng mã (bấm đúp, thử lại khi mất mạng)
// thì máy chủ trả đơn đã tạo chứ không tạo đơn thứ hai.
export const createGuestOrderSchema = z.object({
  items: guestCartSchema.shape.items.min(1, 'Giỏ hàng của bạn đang trống'),
  shipping: shippingSchema,
  note,
  requestId: z.uuid('Mã yêu cầu không hợp lệ'),
});

// Khách gõ mã đơn chữ thường vẫn tìm được
const lookupFields = {
  code: z
    .string({ error: 'Vui lòng nhập mã đơn hàng' })
    .trim()
    .toUpperCase()
    .regex(ORDER_CODE_PATTERN, 'Mã đơn hàng không hợp lệ'),
  phone,
};

export const lookupOrderSchema = z.object(lookupFields);

export const cancelGuestOrderSchema = z.object({ ...lookupFields, reason });
