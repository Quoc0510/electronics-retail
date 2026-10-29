/**
 * @feature [F04][F08] Duyệt và tìm sản phẩm - Nghiệp vụ phía khách hàng: danh sách có lọc/sắp xếp/phân trang và chi tiết
 * (F08: kèm điểm đánh giá trung bình).
 *
 * Quy tắc hiển thị: khách chỉ thấy sản phẩm đang bán VÀ thuộc danh mục, thương hiệu đang hiện
 * (ẩn danh mục thì các sản phẩm trong đó cũng không hiện, US-06 AC3).
 *
 * Danh sách dùng SQL thuần (Prisma.sql, luôn tham số hóa nên không bị SQL injection) vì Prisma chưa hỗ trợ
 * sắp xếp theo "giá bán hiện hành" = giá khuyến mãi nếu có, ngược lại giá gốc (BR-02).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { escapeLike } from '../lib/like.js';
import { visibleProductWhere } from '../lib/productVisibility.js';
import { EMPTY_RATING, getRatingBreakdown, getRatingSummaries } from '../lib/rating.js';
import { AppError } from '../utils/AppError.js';

// Giá bán hiện hành (BR-02), dùng chung cho lọc theo khoảng giá và sắp xếp theo giá
const EFFECTIVE_PRICE = Prisma.raw('COALESCE(p.sale_price, p.price)');

// Danh sách cố định nên dùng Prisma.raw an toàn: giá trị người dùng chỉ chọn KHÓA, không chèn vào SQL
const ORDER_BY = {
  newest: Prisma.raw('p.created_at DESC, p.id DESC'),
  price_asc: Prisma.raw('COALESCE(p.sale_price, p.price) ASC, p.id ASC'),
  price_desc: Prisma.raw('COALESCE(p.sale_price, p.price) DESC, p.id DESC'),
};

export const summaryInclude = {
  category: { select: { name: true, slug: true } },
  brand: { select: { name: true, slug: true } },
  images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 1, select: { url: true } },
};

// Chỉ trả những gì khách cần: không lộ tồn kho chính xác, SKU, trạng thái ẩn/hiện, thời gian
const toSummary = (product, rating) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  price: product.price,
  salePrice: product.salePrice,
  inStock: product.stock > 0,
  thumbnail: product.images[0]?.url ?? null,
  category: product.category,
  brand: product.brand,
  rating, // [F08] { average, count }: điểm trung bình các đánh giá đang hiện (BR-19)
});

/** [F08] Dựng thẻ sản phẩm (kèm điểm đánh giá) cho danh sách sản phẩm đã tải với `summaryInclude`. */
export const toSummaries = async (products) => {
  const ratings = await getRatingSummaries(products.map((product) => product.id));
  return products.map((product) => toSummary(product, ratings.get(product.id) ?? EMPTY_RATING));
};

const buildWhere = ({ search, category, brand, minPrice, maxPrice, onSale }) => {
  const conditions = [
    Prisma.sql`p.is_active = true`,
    Prisma.sql`c.is_active = true`,
    Prisma.sql`b.is_active = true`,
  ];
  if (category) conditions.push(Prisma.sql`c.slug = ${category}`);
  if (brand) conditions.push(Prisma.sql`b.slug = ${brand}`);
  // Đang khuyến mãi = có giá khuyến mãi (luôn thấp hơn giá gốc nhờ ràng buộc CHECK của DB)
  if (onSale) conditions.push(Prisma.sql`p.sale_price IS NOT NULL`);
  // US-12 AC1: không phân biệt hoa thường
  if (search) conditions.push(Prisma.sql`p.name ILIKE ${`%${escapeLike(search)}%`}`);
  if (minPrice !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE} >= ${minPrice}`);
  if (maxPrice !== undefined) conditions.push(Prisma.sql`${EFFECTIVE_PRICE} <= ${maxPrice}`);
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
};

const FROM = Prisma.sql`FROM products p JOIN categories c ON c.id = p.category_id JOIN brands b ON b.id = p.brand_id`;

export const listProducts = async (query) => {
  const { page, pageSize, sort } = query;
  const where = buildWhere(query);

  // Hai truy vấn dùng chung điều kiện: lấy id của một trang theo đúng thứ tự, và đếm tổng số kết quả
  const [rows, [{ total }]] = await Promise.all([
    prisma.$queryRaw`
      SELECT p.id ${FROM} ${where}
      ORDER BY ${ORDER_BY[sort]}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    prisma.$queryRaw`SELECT COUNT(*) AS total ${FROM} ${where}`,
  ]);

  // Lấy thông tin đầy đủ theo id rồi xếp lại đúng thứ tự của truy vấn đầu
  const ids = rows.map((row) => row.id);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: summaryInclude,
  });
  const byId = new Map((await toSummaries(products)).map((summary) => [summary.id, summary]));

  return {
    items: ids.map((id) => byId.get(id)),
    page,
    pageSize,
    total: Number(total), // COUNT(*) của PostgreSQL trả kiểu bigint
  };
};

export const getProductBySlug = async (slug) => {
  const product = await prisma.product.findFirst({
    // US-13 AC3: sản phẩm không tồn tại, đã ẩn hoặc thuộc danh mục/thương hiệu bị ẩn đều là 404
    where: { slug, ...visibleProductWhere },
    include: {
      category: { select: { name: true, slug: true } },
      brand: { select: { name: true, slug: true } },
      images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, url: true } },
    },
  });
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm', 'NOT_FOUND');

  // [F08] Điểm trung bình và số đánh giá theo từng mức sao (chỉ tính đánh giá đang hiện)
  const [summaries, breakdown] = await Promise.all([
    getRatingSummaries([product.id]),
    getRatingBreakdown(product.id),
  ]);

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    slug: product.slug,
    description: product.description,
    specs: product.specs,
    price: product.price,
    salePrice: product.salePrice,
    inStock: product.stock > 0, // US-13 AC2: chỉ "Còn hàng" hoặc "Hết hàng"
    images: product.images,
    category: product.category,
    brand: product.brand,
    rating: { ...(summaries.get(product.id) ?? EMPTY_RATING), breakdown },
  };
};
