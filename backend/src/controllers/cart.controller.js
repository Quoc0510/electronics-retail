/**
 * @feature [F05] Giỏ hàng - Controller API giỏ hàng. Mọi thao tác chỉ tác động lên giỏ của chính người dùng đăng nhập
 * (req.user do middleware authenticate gắn vào) và đều trả về toàn bộ giỏ đã tính lại.
 */
import * as cartService from '../services/cart.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getCart = asyncHandler(async (req, res) => {
  res.json(await cartService.getCart(req.user.id));
});

export const addItem = asyncHandler(async (req, res) => {
  res.json(await cartService.addItem(req.user.id, req.validated.body));
});

export const updateItem = asyncHandler(async (req, res) => {
  res.json(await cartService.updateItem(req.user.id, req.validated.params.id, req.validated.body));
});

export const removeItem = asyncHandler(async (req, res) => {
  res.json(await cartService.removeItem(req.user.id, req.validated.params.id));
});
