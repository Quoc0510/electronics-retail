/**
 * @feature [F09] Mã giảm giá - Route /api/admin/coupons (US-24). Đã nằm sau authenticate + requireRole('ADMIN') của admin.routes.js.
 * Không có xóa: mã đã gắn vào đơn hàng chỉ được tắt (isActive = false), như BR-09.
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import * as couponController from '../controllers/coupon.controller.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createCouponSchema,
  listCouponsQuerySchema,
  updateCouponSchema,
} from '../validators/coupon.validator.js';

const router = Router();

router.get('/', validate(listCouponsQuerySchema, 'query'), couponController.list);
router.post('/', validate(createCouponSchema), couponController.create);
router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateCouponSchema),
  couponController.update,
);

export default router;
