/**
 * @feature [F01] Xác thực (frontend) - Tạo AuthProvider và useAuth dùng chung cho Client và Admin.
 * Hai ứng dụng khác nhau ở: axios/key lưu token riêng, và Admin chỉ cho phép tài khoản ADMIN (isAllowed).
 * Cung cấp qua useAuth(): user, initializing, notice, login, register, logout(notice), clearNotice, setUser.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UserFacingError } from './errors.js';

/**
 * @param {object} options
 * @param {import('axios').AxiosInstance} options.api Axios của ứng dụng (đã gắn tự làm mới token)
 * @param {ReturnType<import('./tokenStorage.js').createTokenStorage>} options.storage
 * @param {(handler: () => void) => void} options.setAuthFailureHandler Đăng ký hàm xử lý khi phiên hết hạn
 * @param {(user: object) => boolean} [options.isAllowed] Kiểm tra người dùng có được vào ứng dụng này không
 * @param {string} [options.notAllowedMessage] Thông báo khi isAllowed trả về false
 */
export const createAuth = ({
  api,
  storage,
  setAuthFailureHandler,
  isAllowed = () => true,
  notAllowedMessage = 'Tài khoản này không có quyền truy cập',
}) => {
  const AuthContext = createContext(null);

  function AuthProvider({ children }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    // Nếu đang có refresh token thì phải chờ xác minh phiên trước khi quyết định hiển thị trang nào,
    // nếu không người dùng đã đăng nhập sẽ bị chuyển nhầm sang trang đăng nhập khi tải lại trang
    // Thông báo hiển thị ở trang đăng nhập sau khi bị đăng xuất có chủ đích (ví dụ: vừa đổi mật khẩu).
    // Để trong context thay vì state của router vì ProtectedRoute tự chuyển trang khi user mất và sẽ ghi đè state.
    const [notice, setNotice] = useState('');
    const [initializing, setInitializing] = useState(() => Boolean(storage.getRefreshToken()));

    // Xóa phiên: bỏ token, bỏ user và bỏ cache dữ liệu cá nhân (giỏ hàng, đơn hàng... của người cũ)
    const clearSession = useCallback(() => {
      storage.clear();
      setUser(null);
      queryClient.clear();
    }, [queryClient]);

    // Báo backend thu hồi refresh token; lỗi mạng vẫn bỏ qua vì mục tiêu chính là thoát phiên ở máy này
    const revokeSession = useCallback(async () => {
      const refreshToken = storage.getRefreshToken();
      try {
        if (refreshToken) await api.post('/auth/logout', { refreshToken });
      } catch {
        // Bỏ qua
      }
    }, []);

    // Khi không thể làm mới token nữa, shared/createApiClient sẽ gọi hàm này
    useEffect(() => {
      setAuthFailureHandler(clearSession);
    }, [clearSession]);

    // Khôi phục phiên khi tải lại trang (US-03 AC1)
    useEffect(() => {
      if (!storage.getRefreshToken()) return undefined;
      let cancelled = false; // tránh cập nhật state khi component đã bị gỡ (StrictMode chạy effect hai lần)
      api
        .get('/users/me')
        .then(async (res) => {
          if (cancelled) return;
          if (isAllowed(res.data)) {
            setUser(res.data);
          } else {
            // Phiên còn sống nhưng không thuộc ứng dụng này (ví dụ khách hàng mở trang Admin)
            await revokeSession();
            clearSession();
          }
        })
        .catch(() => {
          // Lỗi 401 đã được xử lý trong createApiClient; lỗi mạng thì giữ token để thử lại lần sau
        })
        .finally(() => {
          if (!cancelled) setInitializing(false);
        });
      return () => {
        cancelled = true;
      };
    }, [clearSession, revokeSession]);

    // Lưu token và user sau khi đăng nhập/đăng ký thành công
    const startSession = useCallback(
      async (data) => {
        if (!isAllowed(data.user)) {
          // Đã đăng nhập đúng nhưng không được vào: thu hồi ngay phiên vừa tạo ở backend
          storage.setTokens(data);
          await revokeSession();
          storage.clear();
          throw new UserFacingError(notAllowedMessage);
        }
        storage.setTokens(data);
        setNotice('');
        setUser(data.user);
        return data.user;
      },
      [revokeSession],
    );

    const login = useCallback(
      async (email, password) =>
        startSession((await api.post('/auth/login', { email, password })).data),
      [startSession],
    );

    const register = useCallback(
      async (payload) => startSession((await api.post('/auth/register', payload)).data),
      [startSession],
    );

    /** @param {string} [message] Thông báo hiện ở trang đăng nhập sau khi đăng xuất */
    const logout = useCallback(
      async (message = '') => {
        await revokeSession();
        setNotice(message);
        clearSession();
      },
      [revokeSession, clearSession],
    );

    const clearNotice = useCallback(() => setNotice(''), []);

    const value = useMemo(
      () => ({ user, initializing, notice, login, register, logout, clearNotice, setUser }),
      [user, initializing, notice, login, register, logout, clearNotice],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  }

  const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
    return context;
  };

  return { AuthProvider, useAuth };
};
