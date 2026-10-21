/**
 * @feature [F00] Nền tảng - Kiểm thử API health check và xử lý lỗi chung.
 */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Giả lập Prisma để test không cần PostgreSQL thật
const queryRaw = vi.fn();
vi.mock('../src/lib/prisma.js', () => ({ prisma: { $queryRaw: (...args) => queryRaw(...args) } }));

const { app } = await import('../src/app.js');

describe('GET /api/health', () => {
  it('trả về 200 và status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/health/ready', () => {
  it('trả về 200 khi kết nối được database', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.database).toBe('up');
  });

  it('trả về 503 khi database lỗi', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.database).toBe('down');
  });
});

describe('Xử lý lỗi chung', () => {
  it('route không tồn tại trả về 404 dạng JSON thống nhất', async () => {
    const res = await request(app).get('/api/khong-ton-tai');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('JSON sai cú pháp trả về 400', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{ sai json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});
