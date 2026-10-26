/**
 * @feature [F03] Sản phẩm - Lưu và xóa file ảnh trên ổ đĩa của máy chủ.
 * Tách riêng thành một module để sau này đổi sang dịch vụ lưu trữ đám mây (S3, Cloudinary) chỉ phải sửa ở đây.
 * Lưu ý khi deploy: ổ đĩa của nhiều nền tảng miễn phí bị xóa mỗi lần khởi động lại (xem docs/TECH_DEBT.md).
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const PRODUCT_FOLDER = 'products';
const URL_PREFIX = '/uploads/';

/**
 * Lưu ảnh và trả về đường dẫn công khai, ví dụ "/uploads/products/3f2a....jpg".
 * Tên file do hệ thống tự sinh (UUID), KHÔNG dùng tên người dùng gửi lên, nên không thể chèn "../" để ghi ra ngoài thư mục.
 */
export const saveProductImage = async (buffer, ext) => {
  const folder = path.join(env.uploadDir, PRODUCT_FOLDER);
  await fs.mkdir(folder, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${ext}`;
  await fs.writeFile(path.join(folder, fileName), buffer);
  return `${URL_PREFIX}${PRODUCT_FOLDER}/${fileName}`;
};

/**
 * Xóa file ứng với một đường dẫn đã lưu. Bỏ qua ảnh ngoài (http://...) vì không phải file của mình,
 * và bỏ qua nếu file không còn (xóa hai lần vẫn an toàn).
 */
export const removeStoredFile = async (url) => {
  if (!url?.startsWith(URL_PREFIX)) return;

  const root = path.resolve(env.uploadDir);
  const target = path.resolve(root, url.slice(URL_PREFIX.length));
  // Lớp bảo vệ thứ hai: đường dẫn sau khi giải quyết phải nằm trong thư mục upload
  if (!target.startsWith(root + path.sep)) return;

  try {
    await fs.unlink(target);
  } catch (error) {
    if (error.code !== 'ENOENT') logger.warn(`Không xóa được file ${target}: ${error.message}`);
  }
};
