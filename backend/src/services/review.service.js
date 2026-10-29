/**
 * @feature [F08] Đánh giá sản phẩm - Nghiệp vụ phía khách hàng (US-21).
 *  - BR-13: chỉ người có đơn COMPLETED chứa sản phẩm mới được đánh giá (đơn của khách vãng lai không gắn tài khoản nên không tính).
 *  - BR-19: mỗi người một đánh giá cho mỗi sản phẩm (sửa được, không tạo thêm); chỉ đánh giá đang hiện mới hiện ra và được tính điểm.
 * Sản phẩm không hiển thị với khách (ẩn, danh mục/thương hiệu bị ẩn) thì mọi API đánh giá đều trả 404 như trang chi tiết.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { visibleProductWhere } from '../lib/productVisibility.js';
import { EMPTY_RATING, getRatingBreakdown, getRatingSummaries } from '../lib/rating.js';
import { AppError } from '../utils/AppError.js';

const findVisibleProduct = async (slug) => {
  const product = await prisma.product.findFirst({
    where: { slug, ...visibleProductWhere },
    select: { id: true },
  });
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm', 'NOT_FOUND');
  return product;
};

// Tên người đánh giá hiển thị công khai ở dạng rút gọn "Quốc P." (tên gọi + chữ cái đầu họ) để không lộ họ tên đầy đủ
export const maskName = (fullName) => {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? 'Khách hàng';
  const initial = Array.from(words[0])[0].toUpperCase();
  return `${words[words.length - 1]} ${initial}.`;
};

const toMine = (review) => ({
  id: review.id,
  rating: review.rating,
  comment: review.comment,
  isHidden: review.isHidden,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

const hasPurchased = async (userId, productId) =>
  (await prisma.orderItem.count({
    where: { productId, order: { userId, status: 'COMPLETED' } },
  })) > 0;

/** Danh sách đánh giá đang hiện của một sản phẩm (mới nhất trước) kèm điểm tổng hợp. */
export const listReviews = async (slug, { page, pageSize }) => {
  const product = await findVisibleProduct(slug);
  const where = { productId: product.id, isHidden: false };

  const [rows, total, summaries, breakdown] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { fullName: true } } },
    }),
    prisma.review.count({ where }),
    getRatingSummaries([product.id]),
    getRatingBreakdown(product.id),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      comment: row.comment,
      authorName: maskName(row.user.fullName),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
    page,
    pageSize,
    total,
    summary: { ...(summaries.get(product.id) ?? EMPTY_RATING), breakdown },
  };
};

/** Người đang đăng nhập có được đánh giá sản phẩm này không, và đánh giá hiện có của họ (kể cả khi đang bị ẩn). */
export const getMyReview = async (userId, slug) => {
  const product = await findVisibleProduct(slug);
  const [canReview, review] = await Promise.all([
    hasPurchased(userId, product.id),
    prisma.review.findUnique({ where: { productId_userId: { productId: product.id, userId } } }),
  ]);
  return { canReview, review: review ? toMine(review) : null };
};

export const createReview = async (userId, slug, { rating, comment }) => {
  const product = await findVisibleProduct(slug);

  // US-21 AC1
  if (!(await hasPurchased(userId, product.id))) {
    throw new AppError(
      403,
      'Chỉ khách đã nhận hàng mới đánh giá được sản phẩm này',
      'REVIEW_NOT_ALLOWED',
    );
  }

  try {
    return toMine(
      await prisma.review.create({ data: { productId: product.id, userId, rating, comment } }),
    );
  } catch (error) {
    // US-21 AC3: ràng buộc UNIQUE (product_id, user_id) chặn cả hai request gửi đồng thời, không chỉ request tuần tự
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError(
        409,
        'Bạn đã đánh giá sản phẩm này rồi, hãy sửa đánh giá hiện có',
        'REVIEW_EXISTS',
      );
    }
    throw error;
  }
};

/** Sửa đánh giá của chính mình. Đánh giá đang bị ẩn vẫn bị ẩn sau khi sửa: chỉ quản trị viên mới bỏ ẩn được. */
export const updateMyReview = async (userId, slug, { rating, comment }) => {
  const product = await findVisibleProduct(slug);
  try {
    return toMine(
      await prisma.review.update({
        where: { productId_userId: { productId: product.id, userId } },
        data: { rating, comment },
      }),
    );
  } catch (error) {
    // P2025: không có bản ghi để sửa
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new AppError(404, 'Bạn chưa đánh giá sản phẩm này', 'REVIEW_NOT_FOUND');
    }
    throw error;
  }
};
