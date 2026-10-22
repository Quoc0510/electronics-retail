/**
 * @feature [F01] Phân quyền (frontend) - Chặn mọi trang Admin khi chưa đăng nhập bằng tài khoản quản trị (US-05 AC2).
 * Việc kiểm tra vai trò ADMIN đã được AuthContext làm; user có giá trị nghĩa là đủ quyền.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <p className="py-16 text-center text-slate-500">Đang tải...</p>;
  }
  if (!user) return <Navigate to="/dang-nhap" state={{ from: location }} replace />;

  return <Outlet />;
}
