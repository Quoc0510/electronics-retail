/**
 * @feature [F08] Đánh giá sản phẩm - Route /api/products/:slug/reviews (US-21).
 *  - GET   /:slug/reviews       : công khai, các đánh giá đang hiện kèm điểm tổng hợp
 *  - GET   /:slug/reviews/mine  : (đăng nhập) có được đánh giá không + đánh giá của mình
 *  - POST  /:slug/reviews       : (đăng nhập) tạo đánh giá, cần đơn COMPLETED chứa sản phẩm (BR-13)
 *  - PATCH /:slug/reviews/mine  : (đăng nhập) sửa đánh giá của mình
 */
import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as reviewController from '../controllers/review.controller.js';
import { productSlugParamSchema } from '../validators/storefront.validator.js';
import { reviewBodySchema, reviewListQuerySchema } from '../validators/review.validator.js';

const router = Router();
const slugParam = validate(productSlugParamSchema, 'params');

router.get(
  '/:slug/reviews',
  slugParam,
  validate(reviewListQuerySchema, 'query'),
  reviewController.list,
);
router.get('/:slug/reviews/mine', authenticate, slugParam, reviewController.getMine);
router.post(
  '/:slug/reviews',
  authenticate,
  slugParam,
  validate(reviewBodySchema),
  reviewController.create,
);
router.patch(
  '/:slug/reviews/mine',
  authenticate,
  slugParam,
  validate(reviewBodySchema),
  reviewController.updateMine,
);

export default router;
