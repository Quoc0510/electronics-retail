/**
 * @feature [F00-F03] Dữ liệu mẫu cho môi trường phát triển.
 * Chạy bằng: npm run prisma:seed -w backend. Có thể chạy lại nhiều lần (dùng upsert, không tạo trùng).
 *
 * Tài khoản mẫu CHỈ dành cho máy dev (BR-10: tài khoản ADMIN đầu tiên được tạo bằng seed).
 * Trên môi trường thật phải đặt SEED_ADMIN_PASSWORD bằng mật khẩu mạnh qua biến môi trường.
 *
 * Danh mục sản phẩm mẫu (sản phẩm thật) nằm ở catalog.js; toàn bộ ảnh thật (sản phẩm, logo thương hiệu, ảnh danh mục) ở seed-images/,
 * nguồn ghi trong docs/IMAGE_CREDITS.md.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { slugify } from '../src/utils/slugify.js';
import { BRANDS, LEGACY_SKUS, PRODUCTS } from './catalog.js';

const prisma = new PrismaClient();

const BCRYPT_COST = 10; // NFR-03: cost >= 10

const categories = ['Điện thoại', 'Laptop', 'Máy tính bảng', 'Phụ kiện', 'Đồng hồ thông minh'];

const SEED_IMAGE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-images');

/**
 * Chép một ảnh thật trong seed-images/ vào uploads/seed (thư mục được .gitignore bỏ qua) để backend phục vụ ở /uploads/seed/...
 * Thử lần lượt từng đuôi tệp; trả về đường dẫn công khai, hoặc null nếu chưa có ảnh nào.
 */
function publishSeedImage(baseName, extensions = ['webp']) {
  for (const ext of extensions) {
    const fileName = `${baseName}.${ext}`;
    const source = path.join(SEED_IMAGE_DIR, fileName);
    if (!fs.existsSync(source)) continue;
    const targetDir = path.join(env.uploadDir, 'seed');
    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(source, path.join(targetDir, fileName));
    return `/uploads/seed/${fileName}`;
  }
  return null;
}

async function main() {
  // --- Người dùng mẫu (F01) ---
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  await prisma.user.upsert({
    where: { email: 'admin@techstore.local' },
    update: {},
    create: {
      email: 'admin@techstore.local',
      passwordHash: await bcrypt.hash(adminPassword, BCRYPT_COST),
      fullName: 'Quản trị viên',
      role: 'ADMIN',
    },
  });
  await prisma.user.upsert({
    where: { email: 'khach@techstore.local' },
    update: {},
    create: {
      email: 'khach@techstore.local',
      passwordHash: await bcrypt.hash('Khach@123', BCRYPT_COST),
      fullName: 'Khách hàng mẫu',
      phone: '0900000000',
      role: 'CUSTOMER',
    },
  });

  // --- Danh mục và thương hiệu (F02) ---
  // Ảnh danh mục và logo thương hiệu là ảnh thật; chỉ điền khi chưa có, để ảnh do quản trị viên đặt được giữ nguyên
  const categoryIds = {};
  for (const name of categories) {
    const slug = slugify(name);
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    const imageUrl = publishSeedImage(`category-${slug}`);
    if (imageUrl && !category.imageUrl) {
      await prisma.category.update({ where: { id: category.id }, data: { imageUrl } });
    }
    categoryIds[name] = category.id;
  }

  const brandIds = {};
  for (const name of BRANDS) {
    const slug = slugify(name);
    const brand = await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { name, slug },
    });
    const logoUrl = publishSeedImage(`brand-${slug}`, ['svg', 'png', 'webp']);
    if (logoUrl && !brand.logoUrl) {
      await prisma.brand.update({ where: { id: brand.id }, data: { logoUrl } });
    }
    brandIds[name] = brand.id;
  }

  // --- Sản phẩm và ảnh (F03) ---
  for (const { category, brand, ...data } of PRODUCTS) {
    const slug = slugify(data.name);
    const saved = await prisma.product.upsert({
      where: { sku: data.sku },
      update: {},
      create: {
        ...data,
        slug,
        categoryId: categoryIds[category],
        brandId: brandIds[brand],
      },
    });

    const url = publishSeedImage(data.sku.toLowerCase());
    if (!url)
      throw new Error(
        `Thiếu ảnh thật cho sản phẩm mẫu ${data.sku} (seed-images/${data.sku.toLowerCase()}.webp)`,
      );

    // Chưa có ảnh thì tạo; ảnh mẫu cũ (placehold.co, hoặc SVG của bộ dữ liệu cũ) thì thay bằng ảnh thật; ảnh do quản trị viên tải lên được giữ nguyên
    const existing = await prisma.productImage.findFirst({
      where: { productId: saved.id },
      orderBy: { sortOrder: 'asc' },
    });
    if (!existing) {
      await prisma.productImage.create({ data: { productId: saved.id, url, sortOrder: 0 } });
    } else if (
      existing.url.startsWith('https://placehold.co') ||
      /^\/uploads\/seed\/.+\.svg$/.test(existing.url)
    ) {
      await prisma.productImage.update({ where: { id: existing.id }, data: { url } });
    }
  }

  // 16 sản phẩm của bộ dữ liệu mẫu cũ: ẩn đi, không xóa (BR-09: đơn hàng, giỏ hàng, đánh giá cũ còn tham chiếu)
  const hidden = await prisma.product.updateMany({
    where: { sku: { in: LEGACY_SKUS }, isActive: true },
    data: { isActive: false },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seed xong: ${categories.length} danh mục, ${BRANDS.length} thương hiệu, ${PRODUCTS.length} sản phẩm, 2 người dùng` +
      (hidden.count > 0 ? `; đã ẩn ${hidden.count} sản phẩm mẫu cũ.` : '.'),
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
