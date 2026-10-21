/**
 * @feature [F01] Công cụ dùng chung cho test giao diện của Client và Admin.
 * Dùng axios THẬT (kể cả bộ tự làm mới token) nhưng thay "đường truyền" bằng máy chủ giả,
 * nên test đi qua cả giao diện, AuthContext và API client như khi chạy thật.
 * Chỉ import trong file test: import { mockServer } from '@techstore/shared/testing'
 */
import { AxiosError } from 'axios';

const respond = (config, status, data) => {
  const response = { data, status, statusText: '', headers: {}, config };
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(
    new AxiosError(`Request failed ${status}`, AxiosError.ERR_BAD_REQUEST, config, null, response),
  );
};

/** Tạo nội dung lỗi giống backend: { error: { code, message, details } } */
export const apiError = (code, message, details) => ({ error: { code, message, details } });

/**
 * Giả lập máy chủ cho một axios instance.
 * handlers có dạng { 'POST /auth/login': [200, {...}] } hoặc hàm (config, body) => [status, data].
 * @returns {{key: string, body: any}[]} mảng ghi lại mọi request, để kiểm tra đã gửi gì lên máy chủ
 */
export const mockServer = (api, handlers) => {
  const calls = [];
  api.defaults.adapter = (config) => {
    const key = `${config.method.toUpperCase()} ${config.url}`;
    const body = config.data ? JSON.parse(config.data) : undefined;
    calls.push({ key, body });

    const handler = handlers[key];
    if (!handler) return respond(config, 404, apiError('NOT_FOUND', `Chưa giả lập ${key}`));
    const [status, data] = typeof handler === 'function' ? handler(config, body) : handler;
    return respond(config, status, data);
  };
  return calls;
};
