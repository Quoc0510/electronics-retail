/**
 * @feature [F01] Phân quyền (frontend) - Khung chung của các trang Admin: thanh trên cùng có tên người dùng và nút Đăng xuất.
 * Các tính năng sau (F02 danh mục, F03 sản phẩm...) sẽ thêm menu điều hướng vào đây.
 */
import { Outlet } from 'react-router-dom';
import { Button } from '@techstore/shared';
import { useAuth } from '../context/AuthContext.jsx';

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
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
