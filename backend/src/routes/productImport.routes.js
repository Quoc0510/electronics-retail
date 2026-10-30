/**
 * @feature [F14] Nhập sản phẩm từ Excel - Route /api/admin/products/import/* (US-35, US-36). Nằm sau authenticate +
 * requireRole('ADMIN') của admin.routes.js và được gắn TRƯỚC router sản phẩm để "/import" không bị hiểu là "/:id".
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { uploadSpreadsheet } from '../middlewares/upload.js';
import * as importController from '../controllers/productImport.controller.js';
import { importQuerySchema } from '../validators/productImport.validator.js';

const router = Router();
const query = validate(importQuerySchema, 'query');

router.get('/template', query, importController.template);
router.post('/preview', query, uploadSpreadsheet, importController.preview);
router.post('/errors', query, uploadSpreadsheet, importController.errorFile);
router.post('/', query, uploadSpreadsheet, importController.run);

export default router;
