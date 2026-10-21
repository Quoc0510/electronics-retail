/**
 * @feature [F00] Nền tảng - Khai báo các trang của Client.
 * Mỗi tính năng mới sẽ thêm <Route> tương ứng ở đây (F04 danh sách sản phẩm, F05 giỏ hàng...).
 */
import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
