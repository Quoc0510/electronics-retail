# TechStore - Website bán thiết bị điện tử

Đồ án môn học Công nghệ phần mềm. Hệ thống gồm 3 phần:

| Thư mục    | Vai trò                | Công nghệ                            | Cổng |
| ---------- | ---------------------- | ------------------------------------ | ---- |
| `backend/` | REST API               | Node.js, Express, Prisma, PostgreSQL | 4000 |
| `client/`  | Website cho khách hàng | React, Vite, Tailwind CSS            | 5173 |
| `admin/`   | Trang quản trị         | React, Vite, Tailwind CSS            | 5174 |

Tài liệu: [Danh sách tính năng và lịch](docs/FEATURES.md) · [Quy ước code](docs/CODING_CONVENTION.md) · [Nhật ký AI](docs/AI_USAGE_LOG.md)

## Yêu cầu

- Node.js ≥ 20 (đã thử với 22) và npm
- Docker Desktop (để chạy PostgreSQL local)

## Cài đặt và chạy

```bash
# 1. Cài thư viện cho cả 3 phần
npm install

# 2. Bật PostgreSQL (cần mở Docker Desktop trước)
npm run db:up

# 3. Tạo file cấu hình backend
cp backend/.env.example backend/.env

# 4. Sinh Prisma Client
npm run prisma:generate -w backend

# 5. Chạy từng phần (mỗi lệnh một terminal)
npm run dev:backend
npm run dev:client
npm run dev:admin
```

Kiểm tra backend: mở http://localhost:4000/api/health (server sống) và http://localhost:4000/api/health/ready (kết nối được database).

## Lệnh thường dùng

| Lệnh                 | Tác dụng                             |
| -------------------- | ------------------------------------ |
| `npm run lint`       | Kiểm tra lỗi code (ESLint)           |
| `npm run format`     | Tự định dạng code (Prettier)         |
| `npm test`           | Chạy test của backend, client, admin |
| `npm run build`      | Build client và admin                |
| `npm run db:up/down` | Bật/tắt PostgreSQL                   |

## Cấu hình

Mọi giá trị nhạy cảm nằm trong `backend/.env` (không commit). Xem mẫu ở `backend/.env.example`.
