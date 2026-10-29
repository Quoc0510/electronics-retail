/**
 * @feature [F08] Đánh giá sản phẩm - Controller API quản trị đánh giá (chỉ ADMIN, xem admin.routes.js) (US-23).
 */
import * as adminReviewService from '../services/adminReview.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await adminReviewService.listReviews(req.validated.query));
});

export const updateVisibility = asyncHandler(async (req, res) => {
  res.json(
    await adminReviewService.setReviewHidden(req.validated.params.id, req.validated.body.isHidden),
  );
});
