/**
 * @feature [F16] Cài đặt cửa hàng - Route /api/admin/settings (ngưỡng miễn phí vận chuyển). Đã nằm sau authenticate +
 * requireRole('ADMIN') của admin.routes.js nên chỉ quản trị viên xem và đổi được.
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import * as settingsController from '../controllers/settings.controller.js';
import { updateShippingSettingsSchema } from '../validators/settings.validator.js';

const router = Router();

router.get('/shipping', settingsController.getShipping);
router.put('/shipping', validate(updateShippingSettingsSchema), settingsController.updateShipping);

export default router;
