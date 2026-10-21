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

| Ngày       | Tính năng       | Công cụ     | Phạm vi và prompt chính                                                                                                                                     | Phần AI sinh                       | Phần tự sửa / kiểm chứng                                                             | Commit   |
| ---------- | --------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ | -------- |
| 21/10/2026 | F00             | Claude Code | Dựng monorepo backend/client/admin, ESLint, CI, Prisma                                                                                                      | Toàn bộ khung dự án, test mẫu      | _(điền khi review)_                                                                  | _(điền)_ |
| 21/10/2026 | F00-F07         | Claude Code | Giai đoạn 1: SRS, SDD, từ điển dữ liệu, schema Prisma, migration, seed                                                                                      | Toàn bộ tài liệu, schema, seed     | Kiểm tra migration và ràng buộc CHECK trên PostgreSQL thật                           | _(điền)_ |
| 21/10/2026 | F01 (backend)   | Claude Code | API đăng ký, đăng nhập, refresh token, đổi mật khẩu, sổ địa chỉ, middleware phân quyền, 56 test tích hợp                                                    | Toàn bộ code backend F01 và test   | _(điền: tự đọc và giải thích lại từng file, chạy thử bằng tay)_                      | _(điền)_ |
| 21/10/2026 | F01 (giao diện) | Claude Code | Package `shared` (gọi API tự làm mới token, AuthProvider, Button/FormField), trang đăng ký, đăng nhập, tài khoản ở Client, trang đăng nhập Admin, 100+ test | Toàn bộ code giao diện F01 và test | Chạy thử thật trên trình duyệt: đăng ký, tải lại giữ phiên, admin từ chối khách hàng | _(điền)_ |

## Lỗi / ảo giác của AI đã phát hiện và sửa

Cần ≥ 5 mục kèm phân tích nguyên nhân và commit sửa (mức xuất sắc).

| #   | Ngày       | Mô tả lỗi                                                                                             | Nguyên nhân                                                                                                                                                                                     | Cách sửa / commit                                                             |
| --- | ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | 21/10/2026 | `eslint@10` xung đột với `eslint-plugin-react` (chưa hỗ trợ ESLint 10)                                | AI chọn phiên bản mới nhất mà không kiểm tra peer dependency                                                                                                                                    | Hạ xuống ESLint 9                                                             |
| 2   | 21/10/2026 | Dùng `err.flatten()` của Zod, đã deprecated ở Zod 4; comment ghi Express 4 trong khi đã cài Express 5 | Kiến thức của AI theo phiên bản cũ                                                                                                                                                              | Đổi sang `flattenError`, sửa comment                                          |
| 3   | 21/10/2026 | Seed báo `Cannot read properties of undefined (reading upsert)`                                       | Prisma Client được sinh khi schema còn trống, AI không nhắc chạy lại `prisma generate` sau khi thêm model                                                                                       | Chạy `prisma generate`; ghi vào README                                        |
| 4   | 21/10/2026 | Container PostgreSQL không chạy, rồi kết nối nhầm vào DB khác                                         | AI giả định cổng 5432 và 5433 còn trống, thực tế máy có PostgreSQL khác dùng hai cổng này                                                                                                       | Đổi cổng host sang 54320 trong docker-compose và .env                         |
| 5   | 21/10/2026 | Đổi mật khẩu xong, thông báo "đổi thành công" ở trang đăng nhập không hiện                            | AI để `PasswordForm` tự chuyển trang sau `logout()`, nhưng `ProtectedRoute` đã chuyển về trang đăng nhập trước và ghi đè thông báo (xung đột hai nơi cùng điều hướng). Test giao diện phát hiện | Đưa thông báo vào AuthContext (`logout(message)`), bỏ điều hướng thủ công     |
| 6   | 21/10/2026 | Lệnh shell AI viết để sửa `docs/SDD.md` làm mất nội dung nằm trong dấu backtick (`) ở mục API         | Dấu backtick trong chuỗi shell bị hiểu là chạy lệnh nên bị xóa mất                                                                                                                              | Sửa lại bằng công cụ Edit; về sau không dùng shell để sửa văn bản có markdown |
| 7   | 21/10/2026 | Test `đăng nhập thành công` đôi lúc thất bại vì kiểm tra tiêu đề trang chủ ngay lập tức               | AI viết kiểm tra đồng bộ trong khi việc chuyển trang xảy ra bất đồng bộ sau khi có user                                                                                                         | Đổi sang `findByRole` (chờ phần tử xuất hiện)                                 |
