/**
 * @feature [F06][F07][F13] Đơn hàng - Route /api/orders: đặt hàng, danh sách đơn của mình, xem và hủy đơn (cần đăng nhập);
 * [F13] riêng đặt hàng, tra cứu và hủy đơn của khách vãng lai là công khai, được giới hạn tốc độ để không bị lợi dụng
 * dò mã đơn hay làm cạn tồn kho.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as orderController from '../controllers/order.controller.js';
import {
  cancelGuestOrderSchema,
  cancelOrderSchema,
  createGuestOrderSchema,
  createOrderSchema,
  listMyOrdersQuerySchema,
  lookupOrderSchema,
  orderCodeParamSchema,
} from '../validators/order.validator.js';

const router = Router();

const limiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message } },
  });

// [F13] Công khai: đặt hàng và tra cứu của khách chưa đăng nhập. Đặt trước authenticate; phải khai báo trước "/:code"
const guestOrderLimiter = limiter(
  env.GUEST_ORDER_RATE_LIMIT,
  'Bạn đặt hàng quá nhiều lần, hãy thử lại sau',
);
const lookupLimiter = limiter(
  env.ORDER_LOOKUP_RATE_LIMIT,
  'Bạn tra cứu quá nhiều lần, hãy thử lại sau',
);

router.post(
  '/guest',
  guestOrderLimiter,
  validate(createGuestOrderSchema),
  orderController.createGuest,
);
router.post('/lookup', lookupLimiter, validate(lookupOrderSchema), orderController.lookup);
router.post(
  '/lookup/cancel',
  lookupLimiter,
  validate(cancelGuestOrderSchema),
  orderController.cancelLookup,
);

// Mọi route bên dưới đều yêu cầu đăng nhập
router.use(authenticate);

router.post('/', validate(createOrderSchema), orderController.create);
router.get('/', validate(listMyOrdersQuerySchema, 'query'), orderController.listMine); // [F07]
router.get('/:code', validate(orderCodeParamSchema, 'params'), orderController.getByCode);
router.post(
  '/:code/cancel',
  validate(orderCodeParamSchema, 'params'),
  validate(cancelOrderSchema),
  orderController.cancel,
); // [F07]

export default router;
