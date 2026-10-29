-- [F13] BR-15 đổi cách tính điểm: điểm thành viên tính theo TỔNG tiền hàng của mọi đơn đã hoàn thành,
-- mỗi 1.000.000 đ được 1 điểm (trước đây mỗi đơn tính riêng, mỗi 10.000 đ được 1 điểm).

-- Tổng tiền hàng đã mua (không tính phí vận chuyển) của các đơn COMPLETED; điểm = floor(total_spent / 1.000.000)
ALTER TABLE "users" ADD COLUMN "total_spent" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD CONSTRAINT "users_total_spent_non_negative" CHECK ("total_spent" >= 0);

-- Tính lại cho dữ liệu hiện có. Các đơn của từng thành viên được xếp theo thời điểm hoàn thành; điểm của một đơn là phần
-- điểm tăng thêm sau khi cộng đơn đó vào tổng (đúng như lúc Admin bấm hoàn thành theo quy tắc mới).
WITH completed AS (
    SELECT
        o.id,
        o.user_id,
        o.subtotal,
        SUM(o.subtotal) OVER (
            PARTITION BY o.user_id
            ORDER BY COALESCE(h.created_at, o.updated_at), o.id
        ) AS running_total
    FROM "orders" o
    LEFT JOIN "order_status_history" h ON h.order_id = o.id AND h.status = 'COMPLETED'
    WHERE o.status = 'COMPLETED' AND o.user_id IS NOT NULL
)
UPDATE "orders" o
SET "points_earned" = (c.running_total / 1000000) - ((c.running_total - c.subtotal) / 1000000)
FROM completed c
WHERE o.id = c.id;

-- Đơn không phải của thành viên đã hoàn thành (đang xử lý, đã hủy, của khách vãng lai) không có điểm đã cộng
UPDATE "orders" SET "points_earned" = 0 WHERE NOT ("status" = 'COMPLETED' AND "user_id" IS NOT NULL);

UPDATE "users" u
SET "total_spent" = s.spent,
    "points" = s.spent / 1000000
FROM (
    SELECT user_id, SUM(subtotal)::integer AS spent
    FROM "orders"
    WHERE status = 'COMPLETED' AND user_id IS NOT NULL
    GROUP BY user_id
) s
WHERE u.id = s.user_id;

-- Thành viên chưa có đơn hoàn thành nào thì không có điểm
UPDATE "users" SET "points" = 0
WHERE "id" NOT IN (SELECT user_id FROM "orders" WHERE status = 'COMPLETED' AND user_id IS NOT NULL);
