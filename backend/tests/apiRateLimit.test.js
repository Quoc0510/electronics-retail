/**
 * @feature [F00] Nền tảng - Kiểm thử giới hạn tổng số request tới /api, cấu hình được bằng API_RATE_LIMIT (mặc định 300 / 15 phút / IP).
 * Đặt ở file riêng vì bộ đếm của rate-limit nằm trong bộ nhớ của app, tránh ảnh hưởng các test khác.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.stubEnv('API_RATE_LIMIT', '4');
const { app } = await import('../src/app.js');
const { env } = await import('../src/config/env.js');
const { prisma } = await import('../src/lib/prisma.js');

afterAll(() => prisma.$disconnect());

describe('Giới hạn request tới /api', () => {
  it('đọc giá trị từ biến môi trường', () => {
    expect(env.API_RATE_LIMIT).toBe(4);
  });

  it('vượt quá số request cho phép thì trả 429 với mã RATE_LIMITED', async () => {
    for (let i = 0; i < 4; i += 1) {
      expect((await request(app).get('/api/health')).status).toBe(200);
    }
    const blocked = await request(app).get('/api/health');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
