/**
 * @feature [F00][F01][F02][F03][F07] Nền tảng, Phân quyền, Danh mục/Thương hiệu, Sản phẩm - Khai báo các trang của Admin.
 * Mỗi tính năng quản trị mới sẽ thêm <Route> vào nhóm được bảo vệ (F03 quản lý sản phẩm, F07 quản lý đơn hàng...).
 */
import { Routes, Route } from 'react-router-dom';
import AdminLayout from './components/AdminLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import BrandsPage from './pages/BrandsPage.jsx'; // [F02]
import CouponsPage from './pages/CouponsPage.jsx'; // [F09]
import CategoriesPage from './pages/CategoriesPage.jsx'; // [F02]
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import OrderDetailPage from './pages/OrderDetailPage.jsx'; // [F07]
import OrdersPage from './pages/OrdersPage.jsx'; // [F07]
import ProductFormPage from './pages/ProductFormPage.jsx'; // [F03]
import ProductsPage from './pages/ProductsPage.jsx'; // [F03]
import ReviewsPage from './pages/ReviewsPage.jsx'; // [F08]
import UsersPage from './pages/UsersPage.jsx'; // [F10]

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
          {/* [F03] Quản lý sản phẩm */}
          <Route path="/san-pham" element={<ProductsPage />} />
          <Route path="/san-pham/them" element={<ProductFormPage />} />
          <Route path="/san-pham/:id" element={<ProductFormPage />} />
          {/* [F07] Quản lý đơn hàng */}
          <Route path="/don-hang" element={<OrdersPage />} />
          <Route path="/don-hang/:code" element={<OrderDetailPage />} />
          {/* [F10] Quản lý người dùng */}
          <Route path="/nguoi-dung" element={<UsersPage />} />
          {/* [F08] Quản lý đánh giá */}
          <Route path="/danh-gia" element={<ReviewsPage />} />
          {/* [F09] Quản lý mã giảm giá */}
          <Route path="/ma-giam-gia" element={<CouponsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
