/**
 * @feature [F08] Đánh giá sản phẩm - Controller API đánh giá phía khách hàng (US-21).
 */
import * as reviewService from '../services/review.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await reviewService.listReviews(req.validated.params.slug, req.validated.query));
});

export const getMine = asyncHandler(async (req, res) => {
  res.json(await reviewService.getMyReview(req.user.id, req.validated.params.slug));
});

export const create = asyncHandler(async (req, res) => {
  res
    .status(201)
    .json(
      await reviewService.createReview(req.user.id, req.validated.params.slug, req.validated.body),
    );
});

export const updateMine = asyncHandler(async (req, res) => {
  res.json(
    await reviewService.updateMyReview(req.user.id, req.validated.params.slug, req.validated.body),
  );
});
