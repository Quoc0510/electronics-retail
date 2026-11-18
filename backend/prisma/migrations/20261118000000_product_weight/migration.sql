-- @feature [F16] Phí vận chuyển Giao Hàng Nhanh - cân nặng sản phẩm (gram, gồm bao bì).
-- GHN bắt buộc có cân nặng và giới hạn tối đa 50.000 g cho một đơn, nên mỗi sản phẩm phải nằm trong khoảng 1..50.000.
-- Sản phẩm có sẵn nhận mặc định 500 g; Admin chỉnh lại từng sản phẩm ở trang Sản phẩm.
ALTER TABLE "products" ADD COLUMN "weight_grams" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "products" ADD CONSTRAINT "products_weight_grams_check" CHECK ("weight_grams" BETWEEN 1 AND 50000);
