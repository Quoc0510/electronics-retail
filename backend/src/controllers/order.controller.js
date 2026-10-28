/**
 * @feature [F06][F13] Đặt hàng - Controller API đơn hàng của khách. Thao tác của thành viên chỉ tác động lên đơn của chính họ;
 * khách không đăng nhập (F13) chỉ thao tác được trên đơn mà họ nêu đúng cả mã đơn lẫn số điện thoại.
 */
import * as orderService from '../services/order.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await orderService.createOrder(req.user.id, req.validated.body));
});

export const getByCode = asyncHandler(async (req, res) => {
  res.json(await orderService.getOrderByCode(req.user.id, req.validated.params.code));
});

// [F07] Danh sách đơn của chính mình (mới nhất trước), lọc theo trạng thái
export const listMine = asyncHandler(async (req, res) => {
  res.json(await orderService.listMyOrders(req.user.id, req.validated.query));
});

// [F07] Khách tự hủy đơn khi còn chờ xác nhận
export const cancel = asyncHandler(async (req, res) => {
  res.json(
    await orderService.cancelMyOrder(
      req.user.id,
      req.validated.params.code,
      req.validated.body.reason,
    ),
  );
});

// ----- [F13] Khách không đăng nhập: không có req.user, đơn được nhận diện bằng mã đơn + số điện thoại -----

export const createGuest = asyncHandler(async (req, res) => {
  res.status(201).json(await orderService.createGuestOrder(req.validated.body));
});

export const lookup = asyncHandler(async (req, res) => {
  const { code, phone } = req.validated.body;
  res.json(await orderService.getGuestOrder(code, phone));
});

export const cancelLookup = asyncHandler(async (req, res) => {
  const { code, phone, reason } = req.validated.body;
  res.json(await orderService.cancelGuestOrder(code, phone, reason));
});
