/**
 * @feature [F00] Nền tảng - Khởi tạo ứng dụng Express (tách khỏi server.js để dễ kiểm thử).
 * Thứ tự middleware: bảo mật -> parse body -> log -> giới hạn tốc độ -> route -> xử lý lỗi.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

export const app = express();

// Thêm các HTTP header bảo mật (chống clickjacking, sniffing...)
app.use(helmet());

// Chỉ cho phép client và admin gọi API (chống gọi chéo từ website lạ)
app.use(cors({ origin: env.corsOrigins, credentials: true }));

app.use(express.json({ limit: '1mb' }));

// Ghi log mỗi request qua winston
app.use(morgan('tiny', { stream: { write: (line) => logger.info(line.trim()) } }));

// Giới hạn 300 request / 15 phút / IP để giảm nguy cơ spam và dò mật khẩu
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Bạn gửi quá nhiều yêu cầu, hãy thử lại sau' },
    },
  }),
);

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);
