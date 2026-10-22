/**
 * @feature [F01] Phân quyền (frontend) - Trạng thái đăng nhập của Admin (US-05 AC2).
 * Chỉ tài khoản có vai trò ADMIN mới được vào; khách hàng đăng nhập ở đây sẽ bị từ chối và thu hồi phiên ngay.
 */
import { createAuth } from '@techstore/shared';
import { api, setAuthFailureHandler, tokenStorage } from '../lib/api.js';

export const { AuthProvider, useAuth } = createAuth({
  api,
  storage: tokenStorage,
  setAuthFailureHandler,
  isAllowed: (user) => user.role === 'ADMIN',
  notAllowedMessage: 'Tài khoản này không có quyền quản trị',
});
