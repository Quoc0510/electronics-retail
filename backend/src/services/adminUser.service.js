/**
 * @feature [F10] Quản lý người dùng - Admin xem danh sách, khóa và mở khóa tài khoản (US-27).
 */
import { prisma } from '../lib/prisma.js';
import { escapeLike } from '../lib/like.js';
import { AppError } from '../utils/AppError.js';
import { revokeAllSessions } from './auth.service.js';

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  isActive: true,
  points: true,
  createdAt: true,
  _count: { select: { orders: true } },
};

// Không bao giờ trả passwordHash: chỉ chọn đúng các trường cần hiển thị
const toDto = ({ _count, ...user }) => ({ ...user, orderCount: _count.orders });

const STATUS_FILTERS = { active: { isActive: true }, locked: { isActive: false } };

/** US-27 AC1: tìm theo email (hoặc tên), lọc theo trạng thái khóa, phân trang; người mới đăng ký trước. */
export const listUsers = async ({ page, pageSize, search, status }) => {
  const where = {
    ...(status ? STATUS_FILTERS[status] : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: escapeLike(search), mode: 'insensitive' } },
            { fullName: { contains: escapeLike(search), mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);
  return { items: users.map(toDto), page, pageSize, total };
};

/**
 * US-27: khóa hoặc mở khóa tài khoản.
 *  - AC3: Admin không được tự khóa mình (sẽ mất quyền truy cập ngay và không ai mở khóa lại được nếu là Admin duy nhất).
 *  - AC2: khóa thì thu hồi toàn bộ phiên đăng nhập trong cùng transaction với việc khóa, để không có lúc tài khoản
 *    đã khóa mà refresh token vẫn còn dùng được.
 * Gọi lại với trạng thái hiện tại vẫn thành công (idempotent).
 */
export const setUserActive = async (adminId, userId, isActive) => {
  if (userId === adminId && !isActive) {
    throw new AppError(400, 'Bạn không thể khóa chính tài khoản của mình', 'CANNOT_LOCK_SELF');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!exists) throw new AppError(404, 'Không tìm thấy người dùng', 'USER_NOT_FOUND');

    const user = await tx.user.update({
      where: { id: userId },
      data: { isActive },
      select: userSelect,
    });
    if (!isActive) await revokeAllSessions(userId, tx);
    return user;
  });
  return toDto(updated);
};
