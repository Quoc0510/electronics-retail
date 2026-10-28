/**
 * @feature [F05] Giỏ hàng - Nghiệp vụ giỏ hàng của khách (US-14, US-15, BR-02, BR-03, BR-11).
 *  - Mỗi người dùng đúng một giỏ (BR-11), tạo khi cần.
 *  - Thêm sản phẩm đã có thì cộng dồn số lượng; không bao giờ vượt tồn kho (BR-03) và báo rõ số còn lại.
 *  - Chỉ thêm được sản phẩm khách đang thấy được (sản phẩm, danh mục, thương hiệu đều đang hiện).
 *  - Mọi thao tác trả về toàn bộ giỏ đã tính lại để giao diện cập nhật ngay (tổng tiền, số lượng).
 *
 * Giỏ hàng KHÔNG giữ chỗ tồn kho: tồn kho có thể thay đổi sau khi thêm, nên mỗi dòng có trạng thái
 * (OK, UNAVAILABLE, OUT_OF_STOCK, EXCEEDS_STOCK) và việc kiểm tra bắt buộc cuối cùng nằm ở lúc đặt hàng (F06).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';

export const LINE_STATUS = {
  OK: 'OK',
  UNAVAILABLE: 'UNAVAILABLE', // sản phẩm, danh mục hoặc thương hiệu đã bị ẩn
  OUT_OF_STOCK: 'OUT_OF_STOCK', // tồn kho bằng 0
  EXCEEDS_STOCK: 'EXCEEDS_STOCK', // số lượng trong giỏ lớn hơn tồn kho hiện tại
};

const productInclude = {
  category: { select: { name: true, isActive: true } },
  brand: { select: { name: true, isActive: true } },
  images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 1, select: { url: true } },
};

const isVisible = (product) =>
  product.isActive && product.category.isActive && product.brand.isActive;

const lineStatus = (item) => {
  if (!isVisible(item.product)) return LINE_STATUS.UNAVAILABLE;
  if (item.product.stock <= 0) return LINE_STATUS.OUT_OF_STOCK;
  if (item.quantity > item.product.stock) return LINE_STATUS.EXCEEDS_STOCK;
  return LINE_STATUS.OK;
};

/** Giỏ của người dùng (tạo nếu chưa có) cùng thông tin sản phẩm, dạng sẵn sàng trả cho client. */
export const getCart = async (userId, db = prisma) => {
  const cart = await db.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
    include: {
      items: { orderBy: { id: 'asc' }, include: { product: { include: productInclude } } },
    },
  });

  const items = cart.items.map((item) => {
    const { product } = item;
    const unitPrice = product.salePrice ?? product.price; // BR-02
    return {
      id: item.id,
      productId: product.id,
      quantity: item.quantity,
      product: {
        name: product.name,
        slug: product.slug,
        price: product.price,
        salePrice: product.salePrice,
        thumbnail: product.images[0]?.url ?? null,
        brand: { name: product.brand.name },
        category: { name: product.category.name },
      },
      unitPrice,
      lineTotal: unitPrice * item.quantity,
      // Số còn lại trong kho để giao diện giới hạn ô nhập số lượng (US-15 AC1)
      stock: product.stock,
      status: lineStatus(item),
    };
  });

  const purchasable = items.filter((item) => item.status === LINE_STATUS.OK);
  return {
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0), // US-14 AC4
    // Chỉ cộng các dòng mua được; dòng bị ẩn/hết hàng không nằm trong tổng tiền
    subtotal: purchasable.reduce((sum, item) => sum + item.lineTotal, 0),
    // F06 chỉ cho đặt hàng khi giỏ không rỗng và mọi dòng đều mua được
    canCheckout: items.length > 0 && purchasable.length === items.length,
  };
};

// Thông báo vượt tồn kho nói rõ số còn lại và số đã có trong giỏ (US-14 AC3)
const insufficientStock = (stock, inCart) => {
  if (stock <= 0) return new AppError(409, 'Sản phẩm đã hết hàng', 'OUT_OF_STOCK');
  const message =
    inCart > 0
      ? `Chỉ còn ${stock} sản phẩm trong kho, bạn đã có ${inCart} sản phẩm này trong giỏ`
      : `Chỉ còn ${stock} sản phẩm trong kho`;
  return new AppError(409, message, 'INSUFFICIENT_STOCK');
};

const findVisibleProduct = async (productId) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: productInclude,
  });
  // Sản phẩm bị ẩn trả 404 như khi không tồn tại, không để lộ sự tồn tại của sản phẩm ẩn
  if (!product || !isVisible(product)) {
    throw new AppError(404, 'Không tìm thấy sản phẩm', 'PRODUCT_NOT_FOUND');
  }
  return product;
};

/**
 * Thêm sản phẩm vào giỏ, cộng dồn nếu đã có.
 * Cộng dồn dùng một câu UPDATE có điều kiện (số lượng mới <= tồn kho) nên nhiều request cùng lúc
 * không thể làm tổng vượt tồn kho; nếu hai request cùng tạo dòng mới, request thua (trùng khóa) thử lại như cộng dồn.
 */
export const addItem = async (userId, { productId, quantity }) => {
  const product = await findVisibleProduct(productId);
  const cart = await prisma.cart.upsert({ where: { userId }, update: {}, create: { userId } });

  let added = false;
  for (let attempt = 0; attempt < 3 && !added; attempt += 1) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    if (existing) {
      const { count } = await prisma.cartItem.updateMany({
        // Điều kiện tồn kho nằm trong chính câu lệnh để không bị "đọc rồi ghi" chen ngang
        where: { id: existing.id, quantity: { lte: product.stock - quantity } },
        data: { quantity: { increment: quantity } },
      });
      if (count === 1) {
        added = true;
      } else {
        // Không cập nhật được: hoặc vượt tồn kho, hoặc dòng vừa bị xóa -> đọc lại để báo đúng hoặc thử lại
        const fresh = await prisma.cartItem.findUnique({ where: { id: existing.id } });
        if (fresh) throw insufficientStock(product.stock, fresh.quantity);
      }
    } else {
      if (quantity > product.stock) throw insufficientStock(product.stock, 0);
      try {
        await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
        added = true;
      } catch (error) {
        // Trùng khóa (cartId, productId): request khác vừa tạo dòng này, vòng lặp sau sẽ cộng dồn
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
      }
    }
  }
  if (!added) {
    throw new AppError(409, 'Không thể cập nhật giỏ hàng, vui lòng thử lại', 'CONFLICT');
  }

  return getCart(userId);
};

// Dòng phải thuộc giỏ của chính người dùng; dòng của người khác trả 404 (không lộ sự tồn tại)
const findOwnItem = async (userId, itemId) => {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, cart: { userId } },
    include: { product: { include: productInclude } },
  });
  if (!item) throw new AppError(404, 'Không tìm thấy sản phẩm trong giỏ', 'CART_ITEM_NOT_FOUND');
  return item;
};

/** Đặt số lượng một dòng (1 đến tồn kho). Sản phẩm đã bị ẩn thì không sửa được, chỉ xóa. */
export const updateItem = async (userId, itemId, { quantity }) => {
  const item = await findOwnItem(userId, itemId);
  if (!isVisible(item.product)) {
    throw new AppError(
      409,
      'Sản phẩm này không còn được bán, hãy xóa khỏi giỏ',
      'PRODUCT_UNAVAILABLE',
    );
  }
  if (quantity > item.product.stock) throw insufficientStock(item.product.stock, 0);

  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  return getCart(userId);
};

export const removeItem = async (userId, itemId) => {
  const item = await findOwnItem(userId, itemId);
  await prisma.cartItem.delete({ where: { id: item.id } });
  return getCart(userId);
};

/** Dùng cho F06: xóa sạch giỏ sau khi đặt hàng thành công (chạy trong cùng transaction của đơn hàng). */
export const clearCart = (userId, db = prisma) =>
  db.cartItem.deleteMany({ where: { cart: { userId } } });
