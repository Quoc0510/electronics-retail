/**
 * @feature [F16] Cài đặt cửa hàng - Controller: Admin xem và đổi ngưỡng miễn phí vận chuyển.
 */
import * as settingsService from '../services/settings.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getShipping = asyncHandler(async (_req, res) => {
  res.json(await settingsService.getShippingSettings());
});

export const updateShipping = asyncHandler(async (req, res) => {
  res.json(await settingsService.updateShippingSettings(req.validated.body));
});
