/**
 * @feature [F01] Phân quyền - Route /api/admin/* chỉ dành cho quản trị viên (US-05 AC1).
 * authenticate + requireRole đặt ở đầu router nên MỌI route admin thêm sau này đều tự được bảo vệ,
 * không thể quên gắn quyền ở từng route.
 */
import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { adminCatalogRouter } from './catalog.routes.js'; // [F02]
import productRoutes from './product.routes.js'; // [F03]
import adminOrderRoutes from './adminOrder.routes.js'; // [F07]
import { adminUserRouter, statsRouter } from './adminUser.routes.js'; // [F10]
import adminReviewRoutes from './adminReview.routes.js'; // [F08]
import adminCouponRoutes from './adminCoupon.routes.js'; // [F09]

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

// Endpoint để trang Admin kiểm tra tài khoản đang đăng nhập có quyền quản trị hay không (US-05 AC2)
router.get('/me', (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

// [F02] Quản lý danh mục và thương hiệu: /api/admin/categories, /api/admin/brands
router.use(adminCatalogRouter);

// [F03] Quản lý sản phẩm và ảnh: /api/admin/products
router.use('/products', productRoutes);

// [F07] Quản lý đơn hàng: /api/admin/orders
router.use('/orders', adminOrderRoutes);

// [F10] Thống kê dashboard và quản lý người dùng: /api/admin/stats, /api/admin/users
router.use('/stats', statsRouter);
router.use('/users', adminUserRouter);

// [F08] Quản lý đánh giá (ẩn/bỏ ẩn): /api/admin/reviews
router.use('/reviews', adminReviewRoutes);

// [F09] Quản lý mã giảm giá: /api/admin/coupons
router.use('/coupons', adminCouponRoutes);

export default router;
