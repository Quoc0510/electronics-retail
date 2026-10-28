# Danh sách tính năng và kế hoạch

Mỗi file code có header `@feature [Fxx] ...` để truy vết file → tính năng. Tìm nhanh bằng:
`grep -r "@feature \[F05\]" backend client admin`

## Danh mục tính năng

| Mã  | Tính năng                                                 | Mức ưu tiên              | Trạng thái       |
| --- | --------------------------------------------------------- | ------------------------ | ---------------- |
| F00 | Nền tảng (setup, CI)                                      | Bắt buộc                 | Xong             |
| F01 | Xác thực và phân quyền                                    | Bắt buộc                 | Xong             |
| F02 | Danh mục và thương hiệu                                   | Bắt buộc                 | Xong             |
| F03 | Sản phẩm (CRUD, ảnh)                                      | Bắt buộc                 | Xong             |
| F04 | Duyệt và tìm sản phẩm (gồm thiết kế lại giao diện)        | Bắt buộc                 | Xong             |
| F05 | Giỏ hàng (gồm giỏ cho khách chưa đăng nhập)               | Bắt buộc                 | Xong             |
| F06 | Đặt hàng (COD)                                            | Bắt buộc                 | Xong (chờ merge) |
| F07 | Quản lý đơn hàng                                          | Bắt buộc                 | Chưa làm         |
| F08 | Đánh giá và yêu thích                                     | Nên làm (cắt nếu trễ)    | Chưa làm         |
| F09 | Khuyến mãi / mã giảm giá                                  | Nên làm (cắt nếu trễ)    | Chưa làm         |
| F10 | Dashboard và báo cáo                                      | Bắt buộc                 | Chưa làm         |
| F11 | Mở rộng (VNPay/ZaloPay sandbox, email)                    | Chỉ làm nếu dư thời gian | Chưa làm         |
| F12 | Trải nghiệm mở rộng: chế độ tối, so sánh, trang thông tin | Có thể làm thêm          | Xong             |

F12 (đợt 1) gồm: chế độ tối, so sánh sản phẩm, trang thông tin (Giới thiệu, Liên hệ, Hỏi đáp, Chính sách), các khối trang chủ mới (thương hiệu, banner, số liệu, sản phẩm đã xem). Đợt 2 (cần backend, làm sau F05-F07): form liên hệ lưu tin nhắn, đăng ký nhận tin, yêu thích và đánh giá (F08), tin tức.

## Lịch dự kiến (21/10 → 30/11/2026)

Mốc 50% thời gian là **10/11**: phải chốt bản cam kết sản phẩm và KPI có chữ ký trước mốc này.

| Tuần | Thời gian   | Nội dung                                                            |
| ---- | ----------- | ------------------------------------------------------------------- |
| 1    | 21/10–27/10 | F00 nền tảng, phân tích yêu cầu, thiết kế CSDL (ERD), F01           |
| 2    | 28/10–03/11 | F02, F03, F04                                                       |
| 3    | 04/11–10/11 | F05, F06, F07; **chốt cam kết sản phẩm và KPI (hạn 10/11)**         |
| 4    | 11/11–17/11 | F10, F08, F09; deploy staging, CI/CD đầy đủ                         |
| 5    | 18/11–24/11 | Thực nghiệm người dùng, cải tiến, bổ sung test và coverage, SRS/SDD |
| 6    | 25/11–30/11 | Luận văn, slide, kịch bản demo, dự phòng                            |

## Quy trình làm mỗi tính năng

1. Cập nhật schema Prisma và tạo migration
2. Viết API (route → controller → service) kèm validate và test
3. Viết giao diện Client và/hoặc Admin kèm test
4. Cập nhật `docs/AI_USAGE_LOG.md`, tick trạng thái ở bảng trên
5. Commit theo tính năng, ví dụ `feat(F03): thêm CRUD sản phẩm`
