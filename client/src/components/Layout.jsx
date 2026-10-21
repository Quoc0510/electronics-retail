/**
 * @feature [F01] Xác thực (frontend) - Khung chung của mọi trang: thanh trên cùng, nội dung, chân trang.
 * Thanh trên cùng đổi theo trạng thái đăng nhập: chưa đăng nhập thấy Đăng nhập/Đăng ký, đã đăng nhập thấy tên và Đăng xuất.
 */
import { Link, Outlet } from 'react-router-dom';
import { Button } from '@techstore/shared';
import { useAuth } from '../context/AuthContext.jsx';

function Header() {
  const { user, initializing, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="text-xl font-bold text-blue-600">
          TechStore
        </Link>

        <nav aria-label="Tài khoản" className="flex items-center gap-3 text-sm">
          {initializing ? null : user ? (
            <>
              <Link to="/tai-khoan" className="font-medium text-slate-700 hover:text-blue-600">
                Xin chào, {user.fullName}
              </Link>
              <Button variant="secondary" onClick={() => logout()}>
                Đăng xuất
              </Button>
            </>
          ) : (
            <>
              <Link to="/dang-nhap" className="font-medium text-slate-700 hover:text-blue-600">
                Đăng nhập
              </Link>
              <Link
                to="/dang-ky"
                className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
              >
                Đăng ký
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-sm text-slate-500">
        © 2026 TechStore - Đồ án môn học Công nghệ phần mềm
      </footer>
    </div>
  );
}
