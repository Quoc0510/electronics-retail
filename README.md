# TechStore - Website bán thiết bị điện tử

Đồ án môn học Công nghệ phần mềm. Hệ thống gồm 3 phần:

| Thư mục    | Vai trò                                                                        | Công nghệ                            | Cổng |
| ---------- | ------------------------------------------------------------------------------ | ------------------------------------ | ---- |
| `backend/` | REST API                                                                       | Node.js, Express, Prisma, PostgreSQL | 4000 |
| `client/`  | Website cho khách hàng                                                         | React, Vite, Tailwind CSS            | 5173 |
| `admin/`   | Trang quản trị                                                                 | React, Vite, Tailwind CSS            | 5174 |
| `shared/`  | Code dùng chung của client và admin (gọi API, đăng nhập, Button, FormField...) | React, Axios                         | -    |

Tài liệu: [Danh sách tính năng và lịch](docs/FEATURES.md) · [SRS](docs/SRS.md) · [SDD](docs/SDD.md) · [Từ điển dữ liệu](docs/DATA_DICTIONARY.md) · [Quy ước code](docs/CODING_CONVENTION.md) · [Nhật ký AI](docs/AI_USAGE_LOG.md) · [Nợ kỹ thuật](docs/TECH_DEBT.md)

## Yêu cầu

- Node.js ≥ 20 (đã thử với 22) và npm
- Docker Desktop (để chạy PostgreSQL local)

## Cài đặt và chạy

```bash
# 1. Cài thư viện cho cả 3 phần
npm install

# 2. Bật PostgreSQL (cần mở Docker Desktop trước; DB chạy ở cổng 54320 để tránh trùng với PostgreSQL khác)
npm run db:up

# 3. Tạo file cấu hình backend
cp backend/.env.example backend/.env

# 4. Sinh Prisma Client (chạy lại mỗi khi sửa schema), tạo bảng và nạp dữ liệu mẫu
npm run prisma:generate -w backend
npm run prisma:deploy -w backend
npm run prisma:seed -w backend

# 5. Chạy từng phần (mỗi lệnh một terminal)
npm run dev:backend
npm run dev:client
npm run dev:admin
```

Kiểm tra backend: mở http://localhost:4000/api/health (server sống) và http://localhost:4000/api/health/ready (kết nối được database).

## Lệnh thường dùng

| Lệnh                 | Tác dụng                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `npm run lint`       | Kiểm tra lỗi code (ESLint)                                                                    |
| `npm run format`     | Tự định dạng code (Prettier)                                                                  |
| `npm test`           | Chạy test của backend, client, admin (test backend cần PostgreSQL đang chạy: `npm run db:up`) |
| `npm run build`      | Build client và admin                                                                         |
| `npm run db:up/down` | Bật/tắt PostgreSQL                                                                            |

## Chạy bằng Docker (như staging)

Đóng gói và chạy cả hệ thống (PostgreSQL, backend, Client, Admin) không cần cài Node:

```bash
export POSTGRES_PASSWORD=<mật khẩu> JWT_ACCESS_SECRET=<chuỗi ngẫu nhiên dài ít nhất 32 ký tự>
docker compose -f docker-compose.staging.yml up -d --build --wait
docker compose -f docker-compose.staging.yml exec -w /app/backend backend npx prisma db seed
```

Client ở http://localhost:8080, Admin ở http://localhost:8081. Dữ liệu mẫu có tài khoản công khai ở mục dưới, nên nếu staging mở ra internet hãy đổi mật khẩu Admin ngay sau khi nạp. Tắt và xóa dữ liệu: `docker compose -f docker-compose.staging.yml down -v`.

## Tài khoản mẫu (chỉ dùng trên máy dev)

| Vai trò    | Email                 | Mật khẩu  |
| ---------- | --------------------- | --------- |
| Quản trị   | admin@techstore.local | Admin@123 |
| Khách hàng | khach@techstore.local | Khach@123 |

## Cấu hình

Mọi giá trị nhạy cảm nằm trong `backend/.env` (không commit). Xem mẫu ở `backend/.env.example`.
