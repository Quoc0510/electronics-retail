/**
 * @feature [F00][F01][F02] Nền tảng, Phân quyền, Danh mục/Thương hiệu - Khai báo các trang của Admin.
 * Mỗi tính năng quản trị mới sẽ thêm <Route> vào nhóm được bảo vệ (F03 quản lý sản phẩm, F07 quản lý đơn hàng...).
 */
import { Routes, Route } from 'react-router-dom';
import AdminLayout from './components/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import BrandsPage from './pages/BrandsPage.jsx'; // [F02]
import CategoriesPage from './pages/CategoriesPage.jsx'; // [F02]
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />

      {/* Mọi trang dưới đây yêu cầu đăng nhập bằng tài khoản quản trị */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<DashboardPage />} />
          {/* [F02] Quản lý danh mục và thương hiệu */}
          <Route path="/danh-muc" element={<CategoriesPage />} />
          <Route path="/thuong-hieu" element={<BrandsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
