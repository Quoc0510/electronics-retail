/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Controller: danh mục địa chỉ và ước tính phí (US-37).
 */
import * as shippingService from '../services/shipping.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const config = asyncHandler(async (_req, res) => {
  res.json(await shippingService.getShippingConfig());
});

export const provinces = asyncHandler(async (_req, res) => {
  res.json({ items: await shippingService.listProvinces() });
});

export const wards = asyncHandler(async (req, res) => {
  res.json({ items: await shippingService.listWards(req.validated.params.provinceId) });
});

export const quote = asyncHandler(async (req, res) => {
  const { items, ...address } = req.validated.body;
  res.json(await shippingService.quoteForItems(address, items));
});
