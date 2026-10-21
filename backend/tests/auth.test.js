/**
 * @feature [F01] Xác thực - Kiểm thử API đăng ký, đăng nhập, làm mới phiên, đăng xuất, middleware authenticate.
 * Mỗi test ghi rõ acceptance criteria (AC) của user story tương ứng trong docs/SRS.md.
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

const validBody = {
  email: 'khach@example.com',
  password: 'Matkhau123',
  fullName: 'Nguyễn Văn A',
};

describe('POST /api/auth/register (US-01)', () => {
  it('AC3: đăng ký thành công thì trả user và token, không lộ passwordHash', async () => {
    const res = await request(app).post('/api/auth/register').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('khach@example.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
  });

  it('lưu mật khẩu đã băm, không lưu mật khẩu gốc', async () => {
    await request(app).post('/api/auth/register').send(validBody);
    const user = await prisma.user.findUnique({ where: { email: 'khach@example.com' } });

    expect(user.passwordHash).not.toBe('Matkhau123');
    expect(user.passwordHash).toMatch(/^\$2[aby]\$10\$/); // bcrypt, cost 10 (NFR-03)
  });

  it('AC5: luôn tạo vai trò CUSTOMER dù client cố gửi role ADMIN (BR-10)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, role: 'ADMIN' });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CUSTOMER');
  });

  it('AC4: email trùng trả 409', async () => {
    await createUser({ email: 'khach@example.com' });
    const res = await request(app).post('/api/auth/register').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('AC4: email trùng không phân biệt hoa thường và khoảng trắng', async () => {
    await createUser({ email: 'khach@example.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, email: '  KHACH@Example.com ' });

    expect(res.status).toBe(409);
  });

  it.each([
    ['quá ngắn', 'Ab1'],
    ['không có chữ số', 'Matkhaucuatoi'],
    ['không có chữ cái', '12345678'],
  ])('AC2: từ chối mật khẩu %s', async (_name, password) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, password });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.password).toBeDefined();
  });

  it('AC1: từ chối email sai định dạng', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, email: 'khong-phai-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.email).toBeDefined();
  });

  it('từ chối số điện thoại sai định dạng (US-04 AC4)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...validBody, phone: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.phone).toBeDefined();
  });
});

describe('POST /api/auth/login (US-02)', () => {
  it('AC1: đúng thông tin thì nhận access token và refresh token', async () => {
    await createUser({ email: 'khach@example.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'Matkhau123' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe('khach@example.com');
  });

  it('đăng nhập không phân biệt hoa thường ở email', async () => {
    await createUser({ email: 'khach@example.com' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'KHACH@example.com', password: 'Matkhau123' });

    expect(res.status).toBe(200);
  });

  it('AC2: sai mật khẩu và sai email cùng nhận một thông báo, không lộ email có tồn tại', async () => {
    await createUser({ email: 'khach@example.com' });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'SaiMatKhau1' });
    const wrongEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khong-co@example.com', password: 'Matkhau123' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(wrongEmail.body.error.message);
  });

  it('AC3: tài khoản bị khóa không đăng nhập được', async () => {
    await createUser({ email: 'khach@example.com', isActive: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'Matkhau123' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('AC3: không tiết lộ tài khoản bị khóa khi mật khẩu sai', async () => {
    await createUser({ email: 'khach@example.com', isActive: false });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'SaiMatKhau1' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh (US-03)', () => {
  it('AC1: đổi refresh token lấy cặp token mới, token cũ bị thu hồi', async () => {
    await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(session.refreshToken);

    // Dùng lại token cũ phải bị từ chối
    const reuse = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('dùng lại token đã thu hồi thì thu hồi luôn mọi phiên của người dùng (phòng token bị đánh cắp)', async () => {
    await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');
    const renewed = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    // Kẻ cắp dùng lại token cũ
    await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });

    // Token mới (của người dùng thật) cũng bị vô hiệu
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: renewed.body.refreshToken });
    expect(res.status).toBe(401);
  });

  it('AC3: refresh token sai trả 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'khong-ton-tai' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('AC3: refresh token hết hạn trả 401', async () => {
    await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('chỉ lưu bản băm của refresh token trong DB', async () => {
    await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');
    const stored = await prisma.refreshToken.findFirst();

    expect(stored.tokenHash).not.toBe(session.refreshToken);
  });
});

describe('POST /api/auth/logout (US-03 AC2)', () => {
  it('thu hồi refresh token, sau đó không dùng lại được', async () => {
    await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');

    const logout = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken: session.refreshToken });
    expect(logout.status).toBe(204);

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(res.status).toBe(401);
  });

  it('gọi đăng xuất với token không tồn tại vẫn thành công', async () => {
    const res = await request(app).post('/api/auth/logout').send({ refreshToken: 'bat-ky' });

    expect(res.status).toBe(204);
  });
});

describe('Middleware authenticate (US-03 AC3)', () => {
  it('không có token trả 401', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('token rác trả 401', async () => {
    const res = await request(app).get('/api/users/me').set('Authorization', 'Bearer rac-rac-rac');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('token hết hạn trả 401', async () => {
    const user = await createUser();
    const expired = jwt.sign({ role: user.role }, process.env.JWT_ACCESS_SECRET, {
      subject: String(user.id),
      expiresIn: -10,
    });

    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
  });

  it('token ký bằng khóa khác trả 401', async () => {
    const user = await createUser();
    const forged = jwt.sign({ role: 'ADMIN' }, 'khoa-gia-mao-khoa-gia-mao-khoa-gia-mao-123', {
      subject: String(user.id),
    });

    const res = await request(app).get('/api/users/me').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('tài khoản bị khóa sau khi đã có token thì bị chặn ngay', async () => {
    const user = await createUser({ email: 'khach@example.com' });
    const session = await loginAs(request, app, 'khach@example.com');
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(401);
  });
});
