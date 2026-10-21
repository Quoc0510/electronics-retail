/**
 * @feature [F00] Nền tảng - Khai báo các trang của Admin.
 * Mỗi tính năng quản trị mới sẽ thêm <Route> ở đây (F03 quản lý sản phẩm, F07 quản lý đơn hàng...).
 */
import { Routes, Route } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
