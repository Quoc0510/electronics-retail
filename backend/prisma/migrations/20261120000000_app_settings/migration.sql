-- @feature [F16] Cài đặt cửa hàng - bảng khóa/giá trị để Admin đổi ngưỡng miễn phí vận chuyển mà không phải sửa biến môi trường.
-- Chưa có dòng nào thì hệ thống dùng giá trị mặc định (SHIPPING_FREE_THRESHOLD).
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);
