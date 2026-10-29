/**
 * @feature [F08] Đánh giá và yêu thích - Kiểm tra dữ liệu vào cho API đánh giá (US-21, US-23).
 */
import { z } from 'zod';

export const COMMENT_MAX_LENGTH = 500;
const REVIEW_STATUSES = ['visible', 'hidden'];

// US-21 AC2: 1-5 sao (phải là số nguyên thật, không nhận chuỗi "5") kèm bình luận không bắt buộc, tối đa 500 ký tự
export const reviewBodySchema = z.object({
  rating: z
    .number({ error: 'Vui lòng chọn số sao từ 1 đến 5' })
    .int('Số sao phải là số nguyên')
    .min(1, 'Số sao tối thiểu là 1')
    .max(5, 'Số sao tối đa là 5'),
  comment: z
    .string({ error: 'Bình luận không hợp lệ' })
    .trim()
    .max(COMMENT_MAX_LENGTH, `Bình luận tối đa ${COMMENT_MAX_LENGTH} ký tự`)
    .default(''),
});

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(5),
});

export const listAdminReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z
    .string()
    .trim()
    .max(100, 'Từ khóa tối đa 100 ký tự')
    .optional()
    .transform((value) => value || undefined),
  status: z.enum(REVIEW_STATUSES, { error: 'Trạng thái đánh giá không hợp lệ' }).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});

// Phải là boolean thật để không ẩn hoặc bỏ ẩn nhầm bằng chuỗi "false"
export const updateVisibilitySchema = z.object({
  isHidden: z.boolean({ error: 'Trạng thái ẩn phải là true hoặc false' }),
});
