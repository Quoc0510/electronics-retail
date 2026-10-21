/**
 * @feature [F01] Xác thực (frontend) - Axios tự gắn access token và tự làm mới khi hết hạn (US-03 AC1).
 *
 * Luồng khi một request nhận 401:
 *  1. Dùng refresh token xin cặp token mới (chỉ gọi MỘT lần dù nhiều request cùng lỗi một lúc).
 *  2. Gửi lại request ban đầu với token mới, người dùng không nhận ra gì.
 *  3. Nếu làm mới thất bại: xóa token và gọi onAuthFailure để ứng dụng đưa người dùng về trang đăng nhập.
 */
import axios from 'axios';

/**
 * @param {object} options
 * @param {string} options.baseURL Địa chỉ gốc của API, ví dụ '/api'
 * @param {ReturnType<import('./tokenStorage.js').createTokenStorage>} options.storage
 * @param {() => void} [options.onAuthFailure] Gọi khi không thể giữ phiên đăng nhập nữa
 * @param {number} [options.timeout] Quá thời gian này (ms) coi là lỗi mạng
 */
export const createApiClient = ({ baseURL, storage, onAuthFailure, timeout = 10000 }) => {
  const client = axios.create({ baseURL, timeout });

  // Gắn access token vào mọi request nếu đang có
  client.interceptors.request.use((config) => {
    const token = storage.getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // Dùng chung một lời gọi làm mới cho các request lỗi đồng thời, tránh gửi nhiều lần
  // (mỗi refresh token chỉ dùng được một lần, gửi lần hai sẽ bị coi là bị đánh cắp)
  let refreshing = null;
  const refreshTokens = () => {
    refreshing ??= client
      .post('/auth/refresh', { refreshToken: storage.getRefreshToken() })
      .then((res) => {
        storage.setTokens(res.data);
        return res.data.accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const { config, response } = error;
      const isAuthEndpoint = config?.url?.startsWith('/auth/');

      // Chỉ xử lý 401 của request thường, mỗi request chỉ thử lại một lần, và phải có refresh token
      if (
        response?.status !== 401 ||
        isAuthEndpoint ||
        config._retried ||
        !storage.getRefreshToken()
      ) {
        throw error;
      }

      config._retried = true;
      try {
        const accessToken = await refreshTokens();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return await client(config);
      } catch (retryError) {
        // Lỗi 401 từ chính lần thử lại hoặc từ bước làm mới nghĩa là phiên đã hết, không cứu được
        if (retryError.response?.status === 401) {
          storage.clear();
          onAuthFailure?.();
        }
        throw retryError;
      }
    },
  );

  return client;
};
