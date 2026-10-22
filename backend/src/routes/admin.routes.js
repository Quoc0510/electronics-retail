/**
 * @feature [F01] Phân quyền - Route /api/admin/* chỉ dành cho quản trị viên (US-05 AC1).
 * authenticate + requireRole đặt ở đầu router nên MỌI route admin thêm sau này đều tự được bảo vệ,
 * không thể quên gắn quyền ở từng route.
 */
import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN'));

// Endpoint để trang Admin kiểm tra tài khoản đang đăng nhập có quyền quản trị hay không (US-05 AC2)
router.get('/me', (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

export default router;
