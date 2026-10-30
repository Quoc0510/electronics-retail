/**
 * @feature [F00] Nền tảng - Gom toàn bộ route của API tại một chỗ.
 * Mỗi tính năng mới (F03 products...) sẽ đăng ký thêm route ở đây.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js'; // [F01]
import userRoutes from './user.routes.js'; // [F01]
import adminRoutes from './admin.routes.js'; // [F01]
import { publicCatalogRouter } from './catalog.routes.js'; // [F02]
import storefrontRoutes from './storefront.routes.js'; // [F04]
import cartRoutes from './cart.routes.js'; // [F05]
import orderRoutes from './order.routes.js'; // [F06]
import reviewRoutes from './review.routes.js'; // [F08]
import wishlistRoutes from './wishlist.routes.js'; // [F08]
import couponRoutes from './coupon.routes.js'; // [F09]

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use(publicCatalogRouter); // [F02] GET /api/categories, /api/brands
router.use('/products', storefrontRoutes); // [F04] GET /api/products, /api/products/:slug
router.use('/products', reviewRoutes); // [F08] /api/products/:slug/reviews
router.use('/cart', cartRoutes); // [F05] giỏ hàng (cần đăng nhập)
router.use('/orders', orderRoutes); // [F06] đặt hàng và xem đơn của mình (cần đăng nhập)
router.use('/wishlist', wishlistRoutes); // [F08] danh sách yêu thích (cần đăng nhập)
router.use('/coupons', couponRoutes); // [F09] xem trước mã giảm giá (công khai, có giới hạn tốc độ)

export default router;
