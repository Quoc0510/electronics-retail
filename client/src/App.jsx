/**
 * @feature [F00][F01][F04][F05][F06][F12][F13] Nền tảng, Xác thực, Duyệt sản phẩm, Giỏ hàng, Đặt hàng, So sánh, Đặt hàng không cần đăng nhập - Khai báo các trang của Client.
 * Mỗi tính năng mới sẽ thêm <Route> tương ứng ở đây (F04 danh sách sản phẩm, F05 giỏ hàng...).
 */
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { CompareProvider } from './context/CompareContext.jsx'; // [F12]
import ProtectedRoute from './components/ProtectedRoute.jsx';
import CartPage from './pages/CartPage.jsx'; // [F05]
import CheckoutPage from './pages/CheckoutPage.jsx'; // [F06]
import ComparePage from './pages/ComparePage.jsx'; // [F12]
import HomePage from './pages/HomePage.jsx';
import AboutPage from './pages/info/AboutPage.jsx'; // [F12]
import ContactPage from './pages/info/ContactPage.jsx'; // [F12]
import FaqPage from './pages/info/FaqPage.jsx'; // [F12]
import PolicyPage from './pages/info/PolicyPage.jsx'; // [F12]
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import OrderListPage from './pages/OrderListPage.jsx'; // [F07]
import OrderLookupPage from './pages/OrderLookupPage.jsx'; // [F13]
import OrderPage from './pages/OrderPage.jsx'; // [F06]
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
          {/* [F05] Giỏ hàng xem được khi chưa đăng nhập (giỏ lưu trên trình duyệt) */}
          <Route path="/gio-hang" element={<CartPage />} />
          {/* [F13] Đặt hàng, xem đơn vừa đặt và tra cứu đơn đều không cần đăng nhập (BR-11); đăng nhập chỉ để tích điểm (BR-15) */}
          <Route path="/dat-hang" element={<CheckoutPage />} /> {/* [F06] */}
          <Route path="/don-hang/:code" element={<OrderPage />} /> {/* [F06] */}
          <Route path="/tra-cuu-don-hang" element={<OrderLookupPage />} />
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
            <Route path="/don-hang" element={<OrderListPage />} /> {/* [F07] */}
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </CompareProvider>
  );
}
