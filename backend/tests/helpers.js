/**
 * @feature [F00] Nền tảng - Hàm dùng chung cho test tích hợp.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';

/** Xóa sạch dữ liệu test (chỉ ở schema "test") và đặt lại bộ đếm id. */
export const resetDatabase = () =>
  prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, categories, brands, products, orders, coupons RESTART IDENTITY CASCADE',
  );

/** Tạo nhanh một người dùng trực tiếp trong DB (bỏ qua API) để chuẩn bị dữ liệu cho test. */
export const createUser = async ({
  email = 'user@example.com',
  password = 'Matkhau123',
  fullName = 'Nguyễn Văn A',
  role = 'CUSTOMER',
  isActive = true,
} = {}) =>
  prisma.user.create({
    // Cost thấp (4) để test chạy nhanh; logic so khớp mật khẩu không đổi
    data: { email, fullName, role, isActive, passwordHash: await bcrypt.hash(password, 4) },
  });

/** Đăng nhập qua API và trả về access token để gắn vào header Authorization. */
export const loginAs = async (request, app, email, password = 'Matkhau123') => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return res.body;
};

/** Tạo nhanh một sản phẩm gắn với danh mục và thương hiệu (dùng để thử quy tắc "đã có sản phẩm thì không xóa"). */
export const createProduct = ({ categoryId, brandId, sku = 'SKU-1', isActive = true }) =>
  prisma.product.create({
    data: {
      sku,
      name: `Sản phẩm ${sku}`,
      slug: `san-pham-${sku.toLowerCase()}`,
      price: 1000000,
      stock: 5,
      isActive,
      categoryId,
      brandId,
    },
  });

/** [F08] Tạo nhanh một danh mục và một thương hiệu đang hiện. */
export const createCatalog = async () => ({
  category: await prisma.category.create({ data: { name: 'Điện thoại', slug: 'dien-thoai' } }),
  brand: await prisma.brand.create({ data: { name: 'Hãng A', slug: 'hang-a' } }),
});

let orderSeq = 0;
/** [F08] Tạo thẳng một đơn của người dùng chứa một sản phẩm (mặc định đã hoàn thành) để chuẩn bị điều kiện được đánh giá. */
export const createOrderWith = ({ userId, product, status = 'COMPLETED' }) => {
  orderSeq += 1;
  return prisma.order.create({
    data: {
      code: `TS261029-T${String(orderSeq).padStart(3, '0')}`,
      userId,
      status,
      subtotal: product.price,
      shippingFee: 0,
      total: product.price,
      recipientName: 'Người nhận',
      phone: '0900000000',
      shippingAddress: '1 Đường A, Quận B',
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            productSku: product.sku,
            unitPrice: product.price,
            quantity: 1,
          },
        ],
      },
    },
  });
};
