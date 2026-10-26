/**
 * @feature [F00] Nền tảng - Chuẩn bị database test trước khi chạy toàn bộ test.
 * Áp dụng migration vào schema "test" (Prisma tự tạo schema nếu chưa có), nên luôn đồng bộ với schema thật.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';

export default function setup() {
  try {
    execSync('npx prisma migrate deploy', {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
  } catch (error) {
    throw new Error(
      'Không chuẩn bị được database test. Hãy bật PostgreSQL bằng `npm run db:up` rồi chạy lại.\n' +
        String(error.stderr ?? error.message),
    );
  }

  // [F03] Trả về hàm dọn dẹp, vitest gọi sau khi chạy xong toàn bộ test: xóa thư mục ảnh tạm
  return () => fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
}
