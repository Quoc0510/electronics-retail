/**
 * @feature [F03] Sản phẩm - Quy tắc kiểm tra dữ liệu gửi lên (Zod), theo US-08, US-09 và BR-01 → BR-03.
 */
import { z } from 'zod';

const MAX_PRICE = 1_000_000_000; // 1 tỷ đồng, chặn nhập nhầm thêm số 0

// BR-01: tiền là số nguyên VND. Số thực như 19990000.5 bị từ chối
const money = (label) =>
  z
    .number({ error: `${label} phải là số` })
    .int(`${label} phải là số nguyên (đồng)`)
    .positive(`${label} phải lớn hơn 0`)
    .max(MAX_PRICE, `${label} tối đa ${MAX_PRICE.toLocaleString('vi-VN')} đồng`);

// US-08 AC2: SKU duy nhất. Chuẩn hóa về chữ HOA để "ip15" và "IP15" là cùng một mã
const sku = z
  .string()
  .trim()
  .min(1, 'Vui lòng nhập SKU')
  .max(50, 'SKU tối đa 50 ký tự')
  .regex(/^[A-Za-z0-9._-]+$/, 'SKU chỉ gồm chữ, số và các ký tự . _ -')
  .transform((value) => value.toUpperCase());

// US-08 AC5: thông số kỹ thuật là các cặp tên - giá trị, ví dụ { "Màn hình": "6.1 inch OLED" }
const specs = z
  .record(
    z
      .string()
      .trim()
      .min(1, 'Tên thông số không được trống')
      .max(100, 'Tên thông số tối đa 100 ký tự'),
    z.string().trim().max(300, 'Giá trị thông số tối đa 300 ký tự'),
  )
  .refine((value) => Object.keys(value).length <= 30, { message: 'Tối đa 30 thông số' });

const productFields = z.object({
  sku,
  name: z.string().trim().min(1, 'Vui lòng nhập tên sản phẩm').max(200, 'Tên tối đa 200 ký tự'),
  description: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự'),
  categoryId: z.number().int().positive('Vui lòng chọn danh mục'),
  brandId: z.number().int().positive('Vui lòng chọn thương hiệu'),
  price: money('Giá gốc'),
  // null = không khuyến mãi
  salePrice: money('Giá khuyến mãi').nullable(),
  // US-08 AC4: số nguyên >= 0
  stock: z
    .number({ error: 'Tồn kho phải là số' })
    .int('Tồn kho phải là số nguyên')
    .min(0, 'Tồn kho không được âm')
    .max(1_000_000, 'Tồn kho tối đa 1.000.000'),
  specs,
  isActive: z.boolean(),
});

// US-08 AC3 / BR-02: giá khuyến mãi phải thấp hơn giá gốc (chỉ kiểm tra khi cả hai cùng được gửi)
const salePriceBelowPrice = (data, ctx) => {
  if (data.price != null && data.salePrice != null && data.salePrice >= data.price) {
    ctx.addIssue({
      code: 'custom',
      path: ['salePrice'],
      message: 'Giá khuyến mãi phải thấp hơn giá gốc',
    });
  }
};

// Khi tạo: các trường có mặc định hợp lý được phép bỏ trống
export const createProductSchema = productFields
  .partial({ description: true, salePrice: true, stock: true, specs: true, isActive: true })
  .superRefine(salePriceBelowPrice);

// Khi sửa: mọi trường đều tùy chọn nhưng phải có ít nhất một trường
export const updateProductSchema = productFields
  .partial()
  .superRefine(salePriceBelowPrice)
  .refine((data) => Object.keys(data).length > 0, { message: 'Không có dữ liệu để cập nhật' });

// US-09 AC3: danh sách có tìm theo tên/SKU, lọc theo danh mục, phân trang
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const productImageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  imageId: z.coerce.number().int().positive(),
});

// Danh sách id ảnh theo thứ tự mới; ảnh đầu tiên là ảnh đại diện
export const reorderImagesSchema = z.object({
  imageIds: z.array(z.number().int().positive()).min(1, 'Danh sách ảnh trống'),
});
