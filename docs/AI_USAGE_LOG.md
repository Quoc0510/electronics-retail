# Nhật ký sử dụng AI (AI Usage Log)

Phục vụ rubric TC2.3. Ghi **trong cùng ngày** mỗi khi dùng AI sinh code hoặc tài liệu, và đối chiếu được với commit.
Khi bảo vệ, mọi dòng ở đây phải giải thích được.

## Công cụ sử dụng

| Công cụ     | Mục đích                                           |
| ----------- | -------------------------------------------------- |
| Claude Code | Sinh khung dự án, viết code và test theo tính năng |

## Quy trình kiểm soát đầu ra AI (checklist review)

Trước khi commit phần do AI sinh, tự kiểm tra:

- [ ] Đọc hiểu từng dòng, giải thích được vì sao viết như vậy
- [ ] Chạy lint, test và chạy thử thủ công tính năng
- [ ] Đối chiếu API/thư viện với tài liệu chính thức (phiên bản có thể khác AI "nhớ")
- [ ] Không có secret, dữ liệu nhạy cảm trong prompt và trong code
- [ ] Kiểm tra giấy phép của thư viện mới thêm vào
- [ ] Ghi lại vào bảng dưới, kể cả lỗi của AI nếu phát hiện

## Nhật ký

| Ngày       | Tính năng | Công cụ     | Phạm vi và prompt chính                                | Phần AI sinh                  | Phần tự sửa / kiểm chứng | Commit   |
| ---------- | --------- | ----------- | ------------------------------------------------------ | ----------------------------- | ------------------------ | -------- |
| 21/10/2026 | F00       | Claude Code | Dựng monorepo backend/client/admin, ESLint, CI, Prisma | Toàn bộ khung dự án, test mẫu | _(điền khi review)_      | _(điền)_ |

## Lỗi / ảo giác của AI đã phát hiện và sửa

Cần ≥ 5 mục kèm phân tích nguyên nhân và commit sửa (mức xuất sắc).

| #   | Ngày       | Mô tả lỗi                                                                                             | Nguyên nhân                                                  | Cách sửa / commit                    |
| --- | ---------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------ |
| 1   | 21/10/2026 | `eslint@10` xung đột với `eslint-plugin-react` (chưa hỗ trợ ESLint 10)                                | AI chọn phiên bản mới nhất mà không kiểm tra peer dependency | Hạ xuống ESLint 9                    |
| 2   | 21/10/2026 | Dùng `err.flatten()` của Zod, đã deprecated ở Zod 4; comment ghi Express 4 trong khi đã cài Express 5 | Kiến thức của AI theo phiên bản cũ                           | Đổi sang `flattenError`, sửa comment |
