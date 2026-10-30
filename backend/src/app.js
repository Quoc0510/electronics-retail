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

// Chạy sau nginx (Docker/staging) thì tin header X-Forwarded-For của đúng số lớp proxy để lấy IP thật của khách
app.set('trust proxy', env.TRUST_PROXY);

// Thêm các HTTP header bảo mật (chống clickjacking, sniffing...)
app.use(helmet());

// Chỉ cho phép client và admin gọi API (chống gọi chéo từ website lạ)
app.use(cors({ origin: env.corsOrigins, credentials: true }));

app.use(express.json({ limit: '1mb' }));

// [F03] Phục vụ ảnh đã tải lên. Client/Admin chạy ở origin khác nên phải cho phép tải ảnh chéo origin
// (helmet mặc định chặn bằng Cross-Origin-Resource-Policy: same-origin)
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(env.uploadDir, { index: false, maxAge: '7d', immutable: true }),
);

// Ghi log mỗi request qua winston
app.use(morgan('tiny', { stream: { write: (line) => logger.info(line.trim()) } }));

// Giới hạn 300 request / 15 phút / IP để giảm nguy cơ spam và dò mật khẩu
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.API_RATE_LIMIT,
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
