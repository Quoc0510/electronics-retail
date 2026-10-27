/**
 * @feature [F00][F01] Nền tảng, Xác thực - Axios dùng chung để gọi Backend API.
 * Khi dev, '/api' được Vite proxy sang backend; khi deploy, đặt VITE_API_URL trỏ tới server thật.
 * Token được gắn và làm mới tự động bởi @techstore/shared (xem shared/src/createApiClient.js).
 */
import { createApiClient, createTokenStorage, resolveAssetUrl } from '@techstore/shared';

// Key riêng cho Client để không đè phiên đăng nhập của trang Admin
export const tokenStorage = createTokenStorage('techstore.client.auth');

// AuthContext đăng ký hàm xử lý khi phiên hết hạn (ví dụ: về trạng thái chưa đăng nhập)
let authFailureHandler = () => {};
export const setAuthFailureHandler = (handler) => {
  authFailureHandler = handler;
};

export const api = createApiClient({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  storage: tokenStorage,
  onAuthFailure: () => authFailureHandler(),
  // quá 10 giây coi như lỗi mạng (xử lý trạng thái timeout theo rubric TC2.2)
  timeout: 10000,
});

// [F04] Địa chỉ đầy đủ của ảnh sản phẩm. Khi deploy đặt VITE_ASSET_URL là địa chỉ gốc của backend
export const assetUrl = (url) => resolveAssetUrl(url, import.meta.env.VITE_ASSET_URL ?? '');
