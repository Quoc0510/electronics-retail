/**
 * @feature [F13] Đặt hàng không cần đăng nhập - Kiểm thử giới hạn tốc độ của các API công khai (đặt hàng của khách, tra cứu
 * và hủy bằng mã đơn + số điện thoại). Đặt ở file riêng vì bộ đếm của rate-limit nằm trong bộ nhớ của app.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

vi.stubEnv('GUEST_ORDER_RATE_LIMIT', '2');
vi.stubEnv('ORDER_LOOKUP_RATE_LIMIT', '3');
const { app } = await import('../src/app.js');
const { prisma } = await import('../src/lib/prisma.js');

afterAll(() => prisma.$disconnect());

describe('Giới hạn tốc độ API công khai của đơn hàng', () => {
  it('tra cứu vượt quá số lần cho phép thì 429, kể cả khi đoán sai (chống dò mã đơn)', async () => {
    const attempt = () =>
      request(app).post('/api/orders/lookup').send({ code: 'TS261028-ABCD', phone: '0987654321' });

    for (let i = 0; i < 3; i += 1) {
      expect((await attempt()).status).toBe(404);
    }
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('đặt hàng của khách vượt quá số lần cho phép thì 429', async () => {
    // Giỏ rỗng bị từ chối ở bước kiểm tra dữ liệu (400) nhưng vẫn được tính vào giới hạn
    const attempt = () =>
      request(app).post('/api/orders/guest').send({ items: [], requestId: randomUUID() });

    expect((await attempt()).status).toBe(400);
    expect((await attempt()).status).toBe(400);
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
