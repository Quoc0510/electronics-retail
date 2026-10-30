-- [F09] Mã giảm giá (US-24, US-25, BR-14): bảng coupons và 3 cột của đơn hàng (số tiền giảm, mã đã dùng)

-- CreateEnum
CREATE TYPE "coupon_type" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "coupon_type" NOT NULL,
    "value" INTEGER NOT NULL,
    "min_order" INTEGER NOT NULL DEFAULT 0,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "max_uses" INTEGER NOT NULL,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_is_active_ends_at_idx" ON "coupons"("is_active", "ends_at");

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "discount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "coupon_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN "coupon_code" TEXT;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ràng buộc ở tầng CSDL (chốt chặn cuối khi code có lỗi): mã luôn in hoa; phần trăm 1-100; số tiền giảm dương;
-- thời hạn hợp lệ; số lượt dùng không âm và không vượt tối đa (nên cũng chặn việc dùng quá lượt khi hai đơn cùng lúc)
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_code_uppercase" CHECK ("code" = upper("code") AND length("code") BETWEEN 3 AND 30);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_value_range" CHECK ("value" > 0 AND ("type" <> 'PERCENT' OR "value" <= 100));
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_min_order_non_negative" CHECK ("min_order" >= 0);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_period_valid" CHECK ("ends_at" > "starts_at");
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_uses_valid" CHECK ("max_uses" >= 1 AND "used_count" >= 0 AND "used_count" <= "max_uses");

-- Số tiền giảm không âm và không vượt tiền hàng (US-25 AC3: tổng tiền sau giảm không âm)
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_valid" CHECK ("discount" >= 0 AND "discount" <= "subtotal");
