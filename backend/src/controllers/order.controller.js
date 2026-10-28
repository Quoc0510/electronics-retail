/**
 * @feature [F06] Đặt hàng - Controller API đơn hàng của khách. Mọi thao tác chỉ tác động lên đơn của chính người đăng nhập.
 */
import * as orderService from '../services/order.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await orderService.createOrder(req.user.id, req.validated.body));
});

export const getByCode = asyncHandler(async (req, res) => {
  res.json(await orderService.getOrderByCode(req.user.id, req.validated.params.code));
});
