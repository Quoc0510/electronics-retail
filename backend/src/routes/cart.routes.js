/**
 * @feature [F05] Giỏ hàng - Route /api/cart (BR-11: giỏ hàng yêu cầu đăng nhập).
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as cartController from '../controllers/cart.controller.js';
import { addItemSchema, updateItemSchema } from '../validators/cart.validator.js';
import { idParamSchema } from '../validators/common.validator.js';

const router = Router();

// Mọi route bên dưới đều yêu cầu đăng nhập
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', validate(addItemSchema), cartController.addItem);
router.patch(
  '/items/:id',
  validate(idParamSchema, 'params'),
  validate(updateItemSchema),
  cartController.updateItem,
);
router.delete('/items/:id', validate(idParamSchema, 'params'), cartController.removeItem);

export default router;
