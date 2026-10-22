/**
 * @feature [F02] Danh mục và thương hiệu - Khung route dùng chung cho danh mục và thương hiệu.
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { idParamSchema } from '../validators/common.validator.js';
import { listQuerySchema } from '../validators/taxonomy.validator.js';

/** Route quản trị (CRUD đầy đủ). Được gắn vào router /api/admin nên đã có sẵn kiểm tra quyền ADMIN. */
export const createAdminTaxonomyRouter = ({ controller, createSchema, updateSchema }) => {
  const router = Router();

  router.get('/', validate(listQuerySchema, 'query'), controller.listAdmin);
  router.post('/', validate(createSchema), controller.create);
  router.get('/:id', validate(idParamSchema, 'params'), controller.getOne);
  router.patch(
    '/:id',
    validate(idParamSchema, 'params'),
    validate(updateSchema),
    controller.update,
  );
  router.delete('/:id', validate(idParamSchema, 'params'), controller.remove);

  return router;
};

/** Route công khai cho website khách hàng: chỉ xem danh sách các mục đang hiện. */
export const createPublicTaxonomyRouter = (controller) => {
  const router = Router();
  router.get('/', controller.listPublic);
  return router;
};
