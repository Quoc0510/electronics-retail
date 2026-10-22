/**
 * @feature [F00][F01] Nền tảng, Xác thực - Khai báo các trang của Client.
 * Mỗi tính năng mới sẽ thêm <Route> tương ứng ở đây (F04 danh sách sản phẩm, F05 giỏ hàng...).
 */
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />

        {/* Các trang dưới đây yêu cầu đăng nhập */}
        <Route element={<ProtectedRoute />}>
          <Route path="/tai-khoan" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
