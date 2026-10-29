/**
 * @feature [F08] Đánh giá - Tính điểm trung bình theo BR-19: chỉ tính đánh giá đang hiện (is_hidden = false),
 * làm tròn 1 chữ số thập phân; chưa có đánh giá nào thì điểm là null (không phải 0) để Client không hiện "0 sao".
 */
import { prisma } from './prisma.js';

export const EMPTY_RATING = { average: null, count: 0 };

const roundOneDecimal = (value) => Math.round(value * 10) / 10;

/** Điểm trung bình và số đánh giá của nhiều sản phẩm bằng một truy vấn. @returns {Promise<Map<number, {average, count}>>} */
export const getRatingSummaries = async (productIds) => {
  if (productIds.length === 0) return new Map();
  const groups = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds }, isHidden: false },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return new Map(
    groups.map((group) => [
      group.productId,
      { average: roundOneDecimal(group._avg.rating), count: group._count._all },
    ]),
  );
};

/** Số đánh giá theo từng mức 1-5 sao của một sản phẩm, luôn đủ 5 khóa (mức không có thì 0). */
export const getRatingBreakdown = async (productId) => {
  const groups = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId, isHidden: false },
    _count: { _all: true },
  });
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const group of groups) breakdown[group.rating] = group._count._all;
  return breakdown;
};
