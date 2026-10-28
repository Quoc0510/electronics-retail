/**
 * @feature [F07] Quản lý đơn hàng - Route quản trị /api/admin/orders/*
 * Được gắn vào router /api/admin nên đã có sẵn kiểm tra quyền ADMIN (xem admin.routes.js).
 */
import { Router } from 'express';
import * as adminOrderController from '../controllers/adminOrder.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  listAdminOrdersQuerySchema,
  orderCodeParamSchema,
  updateOrderStatusSchema,
} from '../validators/order.validator.js';

const router = Router();

router.get('/', validate(listAdminOrdersQuerySchema, 'query'), adminOrderController.list);
router.get('/:code', validate(orderCodeParamSchema, 'params'), adminOrderController.getOne);
router.patch(
  '/:code/status',
  validate(orderCodeParamSchema, 'params'),
  validate(updateOrderStatusSchema),
  adminOrderController.updateStatus,
);

export default router;
