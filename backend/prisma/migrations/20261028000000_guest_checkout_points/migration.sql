-- [F13] Đặt hàng không cần đăng nhập (BR-11) và điểm thành viên (BR-15)

-- Đơn của khách vãng lai không có người dùng: user_id cho phép NULL (khóa ngoại giữ nguyên ON DELETE RESTRICT)
ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL;

-- Điểm đã cộng cho thành viên khi đơn hoàn thành, và mã chống tạo trùng đơn của khách vãng lai
ALTER TABLE "orders" ADD COLUMN "points_earned" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- Điểm thành viên hiện có
ALTER TABLE "users" ADD COLUMN "points" INTEGER NOT NULL DEFAULT 0;

-- Ràng buộc CHECK (Prisma chưa mô tả được trong schema): điểm không bao giờ âm
ALTER TABLE "users" ADD CONSTRAINT "users_points_non_negative" CHECK ("points" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_points_earned_non_negative" CHECK ("points_earned" >= 0);
