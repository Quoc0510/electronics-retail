/**
 * @feature [F10] Dashboard và quản lý người dùng - Route quản trị /api/admin/stats và /api/admin/users/*
 * Được gắn vào router /api/admin nên đã có sẵn kiểm tra quyền ADMIN (xem admin.routes.js).
 */
import { Router } from 'express';
import * as adminUserController from '../controllers/adminUser.controller.js';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  listAdminUsersQuerySchema,
  updateUserStatusSchema,
} from '../validators/adminUser.validator.js';

export const statsRouter = Router();
statsRouter.get('/', adminUserController.dashboard);

export const adminUserRouter = Router();
adminUserRouter.get('/', validate(listAdminUsersQuerySchema, 'query'), adminUserController.list);
adminUserRouter.patch(
  '/:id/status',
  validate(idParamSchema, 'params'),
  validate(updateUserStatusSchema),
  adminUserController.updateStatus,
);
