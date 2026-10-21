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
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Chưa có logger ở bước này nên dùng console là hợp lý
  // eslint-disable-next-line no-console
  console.error('Biến môi trường không hợp lệ:', flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  // Chuyển chuỗi "a,b" thành mảng ["a", "b"]
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
};
