# Quy ước viết code

Tài liệu này phục vụ rubric TC2.4 (tuân thủ coding convention đã công bố).

## Chung

- Ngôn ngữ: JavaScript (ES Modules). Định dạng tự động bằng Prettier, kiểm tra bằng ESLint.
- Tên biến, hàm, file dùng tiếng Anh; **comment bằng tiếng Việt**.
- Hàm ngắn, mỗi hàm làm một việc. Không hardcode URL, khóa, mật khẩu: dùng biến môi trường.
- Không dùng `console.log` ở backend, dùng `logger` (winston).

## Chú thích tính năng

Mỗi file bắt đầu bằng khối comment có dòng `@feature`:

```js
/**
 * @feature [F05] Giỏ hàng - Thêm sản phẩm vào giỏ.
 */
```

Trong file, các đoạn logic quan trọng có comment giải thích **vì sao** làm như vậy, ví dụ:
`// [F06] Trừ tồn kho trong transaction để không bán vượt số lượng`.

## Đặt tên

| Đối tượng         | Quy ước                 | Ví dụ                       |
| ----------------- | ----------------------- | --------------------------- |
| Biến, hàm         | camelCase               | `getProductById`            |
| Component React   | PascalCase, file `.jsx` | `ProductCard.jsx`           |
| File backend      | `<tên>.<lớp>.js`        | `product.service.js`        |
| Model Prisma      | PascalCase số ít        | `Product`, `OrderItem`      |
| Bảng/cột trong DB | snake_case qua `@map`   | `order_items`, `created_at` |
| Hằng số           | UPPER_SNAKE_CASE        | `MAX_PAGE_SIZE`             |

## Kiến trúc backend

```
route  →  controller  →  service  →  Prisma (truy cập DB)
```

- **route**: khai báo đường dẫn, gắn middleware (xác thực, validate).
- **controller**: nhận request, gọi service, trả response. Không chứa nghiệp vụ.
- **service**: chứa nghiệp vụ và truy vấn Prisma. Lỗi nghiệp vụ ném `AppError`.
- Dữ liệu gửi lên luôn được validate bằng Zod trước khi vào service.

## Định dạng response API

- Thành công: dữ liệu JSON, danh sách có phân trang dạng `{ items, page, pageSize, total }`.
- Lỗi: `{ "error": { "code": "...", "message": "...", "details": {} } }`.

## Git

- Nhánh: `main` luôn chạy được; mỗi tính năng làm trên nhánh `feature/Fxx-ten-ngan` rồi mở Pull Request.
- Commit message: `feat(F03): ...`, `fix(F05): ...`, `test(F06): ...`, `docs: ...`, `chore: ...`.
- Không commit file `.env`, chỉ commit `.env.example`.
