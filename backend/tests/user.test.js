/**
 * @feature [F01] Xác thực - Kiểm thử hồ sơ cá nhân, đổi mật khẩu, sổ địa chỉ (US-04).
 */
import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createUser, loginAs, resetDatabase } from './helpers.js';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

// Tạo người dùng, đăng nhập và trả về hàm gắn sẵn header Authorization
const signIn = async (email = 'khach@example.com') => {
  await createUser({ email });
  const session = await loginAs(request, app, email);
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  return { session, auth };
};

const address = {
  recipientName: 'Nguyễn Văn A',
  phone: '0912345678',
  province: 'TP. Hồ Chí Minh',
  district: 'Quận 1',
  ward: 'Phường Bến Nghé',
  street: '1 Lê Duẩn',
};

describe('Hồ sơ cá nhân (US-04 AC1)', () => {
  it('xem được hồ sơ của chính mình', async () => {
    const { auth } = await signIn();
    const res = await request(app).get('/api/users/me').set(auth);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('khach@example.com');
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('sửa họ tên và số điện thoại', async () => {
    const { auth } = await signIn();
    const res = await request(app)
      .patch('/api/users/me')
      .set(auth)
      .send({ fullName: 'Trần Thị B', phone: '0987654321' });

    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('Trần Thị B');
    expect(res.body.phone).toBe('0987654321');
  });

  it('không cho sửa email hoặc vai trò qua API hồ sơ', async () => {
    const { auth } = await signIn();
    const res = await request(app)
      .patch('/api/users/me')
      .set(auth)
      .send({ fullName: 'Tên mới', role: 'ADMIN', email: 'hacker@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('CUSTOMER');
    expect(res.body.email).toBe('khach@example.com');
  });

  it('AC4: từ chối số điện thoại sai định dạng', async () => {
    const { auth } = await signIn();
    const res = await request(app).patch('/api/users/me').set(auth).send({ phone: '0123' });

    expect(res.status).toBe(400);
  });

  it('từ chối request không có dữ liệu cập nhật', async () => {
    const { auth } = await signIn();
    const res = await request(app).patch('/api/users/me').set(auth).send({});

    expect(res.status).toBe(400);
  });
});

describe('Đổi mật khẩu (US-04 AC2)', () => {
  it('đổi thành công, đăng nhập được bằng mật khẩu mới và phiên cũ bị thu hồi', async () => {
    const { auth, session } = await signIn();

    const res = await request(app)
      .put('/api/users/me/password')
      .set(auth)
      .send({ currentPassword: 'Matkhau123', newPassword: 'MatkhauMoi456' });
    expect(res.status).toBe(204);

    const oldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'Matkhau123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'khach@example.com', password: 'MatkhauMoi456' });
    expect(newLogin.status).toBe(200);

    const refresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it('từ chối khi nhập sai mật khẩu hiện tại', async () => {
    const { auth } = await signIn();
    const res = await request(app)
      .put('/api/users/me/password')
      .set(auth)
      .send({ currentPassword: 'SaiMatKhau1', newPassword: 'MatkhauMoi456' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
  });

  it('từ chối mật khẩu mới quá yếu', async () => {
    const { auth } = await signIn();
    const res = await request(app)
      .put('/api/users/me/password')
      .set(auth)
      .send({ currentPassword: 'Matkhau123', newPassword: 'yeu' });

    expect(res.status).toBe(400);
  });
});

describe('Sổ địa chỉ (US-04 AC3)', () => {
  it('địa chỉ đầu tiên tự động là mặc định', async () => {
    const { auth } = await signIn();
    const res = await request(app).post('/api/users/me/addresses').set(auth).send(address);

    expect(res.status).toBe(201);
    expect(res.body.isDefault).toBe(true);
  });

  it('chỉ có tối đa một địa chỉ mặc định', async () => {
    const { auth } = await signIn();
    await request(app).post('/api/users/me/addresses').set(auth).send(address);
    const second = await request(app)
      .post('/api/users/me/addresses')
      .set(auth)
      .send({ ...address, street: '2 Lê Lợi', isDefault: true });

    const list = await request(app).get('/api/users/me/addresses').set(auth);
    const defaults = list.body.filter((a) => a.isDefault);

    expect(list.body).toHaveLength(2);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(second.body.id);
  });

  it('sửa địa chỉ', async () => {
    const { auth } = await signIn();
    const created = await request(app).post('/api/users/me/addresses').set(auth).send(address);

    const res = await request(app)
      .patch(`/api/users/me/addresses/${created.body.id}`)
      .set(auth)
      .send({ street: '99 Nguyễn Huệ' });

    expect(res.status).toBe(200);
    expect(res.body.street).toBe('99 Nguyễn Huệ');
    expect(res.body.province).toBe('TP. Hồ Chí Minh');
  });

  it('không bỏ được cờ mặc định trực tiếp (luôn còn một địa chỉ mặc định)', async () => {
    const { auth } = await signIn();
    const created = await request(app).post('/api/users/me/addresses').set(auth).send(address);

    const res = await request(app)
      .patch(`/api/users/me/addresses/${created.body.id}`)
      .set(auth)
      .send({ isDefault: false });

    expect(res.body.isDefault).toBe(true);
  });

  it('xóa địa chỉ mặc định thì địa chỉ còn lại trở thành mặc định', async () => {
    const { auth } = await signIn();
    const first = await request(app).post('/api/users/me/addresses').set(auth).send(address);
    await request(app)
      .post('/api/users/me/addresses')
      .set(auth)
      .send({ ...address, street: '2 Lê Lợi' });

    const del = await request(app).delete(`/api/users/me/addresses/${first.body.id}`).set(auth);
    const list = await request(app).get('/api/users/me/addresses').set(auth);

    expect(del.status).toBe(204);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].isDefault).toBe(true);
  });

  it('không thao tác được địa chỉ của người khác (trả 404)', async () => {
    const owner = await signIn('chu@example.com');
    const created = await request(app)
      .post('/api/users/me/addresses')
      .set(owner.auth)
      .send(address);
    const other = await signIn('nguoikhac@example.com');

    const patch = await request(app)
      .patch(`/api/users/me/addresses/${created.body.id}`)
      .set(other.auth)
      .send({ street: 'Địa chỉ bị chiếm' });
    const del = await request(app)
      .delete(`/api/users/me/addresses/${created.body.id}`)
      .set(other.auth);

    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
  });

  it('người khác không thấy địa chỉ của mình trong danh sách', async () => {
    const owner = await signIn('chu@example.com');
    await request(app).post('/api/users/me/addresses').set(owner.auth).send(address);
    const other = await signIn('nguoikhac@example.com');

    const list = await request(app).get('/api/users/me/addresses').set(other.auth);

    expect(list.body).toHaveLength(0);
  });

  it('từ chối địa chỉ thiếu trường bắt buộc và id không hợp lệ', async () => {
    const { auth } = await signIn();
    const missing = await request(app)
      .post('/api/users/me/addresses')
      .set(auth)
      .send({ recipientName: 'A' });
    const badId = await request(app).delete('/api/users/me/addresses/abc').set(auth);

    expect(missing.status).toBe(400);
    expect(badId.status).toBe(400);
  });
});
