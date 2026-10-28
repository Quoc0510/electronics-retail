# Từ điển dữ liệu

Phục vụ rubric TC2.1. Nguồn sự thật là [schema.prisma](../backend/prisma/schema.prisma); tên cột dưới đây là tên trong PostgreSQL. Mọi bảng đều có `id` (khóa chính, tự tăng), hầu hết có `created_at`, `updated_at`. Tiền tệ là số nguyên VND (BR-01).

## Kiểu liệt kê (enum)

| Enum             | Giá trị                                            | Ý nghĩa                                |
| ---------------- | -------------------------------------------------- | -------------------------------------- |
| `role`           | CUSTOMER, ADMIN                                    | Vai trò người dùng                     |
| `order_status`   | PENDING, CONFIRMED, SHIPPING, COMPLETED, CANCELLED | Trạng thái đơn hàng (BR-06)            |
| `payment_method` | COD                                                | Phương thức thanh toán (sẽ thêm ở F11) |
| `payment_status` | UNPAID, PAID                                       | Trạng thái thanh toán (BR-08)          |

## users - Người dùng (F01)

| Cột           | Kiểu    | Ràng buộc          | Mô tả                                          |
| ------------- | ------- | ------------------ | ---------------------------------------------- |
| email         | text    | duy nhất, bắt buộc | Email đăng nhập                                |
| password_hash | text    | bắt buộc           | Mật khẩu đã băm bcrypt, không lưu mật khẩu gốc |
| full_name     | text    | bắt buộc           | Họ tên                                         |
| phone         | text    | tùy chọn           | Số điện thoại                                  |
| role          | role    | mặc định CUSTOMER  | Vai trò                                        |
| is_active     | boolean | mặc định true      | false = tài khoản bị khóa                      |
| points        | int     | >= 0, mặc định 0   | Điểm thành viên (BR-15, F13)                   |

## refresh_tokens - Phiên đăng nhập (F01)

| Cột        | Kiểu      | Ràng buộc               | Mô tả                     |
| ---------- | --------- | ----------------------- | ------------------------- |
| user_id    | int       | FK users, xóa theo user | Chủ sở hữu                |
| token_hash | text      | duy nhất                | Bản băm của refresh token |
| expires_at | timestamp | bắt buộc                | Thời điểm hết hạn         |
| revoked_at | timestamp | tùy chọn                | Có giá trị = đã thu hồi   |

## addresses - Sổ địa chỉ (F01)

| Cột                    | Kiểu    | Ràng buộc               | Mô tả                                                                                                       |
| ---------------------- | ------- | ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| user_id                | int     | FK users, xóa theo user | Chủ sở hữu                                                                                                  |
| recipient_name, phone  | text    | bắt buộc                | Người nhận, số điện thoại                                                                                   |
| province, ward, street | text    | bắt buộc                | Địa chỉ chi tiết                                                                                            |
| district               | text    | tùy chọn (null)         | Quận/huyện, không bắt buộc vì nhiều địa phương đã bỏ cấp này (migration `20261028010000_district_optional`) |
| is_default             | boolean | mặc định false          | Địa chỉ mặc định                                                                                            |

## categories, brands - Danh mục, thương hiệu (F02)

| Cột                                                     | Kiểu    | Ràng buộc     | Mô tả                             |
| ------------------------------------------------------- | ------- | ------------- | --------------------------------- |
| name                                                    | text    | duy nhất      | Tên hiển thị                      |
| slug                                                    | text    | duy nhất      | Chuỗi dùng trong URL, sinh từ tên |
| description, image_url (categories) / logo_url (brands) | text    | tùy chọn      | Mô tả, ảnh/logo                   |
| is_active                                               | boolean | mặc định true | false = ẩn (BR-09)                |

## products - Sản phẩm (F03)

| Cột         | Kiểu    | Ràng buộc                 | Mô tả                                |
| ----------- | ------- | ------------------------- | ------------------------------------ |
| sku         | text    | duy nhất                  | Mã sản phẩm                          |
| name, slug  | text    | slug duy nhất             | Tên và chuỗi URL                     |
| description | text    | mặc định rỗng             | Mô tả                                |
| price       | int     | > 0                       | Giá gốc (VND)                        |
| sale_price  | int     | tùy chọn; 0 < giá < price | Giá khuyến mãi (BR-02)               |
| stock       | int     | >= 0                      | Tồn kho (BR-03)                      |
| specs       | jsonb   | mặc định `{}`             | Thông số kỹ thuật dạng tên - giá trị |
| is_active   | boolean | mặc định true             | false = ẩn                           |
| category_id | int     | FK categories             | Danh mục                             |
| brand_id    | int     | FK brands                 | Thương hiệu                          |

## product_images - Ảnh sản phẩm (F03)

| Cột        | Kiểu | Ràng buộc                | Mô tả                            |
| ---------- | ---- | ------------------------ | -------------------------------- |
| product_id | int  | FK products, xóa theo SP | Sản phẩm                         |
| url        | text | bắt buộc                 | Đường dẫn ảnh                    |
| sort_order | int  | mặc định 0               | Thứ tự; nhỏ nhất là ảnh đại diện |

## carts, cart_items - Giỏ hàng (F05)

| Bảng       | Cột                 | Kiểu | Ràng buộc             | Mô tả                          |
| ---------- | ------------------- | ---- | --------------------- | ------------------------------ |
| carts      | user_id             | int  | duy nhất, FK users    | Mỗi người dùng một giỏ (BR-11) |
| cart_items | cart_id, product_id | int  | duy nhất theo cặp; FK | Một dòng cho mỗi sản phẩm      |
| cart_items | quantity            | int  | >= 1                  | Số lượng                       |

## orders - Đơn hàng (F06, F07, F13)

| Cột                                     | Kiểu         | Ràng buộc          | Mô tả                                                                                       |
| --------------------------------------- | ------------ | ------------------ | ------------------------------------------------------------------------------------------- |
| code                                    | text         | duy nhất           | Mã đơn `TSyymmdd-xxxx` (BR-12)                                                              |
| user_id                                 | int          | tùy chọn, FK users | Người đặt; rỗng = đơn của khách không đăng nhập (F13, BR-11)                                |
| status                                  | order_status | mặc định PENDING   | Trạng thái                                                                                  |
| payment_method, payment_status          | enum         | COD, UNPAID        | Thanh toán                                                                                  |
| subtotal, shipping_fee, total           | int          | >= 0               | Tiền hàng, phí vận chuyển (BR-05), tổng (VND)                                               |
| recipient_name, phone, shipping_address | text         | bắt buộc           | Bản sao thông tin giao hàng (BR-04)                                                         |
| note, cancel_reason                     | text         | tùy chọn           | Ghi chú của khách, lý do hủy                                                                |
| points_earned                           | int          | >= 0, mặc định 0   | Điểm đã cộng cho thành viên khi đơn hoàn thành (BR-15)                                      |
| idempotency_key                         | text         | duy nhất, tùy chọn | Mã do trình duyệt sinh cho mỗi lần đặt của khách không đăng nhập, chống tạo đơn trùng (F13) |

## order_items - Dòng đơn hàng (F06, F07)

| Cột                                   | Kiểu     | Ràng buộc   | Mô tả                             |
| ------------------------------------- | -------- | ----------- | --------------------------------- |
| order_id                              | int      | FK orders   | Đơn hàng                          |
| product_id                            | int      | FK products | Sản phẩm gốc (để thống kê)        |
| product_name, product_sku, unit_price | text/int | bắt buộc    | Bản sao tại thời điểm đặt (BR-04) |
| quantity                              | int      | >= 1        | Số lượng                          |

## order_status_history - Lịch sử trạng thái (F07)

| Cột           | Kiểu         | Ràng buộc          | Mô tả                      |
| ------------- | ------------ | ------------------ | -------------------------- |
| order_id      | int          | FK orders          | Đơn hàng                   |
| status        | order_status | bắt buộc           | Trạng thái được chuyển tới |
| note          | text         | tùy chọn           | Ghi chú                    |
| changed_by_id | int          | tùy chọn, FK users | Người thực hiện            |
