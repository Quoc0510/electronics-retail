/**
 * @feature [F06] Đặt hàng - Nghiệp vụ đặt hàng thanh toán khi nhận hàng (US-16, BR-02 đến BR-05, BR-08, BR-12).
 *
 * createOrder làm MỌI việc trong MỘT transaction (US-16 AC5): khóa giỏ, kiểm tra và trừ tồn kho, tạo đơn kèm các dòng
 * và lịch sử, xóa giỏ. Một bước lỗi thì tất cả được hoàn lại, nên không bao giờ có đơn mà kho chưa trừ, hay kho đã trừ mà
 * không có đơn.
 *
 * Chống đặt trùng khi bấm đúp (AC6): giao dịch đầu tiên khóa dòng giỏ của người dùng (SELECT ... FOR UPDATE) và xóa giỏ khi
 * xong; giao dịch thứ hai phải chờ rồi thấy giỏ trống nên bị từ chối (EMPTY_CART), không tạo đơn thứ hai.
 *
 * Trừ kho bằng UPDATE ... WHERE stock >= n ngay trong câu lệnh (không "đọc rồi ghi") nên nhiều đơn cùng lúc không bao giờ
 * làm tồn kho âm (BR-03); các dòng được xử lý theo thứ tự id sản phẩm để hai đơn cùng lúc không khóa chéo nhau (deadlock).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateOrderCode } from '../lib/orderCode.js';
import { calculateShippingFee } from '../lib/shipping.js';
import { AppError } from '../utils/AppError.js';
import { isVisible } from './cart.service.js';

const MAX_CODE_ATTEMPTS = 5;

const orderInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: {
        select: {
          slug: true,
          images: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  },
  history: { orderBy: { id: 'asc' } },
};

// Dạng trả cho client: có thành tiền từng dòng, liên kết và ảnh sản phẩm (nếu sản phẩm còn)
const toOrderDto = (order) => ({
  id: order.id,
  code: order.code,
  status: order.status,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  subtotal: order.subtotal,
  shippingFee: order.shippingFee,
  total: order.total,
  recipientName: order.recipientName,
  phone: order.phone,
  shippingAddress: order.shippingAddress,
  note: order.note,
  createdAt: order.createdAt,
  items: order.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    productSku: item.productSku,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.unitPrice * item.quantity,
    slug: item.product.slug,
    thumbnail: item.product.images[0]?.url ?? null,
  })),
  history: order.history.map((entry) => ({
    status: entry.status,
    note: entry.note,
    createdAt: entry.createdAt,
  })),
});

const formatAddress = (address) =>
  [address.street, address.ward, address.district, address.province].join(', ');

// Câu báo lỗi nói rõ sản phẩm nào có vấn đề (US-16 AC4)
const describeProblem = (problem) => {
  if (problem.reason === 'UNAVAILABLE') return `${problem.name} không còn được bán`;
  if (problem.reason === 'OUT_OF_STOCK') return `${problem.name} đã hết hàng`;
  return `${problem.name} chỉ còn ${problem.available} (bạn đặt ${problem.requested})`;
};

/**
 * Tạo đơn từ giỏ hàng của người dùng.
 * @param {number} userId
 * @param {{ addressId?: number, shipping?: object, note?: string }} input
 * @returns {Promise<object>} đơn vừa tạo
 */
export const createOrder = async (userId, { addressId, shipping, note }) => {
  let address = shipping;
  if (addressId !== undefined) {
    // Chỉ dùng được địa chỉ của chính mình; địa chỉ người khác trả 404 như không tồn tại
    address = await prisma.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new AppError(404, 'Không tìm thấy địa chỉ giao hàng', 'ADDRESS_NOT_FOUND');
  }

  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => placeOrder(tx, userId, address, note));
    } catch (error) {
      // Mã đơn ngẫu nhiên trùng mã có sẵn (rất hiếm): tạo mã khác rồi làm lại cả transaction
      const duplicateCode =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target ?? '').includes('code');
      if (!duplicateCode || attempt === MAX_CODE_ATTEMPTS) throw error;
    }
  }
  /* istanbul ignore next: vòng lặp luôn return hoặc throw */
  throw new AppError(500, 'Không tạo được mã đơn hàng', 'INTERNAL_ERROR');
};

const placeOrder = async (tx, userId, address, note) => {
  // Khóa dòng giỏ: các lần đặt đồng thời của cùng người dùng phải xếp hàng (chống đặt trùng, AC6)
  const locked = await tx.$queryRaw`SELECT id FROM carts WHERE user_id = ${userId} FOR UPDATE`;
  if (locked.length === 0) throw new AppError(400, 'Giỏ hàng của bạn đang trống', 'EMPTY_CART');

  const cartItems = await tx.cartItem.findMany({
    where: { cart: { userId } },
    orderBy: { productId: 'asc' },
    include: {
      product: {
        include: {
          category: { select: { isActive: true } },
          brand: { select: { isActive: true } },
        },
      },
    },
  });
  if (cartItems.length === 0) {
    throw new AppError(400, 'Giỏ hàng của bạn đang trống', 'EMPTY_CART');
  }

  // Gom MỌI sản phẩm có vấn đề rồi mới báo một lần để khách biết hết cần sửa gì (AC4)
  const problems = [];
  const lines = [];
  for (const item of cartItems) {
    const { product } = item;
    if (!isVisible(product)) {
      problems.push({
        productId: product.id,
        name: product.name,
        requested: item.quantity,
        available: 0,
        reason: 'UNAVAILABLE',
      });
      continue;
    }

    const { count } = await tx.product.updateMany({
      where: { id: product.id, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    });
    if (count !== 1) {
      const { stock } = await tx.product.findUnique({
        where: { id: product.id },
        select: { stock: true },
      });
      problems.push({
        productId: product.id,
        name: product.name,
        requested: item.quantity,
        available: stock,
        reason: stock <= 0 ? 'OUT_OF_STOCK' : 'INSUFFICIENT_STOCK',
      });
      continue;
    }

    lines.push({
      productId: product.id,
      productName: product.name, // BR-04: bản sao tại thời điểm đặt
      productSku: product.sku,
      unitPrice: product.salePrice ?? product.price, // BR-02
      quantity: item.quantity,
    });
  }

  // Ném lỗi trong transaction là hoàn lại cả các lần trừ kho ở trên: không đơn nào được tạo (AC4, AC5)
  if (problems.length > 0) {
    throw new AppError(
      409,
      `Không thể đặt hàng: ${problems.map(describeProblem).join('; ')}`,
      'CART_NOT_PURCHASABLE',
      { items: problems },
    );
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shippingFee = calculateShippingFee(subtotal); // BR-05

  const order = await tx.order.create({
    data: {
      code: generateOrderCode(),
      userId,
      status: 'PENDING',
      paymentMethod: 'COD',
      paymentStatus: 'UNPAID', // BR-08
      subtotal,
      shippingFee,
      total: subtotal + shippingFee,
      recipientName: address.recipientName,
      phone: address.phone,
      shippingAddress: formatAddress(address), // BR-04
      note,
      items: { create: lines },
      history: { create: { status: 'PENDING', note: 'Đơn hàng được tạo', changedById: userId } },
    },
    include: orderInclude,
  });

  await tx.cartItem.deleteMany({ where: { cart: { userId } } });
  return toOrderDto(order);
};

/** Xem một đơn của chính mình theo mã đơn; đơn của người khác trả 404 (không lộ sự tồn tại). */
export const getOrderByCode = async (userId, code) => {
  const order = await prisma.order.findFirst({
    where: { code, userId },
    include: orderInclude,
  });
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
  return toOrderDto(order);
};
