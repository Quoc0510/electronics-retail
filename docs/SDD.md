# Thiết kế hệ thống (SDD) - TechStore

Phục vụ rubric TC2.1. Sơ đồ dùng Mermaid (GitHub tự hiển thị). Mọi sơ đồ phải khớp mã nguồn: khi đổi code hoặc schema, cập nhật lại tài liệu này trong cùng commit.

Tài liệu liên quan: [SRS.md](SRS.md) · [DATA_DICTIONARY.md](DATA_DICTIONARY.md) · [schema.prisma](../backend/prisma/schema.prisma)

## 1. Quyết định kiến trúc và phương án đã cân nhắc

| Vấn đề            | Chọn                                                                   | Phương án khác đã cân nhắc                                | Lý do chọn                                                                                                    |
| ----------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Kiểu kiến trúc    | Monolith REST API + 2 SPA                                              | Microservices; Next.js SSR fullstack                      | Nhóm nhỏ, thời gian 6 tuần: monolith đơn giản, dễ triển khai và kiểm thử. Đề bài yêu cầu tách Client và Admin |
| CSDL              | PostgreSQL                                                             | MongoDB, MySQL                                            | Dữ liệu quan hệ rõ (đơn hàng, sản phẩm), cần transaction và ràng buộc CHECK cho tồn kho                       |
| Truy cập dữ liệu  | Prisma ORM                                                             | SQL thuần với `pg`, Sequelize, Knex                       | Có migration, schema là nguồn sự thật duy nhất và sinh được ERD; truy vấn tham số hóa chống SQL injection     |
| Xác thực          | JWT access token (15 phút) + refresh token (7 ngày, lưu hash trong DB) | Session cookie phía server; chỉ dùng access token dài hạn | SPA tách domain nên JWT tiện; refresh token lưu DB cho phép thu hồi khi đăng xuất hoặc khóa tài khoản         |
| Giỏ hàng          | Lưu trên server, yêu cầu đăng nhập                                     | Lưu localStorage cho khách vãng lai                       | Đơn giản, nhất quán giữa thiết bị; giảm khối lượng. Đánh đổi: khách chưa đăng nhập không thêm giỏ được        |
| Biến thể sản phẩm | Không có (mỗi cấu hình là một sản phẩm riêng, ví dụ iPhone 15 128GB)   | Bảng ProductVariant (màu, dung lượng)                     | Tiết kiệm thời gian; với quy mô đồ án đủ dùng. Có thể mở rộng sau                                             |
| Kiểu dữ liệu tiền | `Int` đơn vị VND                                                       | `Decimal`, `Float`                                        | VND không có phần lẻ; số nguyên tránh sai số làm tròn (BR-01)                                                 |
| Frontend          | React + Vite + Tailwind, React Query                                   | Create React App, Redux                                   | Vite nhanh; React Query lo việc gọi API, cache, trạng thái loading/lỗi nên không cần Redux                    |
| Kiểm thử          | Vitest (cả 3 phần), Supertest, Playwright (E2E)                        | Jest                                                      | Một công cụ cho mọi phần, cấu hình chung với Vite                                                             |
| Tách lớp backend  | route → controller → service → Prisma                                  | Gộp logic vào route                                       | Tách nghiệp vụ khỏi HTTP để dễ kiểm thử (rubric TC2.4)                                                        |

## 2. Sơ đồ ngữ cảnh (Context)

```mermaid
flowchart LR
    KH([Khách hàng])
    QT([Quản trị viên])
    HT[["Hệ thống TechStore<br/>(Client + Admin + API + CSDL)"]]
    KH -- "Duyệt, tìm, đặt hàng, theo dõi đơn" --> HT
    QT -- "Quản lý sản phẩm, đơn hàng, thống kê" --> HT
    HT -. "(Mở rộng F11) Thanh toán trực tuyến" .-> PG[(Cổng thanh toán<br/>VNPay / ZaloPay sandbox)]
```

## 3. Sơ đồ thành phần (Component)

```mermaid
flowchart TB
    subgraph Browser
        C[client - React :5173]
        A[admin - React :5174]
    end
    subgraph Backend["backend - Express :4000"]
        MW[Middleware: helmet, CORS, rate-limit,<br/>logger, errorHandler]
        R[routes] --> CT[controllers] --> S[services]
        MW --> R
        S --> P[Prisma Client]
        V[Zod validate]
        R --> V
    end
    DB[(PostgreSQL)]
    C -- "HTTPS /api" --> MW
    A -- "HTTPS /api" --> MW
    P --> DB
```

Cấu trúc thư mục backend khớp sơ đồ: `src/routes`, `src/controllers`, `src/services`, `src/middlewares`, `src/lib/prisma.js`, `src/config`, `src/utils`. Hiện có sẵn: middleware, route health, cấu hình và tiện ích; controllers/services được thêm theo từng tính năng.

## 4. Sơ đồ thực thể - quan hệ (ERD)

Khớp với `backend/prisma/schema.prisma` (các tính năng F00–F07). Review (F08), Wishlist (F08), Coupon (F09) chưa triển khai nên chưa có trong sơ đồ này.

```mermaid
erDiagram
    users ||--o{ addresses : "có"
    users ||--o{ refresh_tokens : "có"
    users ||--o| carts : "có 1"
    users ||--o{ orders : "đặt"
    users ||--o{ order_status_history : "thực hiện"
    categories ||--o{ products : "chứa"
    brands ||--o{ products : "của"
    products ||--o{ product_images : "có"
    products ||--o{ cart_items : "nằm trong"
    products ||--o{ order_items : "nằm trong"
    carts ||--o{ cart_items : "gồm"
    orders ||--o{ order_items : "gồm"
    orders ||--o{ order_status_history : "ghi lại"

    users {
        int id PK
        string email UK
        string password_hash
        string full_name
        string phone
        enum role "CUSTOMER, ADMIN"
        bool is_active
    }
    refresh_tokens {
        int id PK
        int user_id FK
        string token_hash UK
        datetime expires_at
        datetime revoked_at
    }
    addresses {
        int id PK
        int user_id FK
        string recipient_name
        string phone
        string province
        string district
        string ward
        string street
        bool is_default
    }
    categories {
        int id PK
        string name UK
        string slug UK
        string description
        string image_url
        bool is_active
    }
    brands {
        int id PK
        string name UK
        string slug UK
        string logo_url
        bool is_active
    }
    products {
        int id PK
        string sku UK
        string name
        string slug UK
        string description
        int price
        int sale_price
        int stock
        json specs
        bool is_active
        int category_id FK
        int brand_id FK
    }
    product_images {
        int id PK
        int product_id FK
        string url
        int sort_order
    }
    carts {
        int id PK
        int user_id FK, UK
    }
    cart_items {
        int id PK
        int cart_id FK
        int product_id FK
        int quantity
    }
    orders {
        int id PK
        string code UK
        int user_id FK
        enum status "PENDING, CONFIRMED, SHIPPING, COMPLETED, CANCELLED"
        enum payment_method "COD"
        enum payment_status "UNPAID, PAID"
        int subtotal
        int shipping_fee
        int total
        string recipient_name
        string phone
        string shipping_address
        string note
        string cancel_reason
    }
    order_items {
        int id PK
        int order_id FK
        int product_id FK
        string product_name
        string product_sku
        int unit_price
        int quantity
    }
    order_status_history {
        int id PK
        int order_id FK
        enum status
        string note
        int changed_by_id FK
    }
```

Ghi chú: ngoài các cột trên, hầu hết bảng còn có `created_at` và `updated_at`. Ràng buộc CHECK (tồn kho không âm, giá dương, số lượng ≥ 1, tiền không âm) nằm ở cuối file migration `20261021000000_init`.

## 5. Sơ đồ tuần tự

### 5.1 Đặt hàng (F06, US-16)

```mermaid
sequenceDiagram
    actor KH as Khách hàng
    participant C as Client
    participant API as Backend (order.service)
    participant DB as PostgreSQL

    KH->>C: Bấm "Đặt hàng"
    C->>API: POST /api/orders (addressId, note)
    API->>API: Xác thực token, validate dữ liệu (Zod)
    API->>DB: BEGIN
    API->>DB: Đọc giỏ hàng và sản phẩm
    loop Mỗi sản phẩm trong giỏ
        API->>DB: UPDATE products SET stock = stock - qty<br/>WHERE id = ? AND stock >= qty AND is_active
        alt Không cập nhật được dòng nào
            API->>DB: ROLLBACK
            API-->>C: 409 OUT_OF_STOCK (tên sản phẩm)
        end
    end
    API->>DB: INSERT orders, order_items (snapshot BR-04), order_status_history (PENDING)
    API->>DB: DELETE cart_items
    API->>DB: COMMIT
    API-->>C: 201 Created (mã đơn, tổng tiền)
    C-->>KH: Trang đặt hàng thành công
```

Cách trừ kho `UPDATE ... WHERE stock >= qty` là một câu lệnh nguyên tử, nên nhiều đơn đồng thời không thể làm tồn kho âm (NFR-04); ràng buộc CHECK là lớp bảo vệ thứ hai.

### 5.2 Đăng nhập và làm mới phiên (F01, US-02, US-03)

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant C as Client/Admin
    participant API as Backend (auth.service)
    participant DB as PostgreSQL

    U->>C: Nhập email, mật khẩu
    C->>API: POST /api/auth/login
    API->>DB: Tìm user theo email
    API->>API: So khớp bcrypt, kiểm tra is_active
    API->>DB: INSERT refresh_tokens (lưu hash)
    API-->>C: accessToken (15 phút) + refreshToken (7 ngày)
    Note over C,API: Khi accessToken hết hạn (401)
    C->>API: POST /api/auth/refresh (refreshToken)
    API->>DB: Kiểm tra hash, chưa thu hồi, chưa hết hạn
    API->>DB: Thu hồi token cũ, tạo token mới
    API-->>C: Cặp token mới
```

## 6. Máy trạng thái đơn hàng (BR-06)

```mermaid
stateDiagram-v2
    [*] --> PENDING: Khách đặt hàng
    PENDING --> CONFIRMED: Admin xác nhận
    PENDING --> CANCELLED: Khách hoặc Admin hủy
    CONFIRMED --> SHIPPING: Admin giao cho vận chuyển
    CONFIRMED --> CANCELLED: Admin hủy
    SHIPPING --> COMPLETED: Giao thành công (payment_status = PAID)
    COMPLETED --> [*]
    CANCELLED --> [*]: Hoàn lại tồn kho
```

## 7. Sơ đồ triển khai (Deployment)

Nền tảng cụ thể chưa chốt (ưu tiên gói miễn phí); sơ đồ dưới là phương án dự kiến và sẽ cập nhật khi deploy.

```mermaid
flowchart LR
    DEV[Lập trình viên] -- git push --> GH[GitHub]
    GH -- "GitHub Actions:<br/>lint, test, quét bảo mật, build Docker" --> CI{CI/CD}
    CI -- deploy tự động --> BE[Backend container<br/>nền tảng miễn phí]
    CI -- deploy tự động --> FE[Client và Admin<br/>hosting tĩnh]
    BE --> DB[(PostgreSQL<br/>dịch vụ miễn phí)]
    FE -- "HTTPS /api" --> BE
    USER([Người dùng]) --> FE
    BE -. "/api/health" .-> MON[Giám sát health check]
```

Môi trường local: `docker-compose.yml` chạy PostgreSQL; backend và hai frontend chạy bằng `npm run dev:*`.

## 8. Nhật ký thay đổi thiết kế

| Ngày       | Thay đổi                                                                              | Lý do                                          |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 21/10/2026 | Chốt schema ban đầu F00–F07; không dùng biến thể sản phẩm; giỏ hàng yêu cầu đăng nhập | Phù hợp quy mô 6 tuần, giảm rủi ro trễ tiến độ |
