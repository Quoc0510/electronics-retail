/**
 * @feature [F01] Phân quyền - Kiểm thử bảo vệ route /api/admin/* (US-05 AC1).
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('GET /api/admin/me', () => {
  it('chưa đăng nhập trả 401', async () => {
    const res = await request(app).get('/api/admin/me');

    expect(res.status).toBe(401);
  });

  it('khách hàng trả 403', async () => {
    await createUser({ email: 'khach@example.com', role: 'CUSTOMER' });
    const session = await loginAs(request, app, 'khach@example.com');

    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('quản trị viên truy cập được', async () => {
    await createUser({ email: 'admin@example.com', role: 'ADMIN' });
    const session = await loginAs(request, app, 'admin@example.com');

    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ADMIN');
  });

  it('khách hàng được nâng quyền trong DB thì có hiệu lực ngay (không cần đăng nhập lại)', async () => {
    const user = await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });

    const res = await request(app)
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
  });
});
