-- [F09] Mã giảm giá tự động áp dụng ở bước thanh toán (Admin bật cho từng mã)

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN "auto_apply" BOOLEAN NOT NULL DEFAULT false;

-- Chỉ mục cho truy vấn "mã đang bật và tự động áp dụng" mỗi lần khách vào trang thanh toán
CREATE INDEX "coupons_auto_apply_is_active_idx" ON "coupons"("auto_apply", "is_active");
