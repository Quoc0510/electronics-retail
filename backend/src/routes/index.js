/**
 * @feature [F00] Nền tảng - Gom toàn bộ route của API tại một chỗ.
 * Mỗi tính năng mới (F03 products...) sẽ đăng ký thêm route ở đây.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js'; // [F01]
import userRoutes from './user.routes.js'; // [F01]
import adminRoutes from './admin.routes.js'; // [F01]

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

export default router;
