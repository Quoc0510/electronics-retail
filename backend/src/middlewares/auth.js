/**
 * @feature [F01] Xác thực - Middleware kiểm tra đăng nhập và phân quyền (US-05).
 *  - authenticate: bắt buộc có access token hợp lệ, gắn req.user.
 *  - requireRole: chỉ cho vai trò được chỉ định đi tiếp.
 */
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'Vui lòng đăng nhập', 'UNAUTHORIZED');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    // Token sai chữ ký hoặc hết hạn: client sẽ dùng refresh token để xin token mới
    throw new AppError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn', 'INVALID_TOKEN');
  }

  // Luôn đọc lại user từ DB để việc khóa tài khoản và đổi vai trò có hiệu lực ngay
  const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
  if (!user || !user.isActive) {
    throw new AppError(401, 'Tài khoản không tồn tại hoặc đã bị khóa', 'UNAUTHORIZED');
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
});

// Phải đặt sau authenticate. Chưa đăng nhập -> 401 (do authenticate), sai quyền -> 403
export const requireRole =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'Bạn không có quyền thực hiện thao tác này', 'FORBIDDEN'));
    }
    return next();
  };
