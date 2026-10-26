/**
 * @feature [F01][F02] Khung chung của các trang Admin: thanh trên cùng có tên người dùng, nút Đăng xuất và menu.
 * Các tính năng sau (F03 sản phẩm, F07 đơn hàng...) sẽ thêm mục vào MENU_ITEMS.
 */
import { NavLink, Outlet } from 'react-router-dom';
import { Button } from '@techstore/shared';
import { useAuth } from '../context/AuthContext.jsx';

const MENU_ITEMS = [
  { to: '/', label: 'Tổng quan', end: true },
  { to: '/danh-muc', label: 'Danh mục' }, // [F02]
  { to: '/thuong-hieu', label: 'Thương hiệu' }, // [F02]
  { to: '/san-pham', label: 'Sản phẩm' }, // [F03]
];

export default function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-xl font-bold text-blue-600">TechStore Admin</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-700">{user.fullName}</span>
            <Button variant="secondary" onClick={() => logout()}>
              Đăng xuất
            </Button>
          </div>
        </div>
        <nav aria-label="Menu quản trị" className="mx-auto flex max-w-6xl flex-wrap gap-1 px-4">
          {MENU_ITEMS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
