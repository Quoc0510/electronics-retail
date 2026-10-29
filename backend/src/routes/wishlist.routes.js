/**
 * @feature [F08] Yêu thích - Route /api/wishlist, mọi route yêu cầu đăng nhập (US-22).
 *  - GET    /          : danh sách yêu thích (chỉ sản phẩm còn hiển thị)
 *  - PUT    /:id       : thêm sản phẩm có id này (idempotent)
 *  - DELETE /:id       : bỏ sản phẩm có id này (idempotent)
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as wishlistController from '../controllers/wishlist.controller.js';
import { idParamSchema } from '../validators/common.validator.js';

const router = Router();

router.use(authenticate);

router.get('/', wishlistController.list);
router.put('/:id', validate(idParamSchema, 'params'), wishlistController.add);
router.delete('/:id', validate(idParamSchema, 'params'), wishlistController.remove);

export default router;
