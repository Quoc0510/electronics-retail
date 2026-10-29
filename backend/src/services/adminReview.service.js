/**
 * @feature [F08] Đánh giá sản phẩm - Nghiệp vụ phía quản trị (US-23): xem tất cả đánh giá và ẩn/bỏ ẩn đánh giá vi phạm.
 * Đánh giá bị ẩn không hiện ở Client và không tính vào điểm trung bình (BR-19) nhưng vẫn lưu để có thể bỏ ẩn.
 */
import { prisma } from '../lib/prisma.js';
import { escapeLike } from '../lib/like.js';
import { AppError } from '../utils/AppError.js';

const include = {
  product: { select: { id: true, name: true, slug: true } },
  user: { select: { id: true, email: true, fullName: true } },
};

const toAdminReview = (review) => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment,
  isHidden: review.isHidden,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
  product: review.product,
  user: review.user,
});

// Tìm theo tên sản phẩm, người đánh giá (email hoặc tên) hoặc nội dung bình luận.
// escapeLike để "%" và "_" người dùng gõ không thành ký tự đại diện của LIKE
const searchCondition = (search) => {
  const contains = { contains: escapeLike(search), mode: 'insensitive' };
  return {
    OR: [
      { product: { name: contains } },
      { user: { email: contains } },
      { user: { fullName: contains } },
      { comment: contains },
    ],
  };
};

export const listReviews = async ({ page, pageSize, search, status, rating }) => {
  const where = {
    ...(status && { isHidden: status === 'hidden' }),
    ...(rating && { rating }),
    ...(search && searchCondition(search)),
  };

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
  ]);

  return { items: rows.map(toAdminReview), page, pageSize, total };
};

/** Ẩn hoặc bỏ ẩn một đánh giá. Đặt lại đúng trạng thái đang có vẫn thành công (idempotent). */
export const setReviewHidden = async (reviewId, isHidden) => {
  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true },
  });
  if (!existing) throw new AppError(404, 'Không tìm thấy đánh giá', 'REVIEW_NOT_FOUND');

  return toAdminReview(
    await prisma.review.update({ where: { id: reviewId }, data: { isHidden }, include }),
  );
};
