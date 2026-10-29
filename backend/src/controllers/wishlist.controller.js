/**
 * @feature [F08] Yêu thích - Controller API danh sách yêu thích của thành viên (US-22).
 */
import * as wishlistService from '../services/wishlist.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await wishlistService.listWishlist(req.user.id));
});

export const add = asyncHandler(async (req, res) => {
  res.json(await wishlistService.addToWishlist(req.user.id, req.validated.params.id));
});

export const remove = asyncHandler(async (req, res) => {
  await wishlistService.removeFromWishlist(req.user.id, req.validated.params.id);
  res.status(204).end();
});
