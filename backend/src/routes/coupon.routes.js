/**
 * @feature [F09] Mã giảm giá - Route công khai /api/coupons (US-25): xem trước số tiền giảm, cả khách chưa đăng nhập.
 * Có giới hạn tốc độ để không bị dùng để dò mã.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { optionalAuthenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as couponController from '../controllers/coupon.controller.js';
import { previewCouponSchema } from '../validators/coupon.validator.js';

const router = Router();

const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.COUPON_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Bạn thử mã quá nhiều lần, hãy thử lại sau' },
  },
});

// Đăng nhập là tùy chọn: chỉ cần để biết điểm thành viên khi mã có điều kiện điểm tối thiểu
router.post(
  '/preview',
  previewLimiter,
  optionalAuthenticate,
  validate(previewCouponSchema),
  couponController.preview,
);

export default router;
