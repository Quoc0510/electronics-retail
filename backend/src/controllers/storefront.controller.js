/**
 * @feature [F04] Duyệt và tìm sản phẩm - Controller API công khai (không cần đăng nhập).
 */
import * as storefrontService from '../services/storefront.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await storefrontService.listProducts(req.validated.query));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await storefrontService.getProductBySlug(req.validated.params.slug));
});
