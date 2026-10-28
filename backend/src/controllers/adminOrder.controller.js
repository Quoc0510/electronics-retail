/**
 * @feature [F07] Quản lý đơn hàng - Controller API quản trị đơn hàng (chỉ ADMIN, xem admin.routes.js).
 */
import * as orderService from '../services/order.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await orderService.adminListOrders(req.validated.query));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await orderService.adminGetOrder(req.validated.params.code));
});

export const updateStatus = asyncHandler(async (req, res) => {
  res.json(
    await orderService.adminUpdateStatus(
      req.user.id,
      req.validated.params.code,
      req.validated.body,
    ),
  );
});
