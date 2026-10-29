/**
 * @feature [F04][F08] Quy tắc hiển thị sản phẩm với khách: sản phẩm đang bán VÀ thuộc danh mục, thương hiệu đang hiện
 * (US-06 AC3, US-13 AC3). Dùng chung cho trang chi tiết, đánh giá và yêu thích để ba nơi không lệch nhau.
 */
export const visibleProductWhere = {
  isActive: true,
  category: { isActive: true },
  brand: { isActive: true },
};
