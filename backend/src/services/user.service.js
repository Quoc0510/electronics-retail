/**
 * @feature [F01] Xác thực - Hồ sơ cá nhân, đổi mật khẩu và sổ địa chỉ (US-04).
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { revokeAllSessions, toPublicUser } from './auth.service.js';

const BCRYPT_COST = 10;

// --- Hồ sơ ---

export const getProfile = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return toPublicUser(user);
};

export const updateProfile = async (userId, data) => {
  const user = await prisma.user.update({ where: { id: userId }, data });
  return toPublicUser(user);
};

// US-04 AC2: đổi mật khẩu phải nhập đúng mật khẩu cũ
export const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'Mật khẩu hiện tại không đúng', 'WRONG_PASSWORD');
  }

  // Đổi mật khẩu thì đăng xuất mọi thiết bị: nếu mật khẩu cũ đã bị lộ, kẻ xấu mất quyền truy cập
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_COST) },
    });
    await revokeAllSessions(userId, tx);
  });
};

// --- Sổ địa chỉ ---

export const listAddresses = (userId) =>
  prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });

// Chỉ lấy địa chỉ thuộc về chính người dùng, người khác truy cập sẽ nhận 404
const findOwnAddress = async (userId, id, db = prisma) => {
  const address = await db.address.findFirst({ where: { id, userId } });
  if (!address) throw new AppError(404, 'Không tìm thấy địa chỉ', 'NOT_FOUND');
  return address;
};

export const createAddress = (userId, data) =>
  prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    // Địa chỉ đầu tiên luôn là mặc định
    const isDefault = count === 0 ? true : Boolean(data.isDefault);
    // US-04 AC3: tối đa một địa chỉ mặc định
    if (isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({ data: { ...data, isDefault, userId } });
  });

export const updateAddress = (userId, id, data) =>
  prisma.$transaction(async (tx) => {
    const current = await findOwnAddress(userId, id, tx);
    if (data.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    // Không cho bỏ cờ mặc định trực tiếp, vì phải luôn còn một địa chỉ mặc định: đặt địa chỉ khác làm mặc định thay thế
    const isDefault = data.isDefault === false ? current.isDefault : data.isDefault;
    return tx.address.update({ where: { id }, data: { ...data, isDefault } });
  });

export const deleteAddress = (userId, id) =>
  prisma.$transaction(async (tx) => {
    const address = await findOwnAddress(userId, id, tx);
    await tx.address.delete({ where: { id } });

    // Nếu vừa xóa địa chỉ mặc định, chuyển cờ mặc định sang địa chỉ mới nhất còn lại
    if (address.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
