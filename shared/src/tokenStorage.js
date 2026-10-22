/**
 * @feature [F01] Xác thực (frontend) - Lưu access token và refresh token ở localStorage.
 * Mỗi ứng dụng dùng một key riêng để Client và Admin không đè phiên đăng nhập của nhau.
 * Mọi thao tác bọc try/catch vì localStorage có thể bị chặn (chế độ riêng tư, tắt cookie...);
 * khi đó ứng dụng vẫn chạy, chỉ là không nhớ được phiên đăng nhập.
 */
export const createTokenStorage = (key) => {
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? {};
    } catch {
      return {};
    }
  };

  return {
    getAccessToken: () => read().accessToken ?? null,
    getRefreshToken: () => read().refreshToken ?? null,
    setTokens: ({ accessToken, refreshToken }) => {
      try {
        localStorage.setItem(key, JSON.stringify({ accessToken, refreshToken }));
      } catch {
        // Không lưu được thì bỏ qua, người dùng sẽ phải đăng nhập lại khi tải lại trang
      }
    },
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Bỏ qua như trên
      }
    },
  };
};
