/**
 * @feature [F16] Cài đặt cửa hàng - Kiểm tra dữ liệu vào cho API cài đặt của Admin.
 */
import { z } from 'zod';

const MAX_AMOUNT = 2_000_000_000; // giữ trong giới hạn số nguyên của PostgreSQL và của phép tính tiền

// freeThreshold: số đồng (0 = không miễn phí cho đơn nào) hoặc null để quay về giá trị mặc định của hệ thống
export const updateShippingSettingsSchema = z.object({
  freeThreshold: z
    .number({ error: 'Ngưỡng miễn phí vận chuyển phải là số' })
    .int('Ngưỡng miễn phí vận chuyển phải là số nguyên (đồng)')
    .min(0, 'Ngưỡng miễn phí vận chuyển không được âm')
    .max(MAX_AMOUNT, 'Ngưỡng miễn phí vận chuyển quá lớn')
    .nullable(),
});
