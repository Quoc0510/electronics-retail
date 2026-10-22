/**
 * @feature [F01] Xác thực (frontend) - Chặn trang yêu cầu đăng nhập (US-14 AC1: chưa đăng nhập thì chuyển
 * tới trang đăng nhập rồi quay lại trang đang xem).
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  // Đang xác minh phiên cũ: chưa biết đã đăng nhập hay chưa nên chưa chuyển trang
  if (initializing) {
    return <p className="py-16 text-center text-slate-500">Đang tải...</p>;
  }

  // Lưu trang hiện tại vào state để đăng nhập xong quay lại đúng chỗ
  if (!user) return <Navigate to="/dang-nhap" state={{ from: location }} replace />;

  return <Outlet />;
}
