/**
 * @feature [F02] Danh mục và thương hiệu - Gắn controller, schema kiểm tra dữ liệu vào route cho từng loại.
 *  - adminCatalogRouter  : /categories và /brands (gắn dưới /api/admin, chỉ ADMIN)
 *  - publicCatalogRouter : /categories và /brands (gắn dưới /api, ai cũng xem được)
 */
import { Router } from 'express';
import { createTaxonomyController } from '../controllers/taxonomy.controller.js';
import { brandService, categoryService } from '../services/catalog.service.js';
import {
  createBrandSchema,
  createCategorySchema,
  updateBrandSchema,
  updateCategorySchema,
} from '../validators/taxonomy.validator.js';
import { createAdminTaxonomyRouter, createPublicTaxonomyRouter } from './taxonomy.routes.js';

const categoryController = createTaxonomyController(categoryService);
const brandController = createTaxonomyController(brandService);

export const adminCatalogRouter = Router();
adminCatalogRouter.use(
  '/categories',
  createAdminTaxonomyRouter({
    controller: categoryController,
    createSchema: createCategorySchema,
    updateSchema: updateCategorySchema,
  }),
);
adminCatalogRouter.use(
  '/brands',
  createAdminTaxonomyRouter({
    controller: brandController,
    createSchema: createBrandSchema,
    updateSchema: updateBrandSchema,
  }),
);

export const publicCatalogRouter = Router();
publicCatalogRouter.use('/categories', createPublicTaxonomyRouter(categoryController));
publicCatalogRouter.use('/brands', createPublicTaxonomyRouter(brandController));
