/**
 * @feature [F00] Nền tảng - Gom toàn bộ route của API tại một chỗ.
 * Mỗi tính năng mới (F01 auth, F03 products...) sẽ đăng ký thêm route ở đây.
 */
import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

export default router;
