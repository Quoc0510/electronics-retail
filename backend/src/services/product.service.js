/**
 * @feature [F03] Sản phẩm - Nghiệp vụ thêm, sửa, ẩn/hiện, xóa và liệt kê sản phẩm (US-08, US-09).
 */
import { prisma } from '../lib/prisma.js';
import { removeStoredFile } from '../lib/storage.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slugify.js';

// Dữ liệu kèm theo mỗi dòng ở trang danh sách: tên danh mục, thương hiệu và ảnh đại diện (sortOrder nhỏ nhất)
const listInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 1, select: { url: true } },
};

const detailInclude = {
  category: { select: { id: true, name: true } },
  brand: { select: { id: true, name: true } },
  images: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, url: true, sortOrder: true },
  },
};

const toListItem = ({ images, description: _description, specs: _specs, ...product }) => ({
  ...product,
  thumbnail: images[0]?.url ?? null,
});

const findOrThrow = async (id, include = detailInclude) => {
  const product = await prisma.product.findUnique({ where: { id }, include });
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm', 'NOT_FOUND');
  return product;
};

// US-08: danh mục và thương hiệu được chọn phải tồn tại
const assertParentsExist = async ({ categoryId, brandId }) => {
  if (
    categoryId !== undefined &&
    !(await prisma.category.findUnique({ where: { id: categoryId } }))
  ) {
    throw new AppError(400, 'Danh mục không tồn tại', 'INVALID_CATEGORY');
  }
  if (brandId !== undefined && !(await prisma.brand.findUnique({ where: { id: brandId } }))) {
    throw new AppError(400, 'Thương hiệu không tồn tại', 'INVALID_BRAND');
  }
};

// Tên sản phẩm có thể trùng nhau (hai đời máy cùng tên) nên slug trùng thì thêm SKU phía sau để vẫn duy nhất
const buildSlug = async ({ name, sku }, excludeId) => {
  const exists = (slug) =>
    prisma.product.findFirst({
      where: { slug, ...(excludeId && { id: { not: excludeId } }) },
      select: { id: true },
    });

  const base = slugify(name);
  if (!base) throw new AppError(400, 'Tên phải có ít nhất một chữ cái hoặc chữ số', 'INVALID_NAME');
  if (!(await exists(base))) return base;

  const withSku = `${base}-${slugify(sku)}`;
  if (await exists(withSku)) throw new AppError(409, 'Sản phẩm này đã tồn tại', 'SLUG_TAKEN');
  return withSku;
};

const assertSkuFree = async (sku, excludeId) => {
  const clash = await prisma.product.findFirst({
    where: { sku, ...(excludeId && { id: { not: excludeId } }) },
    select: { id: true },
  });
  if (clash) throw new AppError(409, 'SKU này đã được dùng cho sản phẩm khác', 'SKU_TAKEN');
};

const translateUniqueError = (error) => {
  if (error.code !== 'P2002') return error;
  // Hai quản trị viên tạo cùng lúc: vượt qua bước kiểm tra nhưng bị ràng buộc UNIQUE của DB chặn
  const field = String(error.meta?.target ?? '');
  return field.includes('sku')
    ? new AppError(409, 'SKU này đã được dùng cho sản phẩm khác', 'SKU_TAKEN')
    : new AppError(409, 'Sản phẩm này đã tồn tại', 'SLUG_TAKEN');
};

export const listProducts = async ({ page, pageSize, search, categoryId, brandId, isActive }) => {
  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ],
    }),
    ...(categoryId && { categoryId }),
    ...(brandId && { brandId }),
    ...(isActive !== undefined && { isActive }),
  };

  // Chạy đồng thời hai truy vấn: lấy một trang dữ liệu và đếm tổng số dòng khớp điều kiện
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: listInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return { items: products.map(toListItem), page, pageSize, total };
};

export const getProduct = (id) => findOrThrow(id);

export const createProduct = async (data) => {
  await assertParentsExist(data);
  await assertSkuFree(data.sku);
  const slug = await buildSlug(data);

  try {
    return await prisma.product.create({
      // salePrice, stock, specs... không gửi thì dùng mặc định của schema (null, 0, {}, true)
      data: { ...data, slug },
      include: detailInclude,
    });
  } catch (error) {
    throw translateUniqueError(error);
  }
};

export const updateProduct = async (id, data) => {
  const current = await findOrThrow(id);
  await assertParentsExist(data);

  const changes = { ...data };
  if (data.sku !== undefined) await assertSkuFree(data.sku, id);

  // BR-02: Zod chỉ so sánh được khi hai giá cùng được gửi; ở đây so với giá trị hiện có trong DB
  const nextPrice = data.price ?? current.price;
  const nextSalePrice = data.salePrice === undefined ? current.salePrice : data.salePrice;
  if (nextSalePrice != null && nextSalePrice >= nextPrice) {
    throw new AppError(400, 'Giá khuyến mãi phải thấp hơn giá gốc', 'INVALID_SALE_PRICE');
  }

  // Đổi tên (hoặc SKU) thì sinh lại slug
  if (data.name !== undefined || data.sku !== undefined) {
    changes.slug = await buildSlug(
      { name: data.name ?? current.name, sku: data.sku ?? current.sku },
      id,
    );
  }

  try {
    return await prisma.product.update({ where: { id }, data: changes, include: detailInclude });
  } catch (error) {
    throw translateUniqueError(error);
  }
};

// US-09 AC2, BR-09: sản phẩm đã nằm trong đơn hàng thì không xóa cứng, chỉ được ẩn
export const deleteProduct = async (id) => {
  const product = await findOrThrow(id);

  const orderCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderCount > 0) {
    throw new AppError(
      409,
      `Sản phẩm đã có trong ${orderCount} đơn hàng nên không thể xóa, hãy ẩn nó thay vì xóa`,
      'HAS_ORDERS',
    );
  }

  // Gỡ khỏi các giỏ hàng trước (khóa ngoại không cho xóa sản phẩm còn nằm trong giỏ); ảnh được DB xóa theo
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);

  // Chỉ xóa file ảnh sau khi DB đã xóa thành công
  await Promise.all(product.images.map((image) => removeStoredFile(image.url)));
};
