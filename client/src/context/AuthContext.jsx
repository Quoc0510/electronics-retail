/**
 * @feature [F01] Xác thực (frontend) - Trạng thái đăng nhập của Client.
 * Logic dùng chung nằm ở shared/src/createAuth.jsx; ở đây chỉ gắn với axios và nơi lưu token của Client.
 * Dùng: const { user, login, logout } = useAuth()
 */
import { createAuth } from '@techstore/shared';
import { api, setAuthFailureHandler, tokenStorage } from '../lib/api.js';

export const { AuthProvider, useAuth } = createAuth({
  api,
  storage: tokenStorage,
  setAuthFailureHandler,
});
