/**
 * @feature [F00][F01][F04][F12] Nền tảng, Xác thực, Duyệt sản phẩm, So sánh - Khai báo các trang của Client.
 * Mỗi tính năng mới sẽ thêm <Route> tương ứng ở đây (F04 danh sách sản phẩm, F05 giỏ hàng...).
 */
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { CompareProvider } from './context/CompareContext.jsx'; // [F12]
import ProtectedRoute from './components/ProtectedRoute.jsx';
import ComparePage from './pages/ComparePage.jsx'; // [F12]
import HomePage from './pages/HomePage.jsx';
import AboutPage from './pages/info/AboutPage.jsx'; // [F12]
import ContactPage from './pages/info/ContactPage.jsx'; // [F12]
import FaqPage from './pages/info/FaqPage.jsx'; // [F12]
import PolicyPage from './pages/info/PolicyPage.jsx'; // [F12]
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import ProductDetailPage from './pages/ProductDetailPage.jsx'; // [F04]
import ProductListPage from './pages/ProductListPage.jsx'; // [F04]
import ProfilePage from './pages/ProfilePage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';

export default function App() {
  return (
    <CompareProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          {/* [F04] Duyệt sản phẩm */}
          <Route path="/san-pham" element={<ProductListPage />} />
          <Route path="/san-pham/:slug" element={<ProductDetailPage />} />
          <Route path="/so-sanh" element={<ComparePage />} /> {/* [F12] */}
          {/* [F12] Trang thông tin */}
          <Route path="/gioi-thieu" element={<AboutPage />} />
          <Route path="/lien-he" element={<ContactPage />} />
          <Route path="/cau-hoi-thuong-gap" element={<FaqPage />} />
          <Route path="/chinh-sach" element={<PolicyPage />} />
          <Route path="/chinh-sach/:slug" element={<PolicyPage />} />
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route path="/dang-ky" element={<RegisterPage />} />
          {/* Các trang dưới đây yêu cầu đăng nhập */}
          <Route element={<ProtectedRoute />}>
            <Route path="/tai-khoan" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </CompareProvider>
  );
}
