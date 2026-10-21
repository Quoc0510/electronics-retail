/**
 * @feature [F00] Nền tảng - Health check phục vụ giám sát sau triển khai (rubric TC2.6).
 *  - GET /api/health        : server còn sống (liveness)
 *  - GET /api/health/ready  : server kết nối được PostgreSQL (readiness)
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

router.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up' });
    } catch {
      // Báo 503 để nền tảng deploy biết chưa nên nhận traffic
      res.status(503).json({ status: 'error', database: 'down' });
    }
  }),
);

export default router;
