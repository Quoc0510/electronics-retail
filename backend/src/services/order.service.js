/**
 * @feature [F06][F07][F13] Đơn hàng - Đặt hàng thanh toán khi nhận hàng (US-16, BR-02 đến BR-05, BR-08, BR-12) và
 * quản lý đơn: khách xem, hủy; Admin xem, đổi trạng thái (US-17 đến US-19, BR-06, BR-07).
 * [F13] Khách không đăng nhập vẫn đặt được (đơn userId = null, tra cứu bằng mã đơn + số điện thoại, BR-11); đơn của thành viên
 * hoàn thành thì được cộng điểm thành viên (BR-15).
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
import { ORDER_STATUSES, allowedNext, canTransition } from '../lib/orderStatus.js'; // [F07]
import { calculatePoints } from '../lib/points.js'; // [F13]
import { calculateShippingFee } from '../lib/shipping.js';
import { AppError } from '../utils/AppError.js';
import { isVisible, mergeDuplicates } from './cart.service.js';

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

// Điểm thành viên sẽ nhận khi đơn hoàn thành (BR-15); đơn đã hoàn thành/hủy hoặc của khách vãng lai thì không còn "sẽ nhận"
const expectedPoints = (order) =>
  order.userId !== null && ['PENDING', 'CONFIRMED', 'SHIPPING'].includes(order.status)
    ? calculatePoints(order.subtotal)
    : 0;

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
  cancelReason: order.cancelReason,
  createdAt: order.createdAt,
  // [F13] Đơn khách vãng lai không có điểm; đơn thành viên đang xử lý cho biết số điểm sẽ nhận, khi hoàn thành thì là điểm đã cộng
  isGuest: order.userId === null,
  pointsEarned: order.pointsEarned,
  pointsExpected: expectedPoints(order),
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
  [address.street, address.ward, address.district, address.province].filter(Boolean).join(', ');

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

  return withOrderCodeRetry(() =>
    prisma.$transaction((tx) => placeOrder(tx, userId, address, note)),
  );
};

// Mã đơn ngẫu nhiên trùng mã có sẵn (rất hiếm): tạo mã khác rồi làm lại cả transaction
const withOrderCodeRetry = async (attemptOrder, onDuplicateKey) => {
  for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await attemptOrder();
    } catch (error) {
      const unique =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      const target = String(error.meta?.target ?? '');
      // [F13] Cùng requestId vừa được request khác xử lý xong: trả đơn đó thay vì báo lỗi
      if (unique && target.includes('idempotency') && onDuplicateKey) {
        const existing = await onDuplicateKey();
        if (existing) return existing;
      }
      if (!unique || !target.includes('code') || attempt === MAX_CODE_ATTEMPTS) throw error;
    }
  }
  /* istanbul ignore next: vòng lặp luôn return hoặc throw */
  throw new AppError(500, 'Không tạo được mã đơn hàng', 'INTERNAL_ERROR');
};

const productVisibility = {
  category: { select: { isActive: true } },
  brand: { select: { isActive: true } },
};

/**
 * Giữ chỗ tồn kho cho các dòng { product, quantity } (đã sắp theo id sản phẩm) và dựng các dòng đơn hàng.
 * Gom MỌI sản phẩm có vấn đề rồi mới báo một lần để khách biết hết cần sửa gì (AC4); ném lỗi trong transaction
 * là hoàn lại cả các lần trừ kho trước đó nên không đơn nào được tạo (AC4, AC5).
 */
const reserveLines = async (tx, entries) => {
  const problems = [];
  const lines = [];
  for (const { product, quantity } of entries) {
    if (!isVisible(product)) {
      problems.push({
        productId: product.id,
        name: product.name,
        requested: quantity,
        available: 0,
        reason: 'UNAVAILABLE',
      });
      continue;
    }

    const { count } = await tx.product.updateMany({
      where: { id: product.id, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (count !== 1) {
      const { stock } = await tx.product.findUnique({
        where: { id: product.id },
        select: { stock: true },
      });
      problems.push({
        productId: product.id,
        name: product.name,
        requested: quantity,
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
      quantity,
    });
  }

  if (problems.length > 0) {
    throw new AppError(
      409,
      `Không thể đặt hàng: ${problems.map(describeProblem).join('; ')}`,
      'CART_NOT_PURCHASABLE',
      { items: problems },
    );
  }
  return lines;
};

// Tạo đơn kèm các dòng và dòng lịch sử đầu tiên; userId null = đơn của khách vãng lai (BR-11)
const insertOrder = async (tx, { userId, lines, address, note, idempotencyKey }) => {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shippingFee = calculateShippingFee(subtotal); // BR-05

  const order = await tx.order.create({
    data: {
      code: generateOrderCode(),
      userId,
      idempotencyKey,
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
      history: {
        create: {
          status: 'PENDING',
          note: userId === null ? 'Đơn hàng được tạo (khách không đăng nhập)' : 'Đơn hàng được tạo',
          changedById: userId,
        },
      },
    },
    include: orderInclude,
  });
  return toOrderDto(order);
};

const placeOrder = async (tx, userId, address, note) => {
  // Khóa dòng giỏ: các lần đặt đồng thời của cùng người dùng phải xếp hàng (chống đặt trùng, AC6)
  const locked = await tx.$queryRaw`SELECT id FROM carts WHERE user_id = ${userId} FOR UPDATE`;
  if (locked.length === 0) throw new AppError(400, 'Giỏ hàng của bạn đang trống', 'EMPTY_CART');

  const cartItems = await tx.cartItem.findMany({
    where: { cart: { userId } },
    orderBy: { productId: 'asc' },
    include: { product: { include: productVisibility } },
  });
  if (cartItems.length === 0) {
    throw new AppError(400, 'Giỏ hàng của bạn đang trống', 'EMPTY_CART');
  }

  const lines = await reserveLines(tx, cartItems);
  const order = await insertOrder(tx, { userId, lines, address, note });
  await tx.cartItem.deleteMany({ where: { cart: { userId } } });
  return order;
};

// ---------------------------------------------------------------------------
// [F13] Đặt hàng không cần đăng nhập (BR-11) và xem, hủy đơn bằng mã đơn + số điện thoại
// ---------------------------------------------------------------------------

const findOrderByKey = async (idempotencyKey) => {
  const order = await prisma.order.findUnique({
    where: { idempotencyKey },
    include: orderInclude,
  });
  return order ? toOrderDto(order) : null;
};

/**
 * Khách CHƯA đăng nhập đặt hàng từ giỏ lưu trên trình duyệt. Không có giỏ trong CSDL để khóa nên chống đặt trùng bằng
 * requestId (UNIQUE): gửi lại cùng mã thì trả đơn đã tạo, và hai request cùng mã chạy song song thì request thua bị
 * ràng buộc UNIQUE chặn (transaction hoàn lại kho) rồi trả đơn của request thắng. Đơn này không có chủ tài khoản nên không
 * được cộng điểm thành viên (BR-15).
 * @param {{ items: Array<{productId:number, quantity:number}>, shipping: object, note?: string, requestId: string }} input
 */
export const createGuestOrder = async ({ items, shipping, note, requestId }) => {
  const replay = await findOrderByKey(requestId);
  if (replay) return replay;

  return withOrderCodeRetry(
    () =>
      prisma.$transaction(async (tx) => {
        // Xử lý theo thứ tự id sản phẩm để hai đơn cùng lúc không khóa chéo nhau (deadlock)
        const requested = mergeDuplicates(items).sort((a, b) => a.productId - b.productId);
        const products = await tx.product.findMany({
          where: { id: { in: requested.map((entry) => entry.productId) } },
          include: productVisibility,
        });
        const byId = new Map(products.map((product) => [product.id, product]));

        // Sản phẩm không tồn tại cũng báo như đã ngừng bán để khách xóa khỏi giỏ
        const missing = requested.filter((entry) => !byId.has(entry.productId));
        if (missing.length > 0) {
          throw new AppError(
            409,
            'Không thể đặt hàng: có sản phẩm không còn được bán',
            'CART_NOT_PURCHASABLE',
            {
              items: missing.map((entry) => ({
                productId: entry.productId,
                name: `Sản phẩm #${entry.productId}`,
                requested: entry.quantity,
                available: 0,
                reason: 'UNAVAILABLE',
              })),
            },
          );
        }

        const entries = requested.map((entry) => ({
          product: byId.get(entry.productId),
          quantity: entry.quantity,
        }));
        const lines = await reserveLines(tx, entries);
        return insertOrder(tx, {
          userId: null,
          lines,
          address: shipping,
          note,
          idempotencyKey: requestId,
        });
      }),
    () => findOrderByKey(requestId),
  );
};

// Đơn của khách vãng lai: phải khớp cả mã đơn lẫn số điện thoại nhận hàng. Sai một trong hai đều trả 404 (không lộ
// đơn có tồn tại hay không). Đơn của thành viên không tra được bằng cách này, vì chúng được bảo vệ bằng đăng nhập.
const findGuestOrder = (code, phone) =>
  prisma.order.findFirst({ where: { code, phone, userId: null }, include: orderInclude });

export const getGuestOrder = async (code, phone) => {
  const order = await findGuestOrder(code, phone);
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
  return toOrderDto(order);
};

/** Khách vãng lai tự hủy đơn khi còn PENDING (BR-06): cùng luật, cùng hoàn kho như thành viên. */
export const cancelGuestOrder = async (code, phone, reason) => {
  const order = await findGuestOrder(code, phone);
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');

  await prisma.$transaction((tx) =>
    changeStatus(tx, order.id, 'CANCELLED', {
      allowed: ['CANCELLED'],
      onlyFrom: ['PENDING'],
      deniedMessage: CUSTOMER_CANCEL_DENIED,
      note: `Khách hàng hủy đơn: ${reason}`,
      actorId: null,
      cancelReason: reason,
    }),
  );
  return getGuestOrder(code, phone);
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

// ---------------------------------------------------------------------------
// [F07] Xem danh sách đơn, hủy đơn, quản lý đơn của Admin
// ---------------------------------------------------------------------------

// Dòng rút gọn cho danh sách: số lượng và vài sản phẩm đầu để khách nhận ra đơn
const listInclude = {
  items: {
    orderBy: { id: 'asc' },
    include: {
      product: {
        select: {
          images: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  },
  user: { select: { id: true, fullName: true, email: true } },
};

const PREVIEW_ITEMS = 3;

const toListItem = (order) => ({
  id: order.id,
  code: order.code,
  status: order.status,
  paymentStatus: order.paymentStatus,
  total: order.total,
  createdAt: order.createdAt,
  recipientName: order.recipientName,
  isGuest: order.userId === null, // [F13]
  pointsEarned: order.pointsEarned, // [F13]
  itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  items: order.items.slice(0, PREVIEW_ITEMS).map((item) => ({
    productName: item.productName,
    quantity: item.quantity,
    thumbnail: item.product.images[0]?.url ?? null,
  })),
  moreItems: Math.max(0, order.items.length - PREVIEW_ITEMS),
  customer: order.user
    ? { id: order.user.id, fullName: order.user.fullName, email: order.user.email }
    : undefined,
});

/** Danh sách đơn của chính khách, mới nhất trước (US-17 AC1), lọc theo trạng thái. */
export const listMyOrders = async (userId, { page, pageSize, status }) => {
  const where = { userId, ...(status ? { status } : {}) };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: listInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  // Khách không cần thấy thông tin khách hàng của chính mình trong từng dòng
  return {
    items: orders.map((order) => ({ ...toListItem(order), customer: undefined })),
    page,
    pageSize,
    total,
  };
};

/**
 * Chuyển đơn sang trạng thái mới TRONG transaction của người gọi:
 *  - khóa dòng đơn rồi đọc lại trạng thái hiện tại, nên hai người cùng đổi một đơn (ví dụ khách hủy lúc Admin xác nhận)
 *    phải xếp hàng và người đến sau bị từ chối nếu luồng không còn hợp lệ (BR-06);
 *  - hủy đơn thì cộng trả tồn kho từng sản phẩm đúng một lần (BR-07);
 *  - hoàn thành đơn COD thì đánh dấu đã thanh toán (BR-08);
 *  - ghi một dòng lịch sử cho mỗi lần đổi (US-19 AC3).
 * @param {object} opts { allowed: trạng thái đích người gọi được phép đặt, onlyFrom: trạng thái hiện tại được phép (tùy chọn),
 *   deniedMessage: thông báo khi không được phép, note, actorId, cancelReason }
 */
const changeStatus = async (
  tx,
  orderId,
  toStatus,
  { allowed, onlyFrom, deniedMessage, note, actorId, cancelReason },
) => {
  const [locked] = await tx.$queryRaw`
    SELECT status, user_id AS "userId", subtotal FROM orders WHERE id = ${orderId} FOR UPDATE`;
  const from = locked.status;

  if (onlyFrom && !onlyFrom.includes(from)) {
    throw new AppError(400, deniedMessage, 'INVALID_TRANSITION');
  }
  if (!allowed.includes(toStatus) || !canTransition(from, toStatus)) {
    throw new AppError(
      400,
      `Không thể chuyển đơn hàng từ "${from}" sang "${toStatus}"`,
      'INVALID_TRANSITION',
    );
  }

  if (toStatus === 'CANCELLED') {
    // BR-07: cộng trả kho theo thứ tự id sản phẩm để các lần hủy đồng thời không khóa chéo nhau
    const items = await tx.orderItem.findMany({
      where: { orderId },
      orderBy: { productId: 'asc' },
    });
    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }

  // BR-15: hoàn thành đơn của thành viên thì cộng điểm đúng một lần (dòng đơn đang bị khóa và luồng trạng thái chỉ cho
  // đi tới COMPLETED một lần). Đơn khách vãng lai (user_id null) không có chủ để cộng điểm.
  let pointsEarned = 0;
  if (toStatus === 'COMPLETED' && locked.userId !== null) {
    pointsEarned = calculatePoints(locked.subtotal);
    if (pointsEarned > 0) {
      await tx.user.update({
        where: { id: locked.userId },
        data: { points: { increment: pointsEarned } },
      });
    }
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: toStatus,
      ...(toStatus === 'COMPLETED' ? { paymentStatus: 'PAID', pointsEarned } : {}),
      ...(toStatus === 'CANCELLED' ? { cancelReason } : {}),
    },
  });
  await tx.orderStatusHistory.create({
    data: { orderId, status: toStatus, note, changedById: actorId },
  });
};

// Khách chỉ tự hủy được khi chưa được xác nhận (BR-06); hủy đơn đã xác nhận là việc của cửa hàng
const CUSTOMER_CANCEL_DENIED =
  'Đơn hàng đã được xử lý nên không thể tự hủy. Vui lòng liên hệ cửa hàng để được hỗ trợ';

/** Khách tự hủy đơn: chỉ khi đơn còn PENDING (BR-06, US-18 AC1), hoàn kho, lưu lý do (AC2, AC3). */
export const cancelMyOrder = async (userId, code, reason) => {
  const order = await prisma.order.findFirst({ where: { code, userId } });
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');

  await prisma.$transaction((tx) =>
    changeStatus(tx, order.id, 'CANCELLED', {
      allowed: ['CANCELLED'],
      onlyFrom: ['PENDING'],
      deniedMessage: CUSTOMER_CANCEL_DENIED,
      note: `Khách hàng hủy đơn: ${reason}`,
      actorId: userId,
      cancelReason: reason,
    }),
  );
  return getOrderByCode(userId, code);
};

// ----- Admin -----

const adminInclude = {
  ...orderInclude,
  user: { select: { id: true, fullName: true, email: true, phone: true, points: true } },
  history: {
    orderBy: { id: 'asc' },
    include: { changedBy: { select: { fullName: true, role: true } } },
  },
};

const toAdminOrderDto = (order) => ({
  ...toOrderDto(order),
  customer: order.user, // [F13] null với đơn của khách vãng lai (xem isGuest)
  allowedNext: allowedNext(order.status),
  history: order.history.map((entry) => ({
    status: entry.status,
    note: entry.note,
    createdAt: entry.createdAt,
    changedBy: entry.changedBy
      ? { fullName: entry.changedBy.fullName, role: entry.changedBy.role }
      : null,
  })),
});

// "%" và "_" là ký tự đặc biệt của LIKE; gõ "50%" thì phải tìm đúng chuỗi "50%" (Prisma `contains` không tự thoát chúng)
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

// Id các đơn khớp từ khóa (mã đơn, tên hoặc số điện thoại người nhận), không phân biệt hoa thường
const searchOrderIds = async (search) => {
  const pattern = `%${escapeLike(search)}%`;
  const rows = await prisma.$queryRaw`
    SELECT id FROM orders
    WHERE code ILIKE ${pattern} OR recipient_name ILIKE ${pattern} OR phone LIKE ${pattern}`;
  return rows.map((row) => row.id);
};

/** US-19 AC1: danh sách đơn của mọi khách, lọc theo trạng thái, tìm theo mã đơn / tên / số điện thoại người nhận. */
export const adminListOrders = async ({ page, pageSize, status, search }) => {
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { id: { in: await searchOrderIds(search) } } : {}),
  };
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: listInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);
  return { items: orders.map(toListItem), page, pageSize, total };
};

export const adminGetOrder = async (code) => {
  const order = await prisma.order.findUnique({ where: { code }, include: adminInclude });
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');
  return toAdminOrderDto(order);
};

/** US-19 AC2 đến AC4: Admin đổi trạng thái theo luồng hợp lệ (BR-06); sai luồng trả 400. */
export const adminUpdateStatus = async (adminId, code, { status, note }) => {
  const order = await prisma.order.findUnique({ where: { code } });
  if (!order) throw new AppError(404, 'Không tìm thấy đơn hàng', 'ORDER_NOT_FOUND');

  await prisma.$transaction((tx) =>
    changeStatus(tx, order.id, status, {
      allowed: ORDER_STATUSES,
      note: status === 'CANCELLED' ? `Cửa hàng hủy đơn: ${note}` : note,
      actorId: adminId,
      cancelReason: note,
    }),
  );
  return adminGetOrder(code);
};
