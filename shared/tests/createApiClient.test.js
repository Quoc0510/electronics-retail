/**
 * @feature [F01] Kiểm thử axios tự gắn token và tự làm mới phiên (US-03 AC1).
 * Dùng adapter giả để mô phỏng máy chủ, không cần chạy backend.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { createApiClient } from '../src/createApiClient.js';
import { createTokenStorage } from '../src/tokenStorage.js';

// Tạo phản hồi giống axios: 2xx thì resolve, còn lại thì reject bằng AxiosError
const reply = (config, status, data = {}) => {
  const response = { data, status, statusText: '', headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(
    new AxiosError(`Request failed ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response),
  );
};

let storage;
let onAuthFailure;
let calls;

// Dựng client với "máy chủ" giả do hàm handler quyết định phản hồi
const buildClient = (handler) => {
  const client = createApiClient({ baseURL: '/api', storage, onAuthFailure });
  client.defaults.adapter = (config) => {
    calls.push({ url: config.url, auth: config.headers.Authorization });
    return handler(config);
  };
  return client;
};

// Máy chủ giả: token 'old' đã hết hạn, token 'new' hợp lệ
const standardServer = (config) => {
  if (config.url === '/auth/refresh') {
    return reply(config, 200, { accessToken: 'new', refreshToken: 'refresh-2' });
  }
  return config.headers.Authorization === 'Bearer new'
    ? reply(config, 200, { ok: true })
    : reply(config, 401);
};

beforeEach(() => {
  localStorage.clear();
  storage = createTokenStorage('test.auth');
  onAuthFailure = vi.fn();
  calls = [];
});

describe('createApiClient', () => {
  it('gắn access token vào header Authorization', async () => {
    storage.setTokens({ accessToken: 'new', refreshToken: 'refresh-1' });
    const client = buildClient(standardServer);

    await client.get('/users/me');

    expect(calls[0].auth).toBe('Bearer new');
  });

  it('không gắn header khi chưa đăng nhập', async () => {
    const client = buildClient((config) => reply(config, 200));

    await client.get('/products');

    expect(calls[0].auth).toBeUndefined();
  });

  it('gặp 401 thì làm mới token và gửi lại request, người dùng không bị gián đoạn', async () => {
    storage.setTokens({ accessToken: 'old', refreshToken: 'refresh-1' });
    const client = buildClient(standardServer);

    const res = await client.get('/users/me');

    expect(res.data).toEqual({ ok: true });
    expect(calls.map((c) => c.url)).toEqual(['/users/me', '/auth/refresh', '/users/me']);
    expect(storage.getAccessToken()).toBe('new');
    expect(storage.getRefreshToken()).toBe('refresh-2');
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('nhiều request cùng hết hạn chỉ gọi làm mới một lần', async () => {
    storage.setTokens({ accessToken: 'old', refreshToken: 'refresh-1' });
    const client = buildClient(standardServer);

    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);

    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
  });

  it('làm mới thất bại thì xóa token và báo onAuthFailure', async () => {
    storage.setTokens({ accessToken: 'old', refreshToken: 'het-han' });
    const client = buildClient((config) => reply(config, 401));

    await expect(client.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });

    expect(storage.getAccessToken()).toBeNull();
    expect(storage.getRefreshToken()).toBeNull();
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('request vẫn 401 sau khi đã làm mới thì dừng, không lặp vô hạn', async () => {
    storage.setTokens({ accessToken: 'old', refreshToken: 'refresh-1' });
    const client = buildClient((config) =>
      config.url === '/auth/refresh'
        ? reply(config, 200, { accessToken: 'new', refreshToken: 'refresh-2' })
        : reply(config, 401),
    );

    await expect(client.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });

    expect(calls.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('không có refresh token thì trả lỗi 401 ngay, không gọi làm mới', async () => {
    const client = buildClient((config) => reply(config, 401));

    await expect(client.get('/users/me')).rejects.toMatchObject({ response: { status: 401 } });

    expect(calls).toHaveLength(1);
    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it('401 của chính API đăng nhập (sai mật khẩu) không kích hoạt làm mới token', async () => {
    storage.setTokens({ accessToken: 'old', refreshToken: 'refresh-1' });
    const client = buildClient((config) => reply(config, 401));

    await expect(client.post('/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(calls).toHaveLength(1);
  });

  it('mất mạng khi làm mới thì giữ nguyên token để thử lại sau', async () => {
    storage.setTokens({ accessToken: 'old', refreshToken: 'refresh-1' });
    const client = buildClient((config) =>
      config.url === '/auth/refresh'
        ? Promise.reject(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config))
        : reply(config, 401),
    );

    await expect(client.get('/users/me')).rejects.toBeTruthy();

    expect(storage.getRefreshToken()).toBe('refresh-1');
    expect(onAuthFailure).not.toHaveBeenCalled();
  });
});
