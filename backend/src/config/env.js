/**
 * @feature [F00] Nền tảng - Đọc và kiểm tra biến môi trường.
 * Cấu hình được tách khỏi mã nguồn (rubric TC2.4): mọi giá trị nhạy cảm nằm trong .env.
 * Nếu thiếu hoặc sai biến bắt buộc, server báo lỗi rõ ràng và dừng ngay khi khởi động.
 */
import 'dotenv/config';
import { z, flattenError } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'Thiếu DATABASE_URL'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
  // [F01] Khóa ký JWT: đủ dài để không bị dò (NFR-03)
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET phải dài ít nhất 32 ký tự'),
  // [F01] Giới hạn số lần gọi API đăng nhập / 15 phút / IP
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Chưa có logger ở bước này nên dùng console là hợp lý
  // eslint-disable-next-line no-console
  console.error('Biến môi trường không hợp lệ:', flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

// [F01] Chặn việc vô tình chạy production với khóa mẫu trong .env.example
if (
  parsed.data.NODE_ENV === 'production' &&
  parsed.data.JWT_ACCESS_SECRET.startsWith('doi-gia-tri-nay')
) {
  // eslint-disable-next-line no-console
  console.error('Production không được dùng JWT_ACCESS_SECRET mẫu, hãy đặt khóa ngẫu nhiên.');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  // Chuyển chuỗi "a,b" thành mảng ["a", "b"]
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
};
