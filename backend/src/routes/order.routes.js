/**
 * @feature [F06] Đặt hàng - Route /api/orders (cần đăng nhập). Danh sách đơn, hủy đơn và quản lý của Admin làm ở F07.
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as orderController from '../controllers/order.controller.js';
import { createOrderSchema, orderCodeParamSchema } from '../validators/order.validator.js';

const router = Router();

// Mọi route bên dưới đều yêu cầu đăng nhập
router.use(authenticate);

router.post('/', validate(createOrderSchema), orderController.create);
router.get('/:code', validate(orderCodeParamSchema, 'params'), orderController.getByCode);

export default router;
