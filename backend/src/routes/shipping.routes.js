/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Route công khai /api/shipping (US-37): cấu hình, danh mục tỉnh và phường/xã,
 * ước tính phí. Mỗi lần ước tính (/quote) là một lần gọi GHN nên chỉ route này có giới hạn tốc độ riêng.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { validate } from '../middlewares/validate.js';
import * as shippingController from '../controllers/shipping.controller.js';
import { provinceParamsSchema, quoteShippingSchema } from '../validators/shipping.validator.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.SHIPPING_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Bạn tính phí quá nhiều lần, hãy thử lại sau' },
  },
});

// Danh mục tỉnh/phường đã cache 24 giờ ở server nên không tốn lượt gọi GHN: không đặt giới hạn riêng (nếu chung hạn mức với
// /quote, khách chọn nhiều phường hoặc một lần quét sẽ làm trang đặt hàng quay về ô nhập tay vì 429)
router.get('/config', shippingController.config);
router.get('/provinces', shippingController.provinces);
router.get(
  '/provinces/:provinceId/wards',
  validate(provinceParamsSchema, 'params'),
  shippingController.wards,
);
router.post('/quote', limiter, validate(quoteShippingSchema), shippingController.quote);

export default router;
