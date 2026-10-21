/**
 * @feature [F00] Nền tảng - Điểm khởi chạy server HTTP và tắt server an toàn.
 */
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from './lib/prisma.js';

const server = app.listen(env.PORT, () => {
  logger.info(`Backend đang chạy tại http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

// Khi nhận tín hiệu tắt: ngừng nhận request mới, đóng kết nối DB rồi mới thoát
const shutdown = (signal) => {
  logger.info(`Nhận ${signal}, đang tắt server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
