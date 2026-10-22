/**
 * @feature [F01] Xác thực - Kiểm thử giới hạn số lần đăng nhập (US-02 AC4).
 * Đặt ở file riêng vì bộ đếm của rate-limit nằm trong bộ nhớ của app, tránh ảnh hưởng các test khác.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.stubEnv('LOGIN_RATE_LIMIT', '3');
const { app } = await import('../src/app.js');
const { prisma } = await import('../src/lib/prisma.js');

afterAll(() => prisma.$disconnect());

describe('Giới hạn đăng nhập', () => {
  it('vượt quá số lần cho phép thì trả 429', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'a@example.com', password: 'SaiMatKhau1' });

    // 3 lần đầu bị từ chối vì sai thông tin (401), lần thứ 4 bị chặn bởi giới hạn (429)
    for (let i = 0; i < 3; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
