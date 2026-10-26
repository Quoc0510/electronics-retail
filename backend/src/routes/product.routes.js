/**
 * @feature [F03] Sản phẩm - Route quản trị /api/admin/products/*
 * Được gắn vào router /api/admin nên đã có sẵn kiểm tra quyền ADMIN (xem admin.routes.js).
 */
import { Router } from 'express';
import * as productController from '../controllers/product.controller.js';
import { validate } from '../middlewares/validate.js';
import { uploadImages } from '../middlewares/upload.js';
import { idParamSchema } from '../validators/common.validator.js';
import {
  createProductSchema,
  listProductsQuerySchema,
  productImageParamsSchema,
  reorderImagesSchema,
  updateProductSchema,
} from '../validators/product.validator.js';

const router = Router();

router.get('/', validate(listProductsQuerySchema, 'query'), productController.list);
router.post('/', validate(createProductSchema), productController.create);
router.get('/:id', validate(idParamSchema, 'params'), productController.getOne);
router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  productController.update,
);
router.delete('/:id', validate(idParamSchema, 'params'), productController.remove);

// Ảnh sản phẩm. Thứ tự middleware: kiểm tra id -> nhận file -> xử lý
router.post(
  '/:id/images',
  validate(idParamSchema, 'params'),
  uploadImages,
  productController.addImages,
);
router.put(
  '/:id/images/order',
  validate(idParamSchema, 'params'),
  validate(reorderImagesSchema),
  productController.reorderImages,
);
router.delete(
  '/:id/images/:imageId',
  validate(productImageParamsSchema, 'params'),
  productController.deleteImage,
);

export default router;
