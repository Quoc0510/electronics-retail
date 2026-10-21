/**
 * @feature [F00] Nền tảng - Ghi log tập trung bằng winston.
 * Rubric TC2.2 yêu cầu có ghi log; production xuất JSON để dễ gom log, dev xuất dạng dễ đọc.
 */
import winston from 'winston';
import { env } from './env.js';

const { combine, timestamp, json, colorize, printf, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: time, stack }) => `${time} ${level}: ${stack || message}`),
);

export const logger = winston.createLogger({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  format: env.isProduction ? combine(timestamp(), errors({ stack: true }), json()) : devFormat,
  transports: [new winston.transports.Console()],
});
