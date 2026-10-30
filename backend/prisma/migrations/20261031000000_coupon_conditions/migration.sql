-- [F09] Điều kiện phụ của mã giảm giá: điểm thành viên tối thiểu và phạm vi áp dụng (sản phẩm, danh mục, thương hiệu)

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN "min_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "coupons" ADD COLUMN "product_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "coupons" ADD COLUMN "category_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "coupons" ADD COLUMN "brand_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Ràng buộc ở tầng CSDL: điểm không âm; mỗi danh sách phạm vi tối đa 50 phần tử (chặn mảng khổng lồ)
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_min_points_non_negative" CHECK ("min_points" >= 0);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_scope_size" CHECK (
  cardinality("product_ids") <= 50 AND cardinality("category_ids") <= 50 AND cardinality("brand_ids") <= 50
);
