/**
 * @feature [F01] Xác thực - Route /api/users/me/* (hồ sơ và sổ địa chỉ của chính người dùng).
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as userController from '../controllers/user.controller.js';
import {
  addressSchema,
  changePasswordSchema,
  idParamSchema,
  updateAddressSchema,
  updateProfileSchema,
} from '../validators/auth.validator.js';

const router = Router();

// Mọi route bên dưới đều yêu cầu đăng nhập
router.use(authenticate);

router.get('/me', userController.getMe);
router.patch('/me', validate(updateProfileSchema), userController.updateMe);
router.put('/me/password', validate(changePasswordSchema), userController.changePassword);

router.get('/me/addresses', userController.listAddresses);
router.post('/me/addresses', validate(addressSchema), userController.createAddress);
router.patch(
  '/me/addresses/:id',
  validate(idParamSchema, 'params'),
  validate(updateAddressSchema),
  userController.updateAddress,
);
router.delete('/me/addresses/:id', validate(idParamSchema, 'params'), userController.deleteAddress);

export default router;
