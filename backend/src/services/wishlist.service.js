/**
 * @feature [F08] Yêu thích - Nghiệp vụ danh sách sản phẩm yêu thích của thành viên (US-22, BR-20).
 * Thêm và bỏ đều idempotent (bấm đúp, hai thiết bị cùng lúc vẫn ra cùng kết quả). Tối đa 100 sản phẩm để danh sách không phình vô hạn.
 * Danh sách chỉ hiện sản phẩm khách còn thấy được; sản phẩm bị ẩn vẫn nằm trong DB nên hiện lại khi bán lại.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { visibleProductWhere } from '../lib/productVisibility.js';
import { AppError } from '../utils/AppError.js';
import { summaryInclude, toSummaries } from './storefront.service.js';

export const WISHLIST_LIMIT = 100;

/** Sản phẩm yêu thích còn hiển thị, mới thêm trước. */
export const listWishlist = async (userId) => {
  const rows = await prisma.wishlistItem.findMany({
    where: { userId, product: visibleProductWhere },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { product: { include: summaryInclude } },
  });
  const items = await toSummaries(rows.map((row) => row.product));
  return { items, total: items.length };
};

export const addToWishlist = async (userId, productId) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, ...visibleProductWhere },
    select: { id: true },
  });
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm', 'NOT_FOUND');

  const key = { userId_productId: { userId, productId } };
  if (await prisma.wishlistItem.findUnique({ where: key })) return { productId, inWishlist: true };

  if ((await prisma.wishlistItem.count({ where: { userId } })) >= WISHLIST_LIMIT) {
    throw new AppError(
      400,
      `Danh sách yêu thích đã đủ ${WISHLIST_LIMIT} sản phẩm, hãy bỏ bớt trước khi thêm`,
      'WISHLIST_FULL',
    );
  }

  try {
    await prisma.wishlistItem.create({ data: { userId, productId } });
  } catch (error) {
    // Hai request thêm cùng một sản phẩm đồng thời: request thua đã có sẵn bản ghi nên coi là thành công
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
  }
  return { productId, inWishlist: true };
};

/** Bỏ yêu thích; sản phẩm không có trong danh sách (hoặc đã bị ẩn khỏi cửa hàng) vẫn coi là thành công. */
export const removeFromWishlist = async (userId, productId) => {
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
};
