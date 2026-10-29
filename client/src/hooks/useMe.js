/**
 * @feature [F13] Điểm thành viên - Thông tin tài khoản mới nhất của người đang đăng nhập (điểm và tổng tiền đã mua).
 * Hai số này đổi khi Admin hoàn thành đơn, còn bản `user` lưu lúc đăng nhập thì cũ, nên tải lại từ GET /users/me
 * (dùng chung khóa cache ['me'] với trang hồ sơ). Chưa đăng nhập thì không gọi API và trả về 0.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useMe() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get('/users/me').then((res) => res.data),
    enabled: Boolean(user),
    placeholderData: user ?? undefined,
  });
  const me = user ? (data ?? user) : null;
  return { me, points: me?.points ?? 0, totalSpent: me?.totalSpent ?? 0 };
}
