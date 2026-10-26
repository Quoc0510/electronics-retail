/**
 * @feature [F03] Sản phẩm - Nghiệp vụ ảnh sản phẩm: thêm, sắp xếp thứ tự, xóa (US-08 AC6).
 * Ảnh có sortOrder nhỏ nhất là ảnh đại diện.
 */
import { prisma } from '../lib/prisma.js';
import { removeStoredFile, saveProductImage } from '../lib/storage.js';
import { MAX_IMAGES_PER_PRODUCT } from '../middlewares/upload.js';
import { AppError } from '../utils/AppError.js';
import { detectImageType } from '../utils/imageType.js';

const IMAGE_ORDER = [{ sortOrder: 'asc' }, { id: 'asc' }];

const assertProductExists = async (productId) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw new AppError(404, 'Không tìm thấy sản phẩm', 'NOT_FOUND');
};

export const listImages = (productId) =>
  prisma.productImage.findMany({
    where: { productId },
    orderBy: IMAGE_ORDER,
    select: { id: true, url: true, sortOrder: true },
  });

/**
 * Thêm các file ảnh vào sản phẩm. Hoặc thêm hết, hoặc không thêm gì: mọi file được kiểm tra
 * (đúng loại, không vượt quá số ảnh cho phép) trước khi ghi bất cứ thứ gì.
 * @param {{ buffer: Buffer, originalname: string }[]} files
 */
export const addImages = async (productId, files) => {
  await assertProductExists(productId);

  if (!files?.length) throw new AppError(400, 'Vui lòng chọn ít nhất một ảnh', 'NO_FILE');

  // US-08 AC6: chỉ nhận jpg/png/webp, xác định bằng nội dung thật của file
  const detected = files.map((file) => {
    const type = detectImageType(file.buffer);
    if (!type) {
      throw new AppError(
        400,
        `File "${file.originalname}" không phải ảnh jpg, png hoặc webp`,
        'INVALID_IMAGE_TYPE',
      );
    }
    return { buffer: file.buffer, ext: type.ext };
  });

  const existing = await prisma.productImage.count({ where: { productId } });
  if (existing + detected.length > MAX_IMAGES_PER_PRODUCT) {
    throw new AppError(
      400,
      `Mỗi sản phẩm tối đa ${MAX_IMAGES_PER_PRODUCT} ảnh (hiện có ${existing})`,
      'TOO_MANY_IMAGES',
    );
  }

  // Ghi file ra đĩa trước rồi mới ghi DB; nếu DB lỗi thì xóa các file vừa ghi để không để lại file mồ côi
  const urls = await Promise.all(detected.map((file) => saveProductImage(file.buffer, file.ext)));
  try {
    const last = await prisma.productImage.aggregate({
      where: { productId },
      _max: { sortOrder: true },
    });
    const start = (last._max.sortOrder ?? -1) + 1;
    await prisma.productImage.createMany({
      data: urls.map((url, index) => ({ productId, url, sortOrder: start + index })),
    });
  } catch (error) {
    await Promise.all(urls.map(removeStoredFile));
    throw error;
  }

  return listImages(productId);
};

/** Đặt lại thứ tự ảnh; danh sách phải gồm đúng tất cả ảnh của sản phẩm, ảnh đầu tiên là ảnh đại diện. */
export const reorderImages = async (productId, imageIds) => {
  await assertProductExists(productId);

  const current = await listImages(productId);
  const sameSet =
    imageIds.length === current.length &&
    new Set(imageIds).size === imageIds.length &&
    current.every((image) => imageIds.includes(image.id));
  if (!sameSet) {
    throw new AppError(400, 'Danh sách ảnh không khớp với ảnh của sản phẩm', 'INVALID_IMAGE_ORDER');
  }

  await prisma.$transaction(
    imageIds.map((id, index) =>
      prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  return listImages(productId);
};

export const deleteImage = async (productId, imageId) => {
  // Kèm productId để không xóa nhầm ảnh của sản phẩm khác
  const image = await prisma.productImage.findFirst({ where: { id: imageId, productId } });
  if (!image) throw new AppError(404, 'Không tìm thấy ảnh', 'NOT_FOUND');

  await prisma.productImage.delete({ where: { id: imageId } });
  await removeStoredFile(image.url);
};
