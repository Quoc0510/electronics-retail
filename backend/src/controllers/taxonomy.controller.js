/**
 * @feature [F02] Danh mục và thương hiệu - Controller dùng chung: nhận request, gọi service, trả response.
 * Không chứa nghiệp vụ; nhận vào service tương ứng (danh mục hoặc thương hiệu).
 */
import { asyncHandler } from '../utils/asyncHandler.js';

export const createTaxonomyController = (service) => ({
  listAdmin: asyncHandler(async (req, res) => {
    res.json(await service.listAdmin(req.validated.query));
  }),

  listPublic: asyncHandler(async (_req, res) => {
    res.json(await service.listPublic());
  }),

  getOne: asyncHandler(async (req, res) => {
    res.json(await service.getById(req.validated.params.id));
  }),

  create: asyncHandler(async (req, res) => {
    res.status(201).json(await service.create(req.validated.body));
  }),

  update: asyncHandler(async (req, res) => {
    res.json(await service.update(req.validated.params.id, req.validated.body));
  }),

  remove: asyncHandler(async (req, res) => {
    await service.remove(req.validated.params.id);
    res.status(204).end();
  }),
});
