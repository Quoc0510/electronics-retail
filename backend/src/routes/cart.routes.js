/**
 * @feature [F05] Giỏ hàng - Route /api/cart. Giỏ trong tài khoản yêu cầu đăng nhập (BR-11); riêng POST /preview là công khai
 * để khách chưa đăng nhập (giỏ lưu trên trình duyệt) xem giá và tồn kho hiện tại.
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as cartController from '../controllers/cart.controller.js';
import { addItemSchema, guestCartSchema, updateItemSchema } from '../validators/cart.validator.js';
import { idParamSchema } from '../validators/common.validator.js';

const router = Router();

// Công khai: không ghi CSDL, chỉ tính toán từ danh sách khách gửi lên
router.post('/preview', validate(guestCartSchema), cartController.previewCart);

// Mọi route bên dưới đều yêu cầu đăng nhập
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/merge', validate(guestCartSchema), cartController.mergeCart);
router.post('/items', validate(addItemSchema), cartController.addItem);
router.patch(
  '/items/:id',
  validate(idParamSchema, 'params'),
  validate(updateItemSchema),
  cartController.updateItem,
);
router.delete('/items/:id', validate(idParamSchema, 'params'), cartController.removeItem);

export default router;
