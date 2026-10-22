/**
 * @feature [F01] Xác thực - Nghiệp vụ đăng ký, đăng nhập, làm mới phiên, đăng xuất (US-01 → US-03).
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/AppError.js';
import {
  REFRESH_TOKEN_TTL_MS,
  generateRefreshToken,
  hashToken,
  signAccessToken,
} from '../utils/tokens.js';

const BCRYPT_COST = 10; // NFR-03: cost >= 10

// Băm giả dùng khi email không tồn tại, để thời gian phản hồi không lộ email có trong hệ thống hay không
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau-that', BCRYPT_COST);

/** Bỏ các trường nhạy cảm trước khi trả user về cho client. */
export const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  role: user.role,
  createdAt: user.createdAt,
});

/** Tạo cặp token mới và lưu bản băm của refresh token vào DB. */
const issueTokens = async (user, db = prisma) => {
  const { token, tokenHash } = generateRefreshToken();
  await db.refreshToken.create({
    data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) },
  });
  return { accessToken: signAccessToken(user), refreshToken: token };
};

// US-01: đăng ký. BR-10: đăng ký công khai luôn tạo vai trò CUSTOMER (không nhận role từ client)
export const register = async ({ email, password, fullName, phone }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'Email này đã được đăng ký', 'EMAIL_TAKEN');

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        fullName,
        phone,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
        role: 'CUSTOMER',
      },
    });
  } catch (error) {
    // Hai người đăng ký cùng email cùng lúc: vượt qua bước kiểm tra trên nhưng bị unique của DB chặn
    if (error.code === 'P2002') {
      throw new AppError(409, 'Email này đã được đăng ký', 'EMAIL_TAKEN');
    }
    throw error;
  }

  // US-01 AC3: đăng ký xong tự đăng nhập
  return { user: toPublicUser(user), ...(await issueTokens(user)) };
};

// US-02: đăng nhập
export const login = async ({ email, password }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  // AC2: thông báo chung, không cho biết sai email hay sai mật khẩu
  if (!user || !passwordOk) {
    throw new AppError(401, 'Email hoặc mật khẩu không đúng', 'INVALID_CREDENTIALS');
  }
  // AC3: chỉ báo "bị khóa" sau khi mật khẩu đúng, để người lạ không dò được tài khoản nào bị khóa
  if (!user.isActive) {
    throw new AppError(403, 'Tài khoản đã bị khóa, vui lòng liên hệ cửa hàng', 'ACCOUNT_LOCKED');
  }

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
};

// US-03: dùng refresh token để lấy cặp token mới (xoay vòng: token cũ bị thu hồi ngay)
export const refresh = async (refreshToken) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: true },
  });
  if (!stored) throw new AppError(401, 'Phiên đăng nhập không hợp lệ', 'INVALID_TOKEN');

  // Token đã bị thu hồi mà vẫn được gửi lại: nhiều khả năng đã bị đánh cắp,
  // nên thu hồi toàn bộ phiên của người dùng này để bắt đăng nhập lại
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, 'Phiên đăng nhập không hợp lệ', 'INVALID_TOKEN');
  }
  if (stored.expiresAt < new Date()) {
    throw new AppError(401, 'Phiên đăng nhập đã hết hạn', 'TOKEN_EXPIRED');
  }
  if (!stored.user.isActive) {
    throw new AppError(401, 'Tài khoản không tồn tại hoặc đã bị khóa', 'UNAUTHORIZED');
  }

  // Thu hồi token cũ và cấp token mới trong một transaction để không bị lệch trạng thái
  return prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueTokens(stored.user, tx);
  });
};

// US-03 AC2: đăng xuất thu hồi refresh token. Gọi lại nhiều lần vẫn thành công (idempotent)
export const logout = async (refreshToken) => {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

/** Thu hồi toàn bộ phiên của một người dùng (dùng khi đổi mật khẩu, khóa tài khoản). */
export const revokeAllSessions = (userId, db = prisma) =>
  db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
