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

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use(publicCatalogRouter); // [F02] GET /api/categories, /api/brands
router.use('/products', storefrontRoutes); // [F04] GET /api/products, /api/products/:slug
router.use('/cart', cartRoutes); // [F05] giỏ hàng (cần đăng nhập)

export default router;
