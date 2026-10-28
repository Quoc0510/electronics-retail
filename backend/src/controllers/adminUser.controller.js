/**
 * @feature [F10] Quản lý người dùng - Controller API quản trị người dùng và thống kê (chỉ ADMIN, xem admin.routes.js).
 */
import * as adminUserService from '../services/adminUser.service.js';
import * as statsService from '../services/stats.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await adminUserService.listUsers(req.validated.query));
});

export const updateStatus = asyncHandler(async (req, res) => {
  res.json(
    await adminUserService.setUserActive(
      req.user.id,
      req.validated.params.id,
      req.validated.body.isActive,
    ),
  );
});

export const dashboard = asyncHandler(async (_req, res) => {
  res.json(await statsService.getDashboardStats());
});
