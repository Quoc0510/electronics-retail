/**
 * @feature [F10] Quản lý người dùng - Kiểm thử API Admin xem danh sách, khóa và mở khóa tài khoản (US-27).
 * Chạy trên PostgreSQL thật.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const signInAdmin = async (email = 'admin@example.com') => {
  const user = await createUser({ email, role: 'ADMIN', fullName: 'Quản trị viên' });
  const session = await loginAs(request, app, email);
  return { user, token: session.accessToken };
};

const listUsers = (token, query = '') =>
  request(app).get(`/api/admin/users${query}`).set(auth(token));
const setStatus = (token, id, body) =>
  request(app).patch(`/api/admin/users/${id}/status`).set(auth(token)).send(body);

// ---------------------------------------------------------------------------
// Phân quyền
// ---------------------------------------------------------------------------
describe('Quyền truy cập /api/admin/users', () => {
  it('chưa đăng nhập thì 401', async () => {
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
    expect((await request(app).patch('/api/admin/users/1/status').send({})).status).toBe(401);
  });

  it('khách hàng thì 403 cho cả xem và khóa', async () => {
    const customer = await createUser({ email: 'khach@example.com' });
    const { accessToken } = await loginAs(request, app, 'khach@example.com');

    expect((await listUsers(accessToken)).status).toBe(403);
    expect((await setStatus(accessToken, customer.id, { isActive: false })).status).toBe(403);
    expect((await prisma.user.findUnique({ where: { id: customer.id } })).isActive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// US-27 AC1: danh sách, tìm kiếm, phân trang
// ---------------------------------------------------------------------------
describe('GET /api/admin/users (US-27 AC1)', () => {
  it('trả thông tin cần thiết và không bao giờ lộ mật khẩu', async () => {
    const { token } = await signInAdmin();
    await createUser({ email: 'khach@example.com', fullName: 'Lê Thị B' });

    const res = await listUsers(token);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 2 });
    const customer = res.body.items.find((user) => user.email === 'khach@example.com');
    expect(customer).toEqual({
      id: expect.any(Number),
      email: 'khach@example.com',
      fullName: 'Lê Thị B',
      phone: null,
      role: 'CUSTOMER',
      isActive: true,
      points: 0,
      createdAt: expect.any(String),
      orderCount: 0,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
  });

  it('người đăng ký sau đứng trước', async () => {
    const { token } = await signInAdmin();
    await createUser({ email: 'cu@example.com' });
    await createUser({ email: 'moi@example.com' });

    const res = await listUsers(token);

    expect(res.body.items.map((user) => user.email)).toEqual([
      'moi@example.com',
      'cu@example.com',
      'admin@example.com',
    ]);
  });

  it('tìm theo email: không phân biệt hoa thường, khớp một phần', async () => {
    const { token } = await signInAdmin();
    await createUser({ email: 'nguyen.van.a@example.com' });
    await createUser({ email: 'tran.thi.b@example.com' });

    const res = await listUsers(token, '?search=VAN.A');

    expect(res.body.items.map((user) => user.email)).toEqual(['nguyen.van.a@example.com']);
    expect(res.body.total).toBe(1);
  });

  it('cũng tìm được theo họ tên', async () => {
    const { token } = await signInAdmin();
    await createUser({ email: 'a@example.com', fullName: 'Phạm Minh Tuấn' });
    await createUser({ email: 'b@example.com', fullName: 'Lê Hoa' });

    const res = await listUsers(token, `?search=${encodeURIComponent('minh tuấn')}`);

    expect(res.body.items.map((user) => user.email)).toEqual(['a@example.com']);
  });

  it('ký tự đặc biệt của LIKE (% và _) được coi là ký tự thường, không khớp mọi thứ', async () => {
    const { token } = await signInAdmin();
    await createUser({ email: 'abc@example.com' });

    expect((await listUsers(token, '?search=%25')).body.total).toBe(0);
    expect((await listUsers(token, '?search=_')).body.total).toBe(0);
  });

  it('tìm không thấy thì trả danh sách rỗng', async () => {
    const { token } = await signInAdmin();

    const res = await listUsers(token, '?search=khong-co-ai');

    expect(res.body).toEqual({ items: [], page: 1, pageSize: 10, total: 0 });
  });

  it('phân trang đúng và total là tổng sau khi lọc', async () => {
    const { token } = await signInAdmin();
    for (let i = 1; i <= 5; i += 1) await createUser({ email: `u${i}@example.com` });

    const first = await listUsers(token, '?pageSize=4&page=1');
    const second = await listUsers(token, '?pageSize=4&page=2');
    const beyond = await listUsers(token, '?pageSize=4&page=9');

    expect(first.body.items).toHaveLength(4);
    expect(second.body.items).toHaveLength(2);
    expect(first.body.total).toBe(6);
    const ids = [...first.body.items, ...second.body.items].map((user) => user.id);
    expect(new Set(ids).size).toBe(6);
    expect(beyond.body.items).toEqual([]);
  });

  it('lọc theo trạng thái khóa', async () => {
    const { token } = await signInAdmin();
    await createUser({ email: 'ok@example.com' });
    await createUser({ email: 'khoa@example.com', isActive: false });

    const locked = await listUsers(token, '?status=locked');
    const active = await listUsers(token, '?status=active');

    expect(locked.body.items.map((user) => user.email)).toEqual(['khoa@example.com']);
    expect(active.body.items.map((user) => user.email).sort()).toEqual([
      'admin@example.com',
      'ok@example.com',
    ]);
  });

  it('đếm số đơn hàng của từng người dùng', async () => {
    const { token } = await signInAdmin();
    const buyer = await createUser({ email: 'mua@example.com' });
    await createUser({ email: 'khong-mua@example.com' });
    for (const code of ['TS261020-AAAA', 'TS261020-BBBB']) {
      await prisma.order.create({
        data: {
          code,
          userId: buyer.id,
          subtotal: 1000000,
          shippingFee: 30000,
          total: 1030000,
          recipientName: 'A',
          phone: '0912345678',
          shippingAddress: 'Hà Nội',
        },
      });
    }

    const res = await listUsers(token, '?search=mua@');

    const byEmail = Object.fromEntries(res.body.items.map((user) => [user.email, user.orderCount]));
    expect(byEmail).toEqual({ 'mua@example.com': 2, 'khong-mua@example.com': 0 });
  });

  it.each([
    ['page=0', 'page=0'],
    ['pageSize quá lớn', 'pageSize=51'],
    ['pageSize bằng 0', 'pageSize=0'],
    ['trạng thái lạ', 'status=banned'],
    ['từ khóa quá dài', `search=${'a'.repeat(101)}`],
  ])('tham số sai (%s) thì 400', async (_name, query) => {
    const { token } = await signInAdmin();

    expect((await listUsers(token, `?${query}`)).status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// US-27 AC2, AC3: khóa và mở khóa
// ---------------------------------------------------------------------------
describe('PATCH /api/admin/users/:id/status (US-27)', () => {
  it('khóa tài khoản: isActive thành false và trả thông tin người dùng', async () => {
    const { token } = await signInAdmin();
    const customer = await createUser({ email: 'khach@example.com' });

    const res = await setStatus(token, customer.id, { isActive: false });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: customer.id,
      email: 'khach@example.com',
      isActive: false,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect((await prisma.user.findUnique({ where: { id: customer.id } })).isActive).toBe(false);
  });

  it('AC2: khóa thì thu hồi toàn bộ phiên đăng nhập của người đó, không đụng tới người khác', async () => {
    const { token } = await signInAdmin();
    const target = await createUser({ email: 'khach@example.com' });
    const other = await createUser({ email: 'khac@example.com' });
    // Đăng nhập hai lần = hai thiết bị
    const session = await loginAs(request, app, 'khach@example.com');
    await loginAs(request, app, 'khach@example.com');
    await loginAs(request, app, 'khac@example.com');

    await setStatus(token, target.id, { isActive: false });

    const tokens = await prisma.refreshToken.findMany({ where: { userId: target.id } });
    expect(tokens).toHaveLength(2);
    expect(tokens.every((stored) => stored.revokedAt !== null)).toBe(true);
    const otherTokens = await prisma.refreshToken.findMany({ where: { userId: other.id } });
    expect(otherTokens.every((stored) => stored.revokedAt === null)).toBe(true);

    // Token cũ của người bị khóa không còn dùng được: access token (đọc lại DB) và refresh token
    const me = await request(app).get('/api/users/me').set(auth(session.accessToken));
    expect(me.status).toBe(401);
    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(refreshed.status).toBe(401);
  });

  it('người bị khóa không đăng nhập lại được (ACCOUNT_LOCKED)', async () => {
    const { token } = await signInAdmin();
    const customer = await createUser({ email: 'khach@example.com' });
    await setStatus(token, customer.id, { isActive: false });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'Matkhau123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('mở khóa thì đăng nhập lại được', async () => {
    const { token } = await signInAdmin();
    const customer = await createUser({ email: 'khach@example.com', isActive: false });

    const res = await setStatus(token, customer.id, { isActive: true });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'Matkhau123' });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
    expect(login.status).toBe(200);
  });

  it('mở khóa không làm sống lại các phiên đã bị thu hồi', async () => {
    const { token } = await signInAdmin();
    const customer = await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');
    await setStatus(token, customer.id, { isActive: false });
    await setStatus(token, customer.id, { isActive: true });

    const refreshed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(refreshed.status).toBe(401);
  });

  it('AC3: không được tự khóa chính mình (400 CANNOT_LOCK_SELF), tài khoản vẫn hoạt động', async () => {
    const { user, token } = await signInAdmin();

    const res = await setStatus(token, user.id, { isActive: false });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_LOCK_SELF');
    expect((await prisma.user.findUnique({ where: { id: user.id } })).isActive).toBe(true);
    const tokens = await prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(tokens.every((stored) => stored.revokedAt === null)).toBe(true);
    expect((await listUsers(token)).status).toBe(200);
  });

  it('tự "mở khóa" chính mình (không đổi gì) vẫn hợp lệ', async () => {
    const { user, token } = await signInAdmin();

    const res = await setStatus(token, user.id, { isActive: true });

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(true);
  });

  it('khóa quản trị viên khác được; người đó mất quyền ngay', async () => {
    const { token } = await signInAdmin();
    const other = await createUser({ email: 'admin2@example.com', role: 'ADMIN' });
    const otherSession = await loginAs(request, app, 'admin2@example.com');

    const res = await setStatus(token, other.id, { isActive: false });

    expect(res.status).toBe(200);
    expect((await listUsers(otherSession.accessToken)).status).toBe(401);
  });

  it('gọi lại với cùng trạng thái vẫn thành công (idempotent)', async () => {
    const { token } = await signInAdmin();
    const customer = await createUser({ email: 'khach@example.com' });

    const first = await setStatus(token, customer.id, { isActive: false });
    const second = await setStatus(token, customer.id, { isActive: false });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.isActive).toBe(false);
  });

  it('khóa không xóa dữ liệu của người dùng (đơn hàng, điểm vẫn còn)', async () => {
    const { token } = await signInAdmin();
    const customer = await createUser({ email: 'khach@example.com' });
    await prisma.user.update({ where: { id: customer.id }, data: { points: 40 } });
    await prisma.order.create({
      data: {
        code: 'TS261020-AAAA',
        userId: customer.id,
        subtotal: 1000000,
        shippingFee: 30000,
        total: 1030000,
        recipientName: 'A',
        phone: '0912345678',
        shippingAddress: 'Hà Nội',
      },
    });

    const res = await setStatus(token, customer.id, { isActive: false });

    expect(res.body).toMatchObject({ points: 40, orderCount: 1 });
    expect(await prisma.order.count({ where: { userId: customer.id } })).toBe(1);
  });

  it('người dùng không tồn tại thì 404', async () => {
    const { token } = await signInAdmin();

    const res = await setStatus(token, 99999, { isActive: false });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it.each([
    ['id không phải số', 'abc', { isActive: false }],
    ['id bằng 0', '0', { isActive: false }],
    ['thiếu isActive', '2', {}],
    ['isActive là chuỗi "false"', '2', { isActive: 'false' }],
    ['isActive là số 0', '2', { isActive: 0 }],
    ['isActive là null', '2', { isActive: null }],
  ])('dữ liệu sai (%s) thì 400 và không đổi gì', async (_name, id, body) => {
    const { token } = await signInAdmin();
    await createUser({ email: 'khach@example.com' });

    const res = await request(app)
      .patch(`/api/admin/users/${id}/status`)
      .set(auth(token))
      .send(body);

    expect(res.status).toBe(400);
    expect(await prisma.user.count({ where: { isActive: false } })).toBe(0);
  });
});
