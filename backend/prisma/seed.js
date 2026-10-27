/**
 * @feature [F00-F03] Dữ liệu mẫu cho môi trường phát triển.
 * Chạy bằng: npm run prisma:seed -w backend. Có thể chạy lại nhiều lần (dùng upsert, không tạo trùng).
 *
 * Tài khoản mẫu CHỈ dành cho máy dev (BR-10: tài khoản ADMIN đầu tiên được tạo bằng seed).
 * Trên môi trường thật phải đặt SEED_ADMIN_PASSWORD bằng mật khẩu mạnh qua biến môi trường.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { slugify } from '../src/utils/slugify.js';
import { renderProductArt } from './productArt.js';

const prisma = new PrismaClient();

const BCRYPT_COST = 10; // NFR-03: cost >= 10

const categories = ['Điện thoại', 'Laptop', 'Máy tính bảng', 'Phụ kiện', 'Đồng hồ thông minh'];

const brands = ['Apple', 'Samsung', 'Xiaomi', 'Dell', 'ASUS', 'Sony', 'Anker'];

// [F04] Loại thiết bị và tông màu của ảnh minh họa cho từng SKU (xem productArt.js)
const ART = {
  'IP15-128': { kind: 'phone', tone: 0 },
  'IP15PM-256': { kind: 'phone', tone: 1 },
  'SS-S24U-256': { kind: 'phone', tone: 2 },
  'SS-A55-128': { kind: 'phone', tone: 1 },
  'XM-RN13P': { kind: 'phone', tone: 0 },
  'MBA-M2-256': { kind: 'laptop', tone: 0 },
  'DELL-XPS13': { kind: 'laptop', tone: 1 },
  'ASUS-VB15': { kind: 'laptop', tone: 0 },
  'ASUS-G16': { kind: 'laptop', tone: 1 },
  'IPAD-AIR-M2': { kind: 'tablet', tone: 0 },
  'SS-TABS9FE': { kind: 'tablet', tone: 1 },
  'SONY-XM5': { kind: 'headphones', tone: 0 },
  'ANK-737': { kind: 'powerbank', tone: 0 },
  'ANK-C100': { kind: 'cable', tone: 0 },
  'AW-S9-41': { kind: 'watch', tone: 0 },
  'SS-GW6-44': { kind: 'watch', tone: 1 },
};

// stock thấp (<= 5) ở vài sản phẩm để thử tính năng cảnh báo tồn kho ở dashboard (US-26)
const products = [
  {
    sku: 'IP15-128',
    name: 'iPhone 15 128GB',
    category: 'Điện thoại',
    brand: 'Apple',
    price: 19990000,
    salePrice: 18490000,
    stock: 25,
    specs: {
      'Màn hình': '6.1 inch OLED',
      Chip: 'Apple A16 Bionic',
      RAM: '6GB',
      'Bộ nhớ': '128GB',
      Pin: '3349 mAh',
    },
  },
  {
    sku: 'IP15PM-256',
    name: 'iPhone 15 Pro Max 256GB',
    category: 'Điện thoại',
    brand: 'Apple',
    price: 34990000,
    stock: 12,
    specs: {
      'Màn hình': '6.7 inch OLED',
      Chip: 'Apple A17 Pro',
      RAM: '8GB',
      'Bộ nhớ': '256GB',
      Pin: '4422 mAh',
    },
  },
  {
    sku: 'SS-S24U-256',
    name: 'Samsung Galaxy S24 Ultra 256GB',
    category: 'Điện thoại',
    brand: 'Samsung',
    price: 33990000,
    salePrice: 29990000,
    stock: 15,
    specs: {
      'Màn hình': '6.8 inch Dynamic AMOLED 2X',
      Chip: 'Snapdragon 8 Gen 3',
      RAM: '12GB',
      'Bộ nhớ': '256GB',
      Pin: '5000 mAh',
    },
  },
  {
    sku: 'SS-A55-128',
    name: 'Samsung Galaxy A55 5G 8GB/128GB',
    category: 'Điện thoại',
    brand: 'Samsung',
    price: 9990000,
    stock: 40,
    specs: {
      'Màn hình': '6.6 inch Super AMOLED',
      Chip: 'Exynos 1480',
      RAM: '8GB',
      'Bộ nhớ': '128GB',
      Pin: '5000 mAh',
    },
  },
  {
    sku: 'XM-RN13P',
    name: 'Xiaomi Redmi Note 13 Pro 8GB/256GB',
    category: 'Điện thoại',
    brand: 'Xiaomi',
    price: 6990000,
    salePrice: 6290000,
    stock: 60,
    specs: {
      'Màn hình': '6.67 inch AMOLED 120Hz',
      Chip: 'Snapdragon 7s Gen 2',
      RAM: '8GB',
      'Bộ nhớ': '256GB',
      Pin: '5100 mAh',
    },
  },
  {
    sku: 'MBA-M2-256',
    name: 'MacBook Air M2 13 inch 8GB/256GB',
    category: 'Laptop',
    brand: 'Apple',
    price: 24990000,
    salePrice: 22990000,
    stock: 10,
    specs: {
      'Màn hình': '13.6 inch Liquid Retina',
      Chip: 'Apple M2',
      RAM: '8GB',
      'Ổ cứng': 'SSD 256GB',
      Pin: 'Đến 18 giờ',
    },
  },
  {
    sku: 'DELL-XPS13',
    name: 'Dell XPS 13 9340 Core Ultra 7',
    category: 'Laptop',
    brand: 'Dell',
    price: 39990000,
    stock: 3,
    specs: {
      'Màn hình': '13.4 inch FHD+',
      CPU: 'Intel Core Ultra 7 155H',
      RAM: '16GB',
      'Ổ cứng': 'SSD 512GB',
      Pin: '55 Wh',
    },
  },
  {
    sku: 'ASUS-VB15',
    name: 'ASUS Vivobook 15 X1504 Core i5',
    category: 'Laptop',
    brand: 'ASUS',
    price: 14990000,
    stock: 20,
    specs: {
      'Màn hình': '15.6 inch FHD',
      CPU: 'Intel Core i5-1335U',
      RAM: '16GB',
      'Ổ cứng': 'SSD 512GB',
      Pin: '42 Wh',
    },
  },
  {
    sku: 'ASUS-G16',
    name: 'ASUS ROG Strix G16 Core i7 RTX 4060',
    category: 'Laptop',
    brand: 'ASUS',
    price: 35990000,
    stock: 5,
    specs: {
      'Màn hình': '16 inch FHD+ 165Hz',
      CPU: 'Intel Core i7-13650HX',
      RAM: '16GB',
      'Ổ cứng': 'SSD 1TB',
      'Card đồ họa': 'RTX 4060 8GB',
    },
  },
  {
    sku: 'IPAD-AIR-M2',
    name: 'iPad Air M2 11 inch 128GB',
    category: 'Máy tính bảng',
    brand: 'Apple',
    price: 16990000,
    stock: 18,
    specs: {
      'Màn hình': '11 inch Liquid Retina',
      Chip: 'Apple M2',
      'Bộ nhớ': '128GB',
      Pin: 'Đến 10 giờ',
    },
  },
  {
    sku: 'SS-TABS9FE',
    name: 'Samsung Galaxy Tab S9 FE 6GB/128GB',
    category: 'Máy tính bảng',
    brand: 'Samsung',
    price: 9490000,
    stock: 22,
    specs: {
      'Màn hình': '10.9 inch TFT',
      Chip: 'Exynos 1380',
      RAM: '6GB',
      'Bộ nhớ': '128GB',
      Pin: '8000 mAh',
    },
  },
  {
    sku: 'SONY-XM5',
    name: 'Tai nghe chống ồn Sony WH-1000XM5',
    category: 'Phụ kiện',
    brand: 'Sony',
    price: 7990000,
    salePrice: 6990000,
    stock: 30,
    specs: {
      Loại: 'Over-ear không dây',
      'Chống ồn': 'Có (ANC)',
      'Thời lượng pin': '30 giờ',
      'Kết nối': 'Bluetooth 5.2',
    },
  },
  {
    sku: 'ANK-737',
    name: 'Sạc dự phòng Anker 737 24.000mAh 140W',
    category: 'Phụ kiện',
    brand: 'Anker',
    price: 2290000,
    stock: 50,
    specs: { 'Dung lượng': '24.000 mAh', 'Công suất': '140W', Cổng: '2 USB-C, 1 USB-A' },
  },
  {
    sku: 'ANK-C100',
    name: 'Cáp sạc Anker USB-C to USB-C 100W 1m',
    category: 'Phụ kiện',
    brand: 'Anker',
    price: 290000,
    stock: 100,
    specs: { 'Công suất': '100W', 'Độ dài': '1 m', 'Chuẩn cáp': 'USB-C to USB-C' },
  },
  {
    sku: 'AW-S9-41',
    name: 'Apple Watch Series 9 41mm',
    category: 'Đồng hồ thông minh',
    brand: 'Apple',
    price: 10490000,
    stock: 14,
    specs: {
      'Màn hình': '41 mm LTPO OLED',
      Chip: 'Apple S9',
      'Chống nước': '50m',
      Pin: 'Đến 18 giờ',
    },
  },
  {
    sku: 'SS-GW6-44',
    name: 'Samsung Galaxy Watch6 44mm',
    category: 'Đồng hồ thông minh',
    brand: 'Samsung',
    price: 6490000,
    salePrice: 5490000,
    stock: 16,
    specs: { 'Màn hình': '1.5 inch Super AMOLED', 'Chống nước': '5ATM', Pin: '425 mAh' },
  },
];

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
  const categoryIds = {};
  for (const name of categories) {
    const category = await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    categoryIds[name] = category.id;
  }

  const brandIds = {};
  for (const name of brands) {
    const brand = await prisma.brand.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
    brandIds[name] = brand.id;
  }

  // --- Sản phẩm và ảnh (F03) ---
  for (const { category, brand, ...data } of products) {
    const slug = slugify(data.name);
    const saved = await prisma.product.upsert({
      where: { sku: data.sku },
      update: {},
      create: {
        ...data,
        slug,
        description: `${data.name} chính hãng, bảo hành 12 tháng.`,
        categoryId: categoryIds[category],
        brandId: brandIds[brand],
      },
    });

    // [F04] Ảnh minh họa SVG tự sinh, lưu vào thư mục uploads/seed (được .gitignore bỏ qua nên không đưa vào Git)
    const { kind, tone } = ART[data.sku];
    const fileName = `${data.sku.toLowerCase()}.svg`;
    fs.mkdirSync(path.join(env.uploadDir, 'seed'), { recursive: true });
    fs.writeFileSync(
      path.join(env.uploadDir, 'seed', fileName),
      renderProductArt({ kind, tone, brand }),
    );
    const url = `/uploads/seed/${fileName}`;

    // Chưa có ảnh thì tạo; còn ảnh mẫu cũ (placehold.co) thì thay bằng ảnh mới; ảnh do quản trị viên tải lên được giữ nguyên
    const existing = await prisma.productImage.findFirst({
      where: { productId: saved.id },
      orderBy: { sortOrder: 'asc' },
    });
    if (!existing) {
      await prisma.productImage.create({ data: { productId: saved.id, url, sortOrder: 0 } });
    } else if (existing.url.startsWith('https://placehold.co')) {
      await prisma.productImage.update({ where: { id: existing.id }, data: { url } });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed xong: ${categories.length} danh mục, ${brands.length} thương hiệu, ${products.length} sản phẩm, 2 người dùng.`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
