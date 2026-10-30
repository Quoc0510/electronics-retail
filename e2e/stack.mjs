/**
 * @feature [F15] Kiểm thử E2E - Bật, nạp dữ liệu và tắt hệ thống Docker riêng cho kiểm thử E2E.
 *   node e2e/stack.mjs up     Dựng và chạy PostgreSQL + backend + Client + Admin, rồi nạp dữ liệu mẫu
 *   node e2e/stack.mjs down   Tắt và XÓA dữ liệu (volume) của hệ thống này
 *
 * Dùng chính docker-compose.staging.yml (giống môi trường staging) nhưng với tên dự án và cổng RIÊNG nên không đụng tới cơ sở
 * dữ liệu dev hay các server `npm run dev:*` đang chạy: Client ở cổng 18080, Admin ở cổng 18081 (đổi bằng E2E_CLIENT_PORT,
 * E2E_ADMIN_PORT). Mật khẩu và khóa bên dưới CHỈ dùng cho hệ thống kiểm thử tạm thời này, không phải bí mật thật.
 * Chạy bằng Node (không dùng shell) để giống nhau trên Windows, macOS và Linux.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {
  ...process.env,
  POSTGRES_PASSWORD: 'e2e-only-password',
  JWT_ACCESS_SECRET: 'e2e-only-secret-khong-dung-o-dau-khac-0123456789abcdef',
  CLIENT_PORT: process.env.E2E_CLIENT_PORT ?? '18080',
  ADMIN_PORT: process.env.E2E_ADMIN_PORT ?? '18081',
  // Cả bộ kịch bản chạy từ MỘT địa chỉ IP nên nâng các giới hạn tốc độ (production giữ mặc định, xem backend/src/config/env.js)
  API_RATE_LIMIT: '100000',
  LOGIN_RATE_LIMIT: '1000',
  GUEST_ORDER_RATE_LIMIT: '1000',
  ORDER_LOOKUP_RATE_LIMIT: '1000',
  COUPON_RATE_LIMIT: '1000',
  // Git Bash trên Windows tự đổi "/app/backend" thành đường dẫn Windows; tắt việc đó cho các lệnh docker
  MSYS_NO_PATHCONV: '1',
};

const compose = (...args) =>
  spawnSync(
    'docker',
    ['compose', '-p', 'techstore-e2e', '-f', 'docker-compose.staging.yml', ...args],
    {
      cwd: root,
      env,
      stdio: 'inherit',
    },
  );

const run = (result, what) => {
  if (result.status !== 0) {
    console.error(`\nKhông ${what} được (mã thoát ${result.status}). Docker Desktop đã chạy chưa?`);
    process.exit(result.status ?? 1);
  }
};

const command = process.argv[2];
if (command === 'up') {
  run(compose('up', '-d', '--build', '--wait', '--wait-timeout', '300'), 'bật hệ thống');
  run(
    compose('exec', '-T', '-w', '/app/backend', 'backend', 'npx', 'prisma', 'db', 'seed'),
    'nạp dữ liệu mẫu',
  );
  console.log(
    `\nSẵn sàng: Client http://localhost:${env.CLIENT_PORT}  Admin http://localhost:${env.ADMIN_PORT}`,
  );
} else if (command === 'down') {
  run(compose('down', '-v'), 'tắt hệ thống');
} else {
  console.error('Dùng: node e2e/stack.mjs up | down');
  process.exit(1);
}
