/**
 * @feature [F01] Xác thực - Tạo và kiểm tra token.
 *  - Access token: JWT ký bằng khóa bí mật, sống 15 phút, dùng cho mỗi request.
 *  - Refresh token: chuỗi ngẫu nhiên (không phải JWT) sống 7 ngày, chỉ dùng để xin access token mới.
 *    Trong DB chỉ lưu bản băm SHA-256, nên lộ DB cũng không dùng được token (SDD mục 1).
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày

// Payload chỉ chứa id và role; thông tin còn lại luôn đọc mới từ DB để không bị cũ
export const signAccessToken = (user) =>
  jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user.id),
    expiresIn: ACCESS_TOKEN_TTL,
  });

/** Trả về payload nếu hợp lệ; ném lỗi của jsonwebtoken nếu sai chữ ký hoặc hết hạn. */
export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_ACCESS_SECRET);

// SHA-256 đủ cho token ngẫu nhiên 256 bit (không cần bcrypt vì không phải mật khẩu người dùng đặt)
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/** Sinh refresh token mới: trả về token gốc (gửi cho client) và bản băm (lưu DB). */
export const generateRefreshToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
};
