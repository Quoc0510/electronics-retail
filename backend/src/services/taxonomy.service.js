/**
 * @feature [F02] Danh mục và thương hiệu - Nghiệp vụ chung cho "danh mục" và "thương hiệu" (US-06, US-07).
 * Hai bảng categories và brands có cùng quy tắc: tên duy nhất, slug sinh từ tên, không xóa khi đã có
 * sản phẩm (BR-09), chỉ được ẩn. Viết một lần dưới dạng "nhà máy" rồi tạo hai bản (xem catalog.service.js).
 */
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { slugify } from '../utils/slugify.js';

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * @param {object} options
 * @param {'category'|'brand'} options.model Tên model Prisma
 * @param {string} options.label Tên gọi hiển thị trong thông báo lỗi, ví dụ 'danh mục'
 */
export const createTaxonomyService = ({ model, label }) => {
  // Truy cập model qua hàm để luôn lấy đúng đối tượng prisma hiện tại (dễ giả lập khi kiểm thử)
  const table = () => prisma[model];

  // Đếm số sản phẩm đi kèm mỗi dòng; Prisma trả về dạng _count nên đổi thành productCount cho dễ dùng
  const toDto = ({ _count, ...item }) => ({ ...item, productCount: _count.products });

  const findOrThrow = async (id) => {
    const item = await table().findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!item) throw new AppError(404, `Không tìm thấy ${label}`, 'NOT_FOUND');
    return item;
  };

  // Tên không phân biệt hoa thường ("Laptop" và "laptop" là một) và slug cũng không được trùng
  const assertUnique = async ({ name, slug }, excludeId) => {
    const clash = await table().findFirst({
      where: {
        ...(excludeId && { id: { not: excludeId } }),
        OR: [{ name: { equals: name, mode: 'insensitive' } }, { slug }],
      },
    });
    if (clash) throw new AppError(409, `${capitalize(label)} này đã tồn tại`, 'NAME_TAKEN');
  };

  const buildSlug = (name) => {
    const slug = slugify(name);
    // Tên chỉ toàn ký tự đặc biệt (ví dụ "***") không tạo được slug dùng cho đường dẫn
    if (!slug)
      throw new AppError(400, 'Tên phải có ít nhất một chữ cái hoặc chữ số', 'INVALID_NAME');
    return slug;
  };

  return {
    // Trang quản trị: thấy cả mục đang ẩn, kèm tổng số sản phẩm
    async listAdmin({ search } = {}) {
      const items = await table().findMany({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : {},
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      });
      return items.map(toDto);
    },

    // Website khách hàng: chỉ mục đang hiện (US-06 AC3), số sản phẩm chỉ tính sản phẩm đang bán
    async listPublic() {
      const items = await table().findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: { where: { isActive: true } } } } },
      });
      return items.map(({ isActive: _isActive, createdAt: _c, updatedAt: _u, ...item }) =>
        toDto(item),
      );
    },

    async getById(id) {
      return toDto(await findOrThrow(id));
    },

    async create(data) {
      const slug = buildSlug(data.name);
      await assertUnique({ name: data.name, slug });
      try {
        const item = await table().create({
          data: { ...data, slug },
          include: { _count: { select: { products: true } } },
        });
        return toDto(item);
      } catch (error) {
        // Hai quản trị viên tạo cùng tên cùng lúc: vượt qua bước kiểm tra trên nhưng bị unique của DB chặn
        if (error.code === 'P2002') {
          throw new AppError(409, `${capitalize(label)} này đã tồn tại`, 'NAME_TAKEN');
        }
        throw error;
      }
    },

    async update(id, data) {
      await findOrThrow(id);
      const changes = { ...data };

      // Đổi tên thì sinh lại slug và kiểm tra trùng (trừ chính mục đang sửa)
      if (data.name !== undefined) {
        changes.slug = buildSlug(data.name);
        await assertUnique({ name: data.name, slug: changes.slug }, id);
      }

      try {
        const item = await table().update({
          where: { id },
          data: changes,
          include: { _count: { select: { products: true } } },
        });
        return toDto(item);
      } catch (error) {
        if (error.code === 'P2002') {
          throw new AppError(409, `${capitalize(label)} này đã tồn tại`, 'NAME_TAKEN');
        }
        throw error;
      }
    },

    // US-06 AC2, BR-09: đã có sản phẩm thì không xóa cứng, chỉ được ẩn
    async remove(id) {
      const item = await findOrThrow(id);
      if (item._count.products > 0) {
        throw new AppError(
          409,
          `${capitalize(label)} đang có ${item._count.products} sản phẩm nên không thể xóa, hãy ẩn nó thay vì xóa`,
          'HAS_PRODUCTS',
        );
      }
      await table().delete({ where: { id } });
    },
  };
};
