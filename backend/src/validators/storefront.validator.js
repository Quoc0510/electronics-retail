/**
 * @feature [F04] Duyệt và tìm sản phẩm - Quy tắc kiểm tra tham số của API công khai (US-11, US-12, US-13).
 * Mọi bộ lọc nằm trên URL của Client nên đều là tham số query dạng chuỗi và được ép kiểu ở đây.
 */
import { z } from 'zod';

const slug = z.string().trim().min(1).max(250);

// Giá là số nguyên đồng (BR-01). Chuỗi rỗng ("?minPrice=") phải coi là KHÔNG lọc: nếu không, z.coerce đổi "" thành 0
// và "maxPrice=" sẽ lọc ra 0 sản phẩm
const price = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().min(0).max(1_000_000_000).optional(),
);

export const SORT_OPTIONS = ['newest', 'price_asc', 'price_desc'];

export const storefrontListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    // US-11 AC3: mặc định 12 sản phẩm mỗi trang
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
    // US-12: tìm theo tên; từ khóa rỗng thì trả toàn bộ danh sách (AC3)
    search: z.string().trim().max(100).optional(),
    category: slug.optional(),
    brand: slug.optional(),
    minPrice: price,
    maxPrice: price,
    // Chỉ nhận onSale=true: chỉ lấy sản phẩm đang khuyến mãi (dùng cho khối "Đang khuyến mãi" ở trang chủ)
    onSale: z
      .literal('true')
      .transform(() => true)
      .optional(),
    sort: z.enum(SORT_OPTIONS).default('newest'),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'Giá tối thiểu không được lớn hơn giá tối đa',
    path: ['minPrice'],
  });

// US-13: chi tiết sản phẩm tìm theo slug để đường dẫn dễ đọc và chia sẻ được
export const productSlugParamSchema = z.object({ slug });
