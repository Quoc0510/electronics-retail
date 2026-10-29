/**
 * @feature [F08] Đánh giá sản phẩm - Route /api/admin/reviews (US-23). Đã nằm sau authenticate + requireRole('ADMIN') của admin.routes.js.
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import * as adminReviewController from '../controllers/adminReview.controller.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  listAdminReviewsQuerySchema,
  updateVisibilitySchema,
} from '../validators/review.validator.js';

const router = Router();

router.get('/', validate(listAdminReviewsQuerySchema, 'query'), adminReviewController.list);
router.patch(
  '/:id/visibility',
  validate(idParamSchema, 'params'),
  validate(updateVisibilitySchema),
  adminReviewController.updateVisibility,
);

export default router;
