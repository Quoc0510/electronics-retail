# Danh sách tính năng và kế hoạch

Mỗi file code có header `@feature [Fxx] ...` để truy vết file → tính năng. Tìm nhanh bằng:
`grep -r "@feature \[F05\]" backend client admin`

## Danh mục tính năng

| Mã  | Tính năng                                                 | Mức ưu tiên                      | Trạng thái       |
| --- | --------------------------------------------------------- | -------------------------------- | ---------------- |
| F00 | Nền tảng (setup, CI)                                      | Bắt buộc                         | Xong             |
| F01 | Xác thực và phân quyền                                    | Bắt buộc                         | Xong             |
| F02 | Danh mục và thương hiệu                                   | Bắt buộc                         | Xong             |
| F03 | Sản phẩm (CRUD, ảnh)                                      | Bắt buộc                         | Xong             |
| F04 | Duyệt và tìm sản phẩm (gồm thiết kế lại giao diện)        | Bắt buộc                         | Xong             |
| F05 | Giỏ hàng (gồm giỏ cho khách chưa đăng nhập)               | Bắt buộc                         | Xong             |
| F06 | Đặt hàng (COD)                                            | Bắt buộc                         | Xong             |
| F07 | Quản lý đơn hàng                                          | Bắt buộc                         | Xong             |
| F08 | Đánh giá và yêu thích                                     | Nên làm (cắt nếu trễ)            | Xong             |
| F09 | Khuyến mãi / mã giảm giá                                  | Nên làm (cắt nếu trễ)            | Xong (chờ merge) |
| F10 | Dashboard và báo cáo, quản lý người dùng                  | Bắt buộc                         | Xong             |
| F11 | Mở rộng (VNPay/ZaloPay sandbox, email)                    | Chỉ làm nếu dư thời gian         | Chưa làm         |
| F12 | Trải nghiệm mở rộng: chế độ tối, so sánh, trang thông tin | Có thể làm thêm                  | Xong             |
| F13 | Đặt hàng không cần đăng nhập và điểm thành viên           | Bắt buộc (yêu cầu bổ sung 28/10) | Xong             |

F12 (đợt 1) gồm: chế độ tối, so sánh sản phẩm, trang thông tin (Giới thiệu, Liên hệ, Hỏi đáp, Chính sách), các khối trang chủ mới (thương hiệu, banner, số liệu, sản phẩm đã xem). Đợt 2 (cần backend, làm sau F05-F07): form liên hệ lưu tin nhắn, đăng ký nhận tin, yêu thích và đánh giá (F08), tin tức.

F10: trang tổng quan Admin có doanh thu 30 ngày (biểu đồ cột), số đơn theo trạng thái, 5 sản phẩm bán chạy, sản phẩm sắp hết hàng; trang Người dùng có tìm theo email, lọc, khóa và mở khóa tài khoản. Chưa có chọn khoảng ngày, xuất báo cáo, đổi vai trò (xem TECH_DEBT.md).

F08: khách đã nhận hàng (đơn hoàn thành) đánh giá 1-5 sao kèm bình luận, sửa được đánh giá của mình, điểm trung bình hiện trên thẻ và trang chi tiết; thành viên lưu sản phẩm yêu thích (tối đa 100) và xem ở trang /yeu-thich; Admin ẩn hoặc bỏ ẩn đánh giá vi phạm ở trang Đánh giá. Chưa có xóa đánh giá, ảnh trong đánh giá, trả lời của cửa hàng (xem TECH_DEBT.md).

F09: Admin tạo, sửa, bật/tắt mã giảm giá (giảm theo % hoặc số tiền, đơn tối thiểu, thời hạn, số lượt tối đa) ở trang Mã giảm giá; khách và thành viên nhập mã ở trang đặt hàng, thấy ngay số tiền giảm, mỗi đơn một mã. Phí vận chuyển và điểm thành viên tính trên tiền hàng sau giảm; hủy đơn trả lại lượt dùng mã. Chưa có mã riêng cho từng người, giới hạn mỗi người một lần hay mức giảm tối đa cho mã phần trăm (xem TECH_DEBT.md).

F13 (yêu cầu bổ sung 28/10 sau khi dùng thử): khách chưa đăng nhập vẫn đặt hàng được, tra cứu và hủy đơn bằng mã đơn + số điện thoại; thành viên được tích điểm khi đơn hoàn thành (điểm tính theo tổng tiền hàng đã mua, mỗi 1.000.000 đ được 1 điểm, phần lẻ cộng dồn). Chưa có đổi điểm lấy ưu đãi.

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
