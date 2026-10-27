/**
 * @feature [F04] Duyệt và tìm sản phẩm - Route công khai /api/products/*
 *  - GET /api/products        : danh sách có lọc, sắp xếp, tìm kiếm, phân trang
 *  - GET /api/products/:slug  : chi tiết một sản phẩm
 * (Quản trị sản phẩm nằm ở /api/admin/products, xem product.routes.js)
 */
import { Router } from 'express';
import * as storefrontController from '../controllers/storefront.controller.js';
import { validate } from '../middlewares/validate.js';
import {
  productSlugParamSchema,
  storefrontListQuerySchema,
} from '../validators/storefront.validator.js';

const router = Router();

router.get('/', validate(storefrontListQuerySchema, 'query'), storefrontController.list);
router.get('/:slug', validate(productSlugParamSchema, 'params'), storefrontController.getOne);

export default router;
