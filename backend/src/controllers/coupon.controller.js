/**
 * @feature [F09] Mã giảm giá - Controller: khách xem trước số tiền giảm (công khai) và Admin quản lý mã (US-24, US-25).
 */
import * as couponService from '../services/coupon.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const preview = asyncHandler(async (req, res) => {
  const { code, items } = req.validated.body;
  res.json(await couponService.previewCoupon(code, items, req.user?.id ?? null));
});

// Mã tự động áp dụng cho giỏ hàng: luôn 200, `coupon` là null khi không có mã nào hợp
export const auto = asyncHandler(async (req, res) => {
  const coupon = await couponService.suggestAutoCoupon(
    req.validated.body.items,
    req.user?.id ?? null,
  );
  res.json({ coupon });
});

export const list = asyncHandler(async (req, res) => {
  res.json(await couponService.listCoupons(req.validated.query));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await couponService.createCoupon(req.validated.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await couponService.updateCoupon(req.validated.params.id, req.validated.body));
});
