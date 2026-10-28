/**
 * @feature [F05] Giỏ hàng - Quy tắc kiểm tra dữ liệu gửi lên API giỏ hàng.
 * Tồn kho (BR-03) được kiểm tra ở service vì cần đối chiếu với dữ liệu hiện tại trong CSDL;
 * ở đây chỉ chặn dữ liệu sai dạng (không phải số nguyên, âm, quá lớn).
 */
import { z } from 'zod';

// Giới hạn trên cho một dòng, chặn các số vô lý như 1e9 trước khi chạm tới CSDL
export const MAX_LINE_QUANTITY = 99;

const quantity = z
  .number({ error: 'Số lượng phải là số' })
  .int('Số lượng phải là số nguyên')
  .min(1, 'Số lượng tối thiểu là 1')
  .max(MAX_LINE_QUANTITY, `Số lượng tối đa mỗi sản phẩm là ${MAX_LINE_QUANTITY}`);

export const addItemSchema = z.object({
  productId: z
    .number({ error: 'Mã sản phẩm phải là số' })
    .int('Mã sản phẩm phải là số nguyên')
    .positive('Mã sản phẩm không hợp lệ'),
  // Không gửi số lượng thì mặc định thêm 1
  quantity: quantity.default(1),
});

export const updateItemSchema = z.object({ quantity });
