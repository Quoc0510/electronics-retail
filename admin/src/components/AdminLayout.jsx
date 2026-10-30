/**
 * @feature [F01][F02][F03][F04][F07][F08][F09][F10] Khung chung của các trang Admin: thanh bên tối có menu và thông tin người dùng.
 * Trên màn hình rộng thanh bên luôn hiện; trên điện thoại nó là ngăn kéo mở bằng nút menu ở thanh trên cùng.
 * Mỗi tính năng quản trị mới thêm một mục vào MENU_ITEMS.
 */
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Button,
  IconBag,
  IconBox,
  IconClose,
  IconGrid,
  IconHome,
  IconLayers,
  IconLogOut,
  IconMenu,
  IconStar,
  IconTag,
  IconUsers,
  Logo,
  ThemeToggle,
} from '@techstore/shared';
import { useAuth } from '../context/AuthContext.jsx';

const MENU_ITEMS = [
  { to: '/', label: 'Tổng quan', end: true, Icon: IconHome },
  { to: '/don-hang', label: 'Đơn hàng', Icon: IconBag }, // [F07]
  { to: '/danh-muc', label: 'Danh mục', Icon: IconGrid }, // [F02]
  { to: '/thuong-hieu', label: 'Thương hiệu', Icon: IconLayers }, // [F02]
  { to: '/san-pham', label: 'Sản phẩm', Icon: IconBox }, // [F03]
  { to: '/danh-gia', label: 'Đánh giá', Icon: IconStar }, // [F08]
  { to: '/ma-giam-gia', label: 'Mã giảm giá', Icon: IconTag }, // [F09]
  { to: '/nguoi-dung', label: 'Người dùng', Icon: IconUsers }, // [F10]
];

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-glow'
      : 'text-slate-300 hover:bg-white/10 hover:text-white'
  }`;

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Chuyển trang thì cuộn về đầu trang
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_1fr] print:block">
      {/* Nền mờ phía sau ngăn kéo trên điện thoại */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`surface-dark print:hidden fixed inset-y-0 left-0 z-50 flex w-66 flex-col bg-ink-900 text-slate-300 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="space-y-1">
            <Logo />
            <p className="pl-[3.125rem] text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Quản trị
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMenuOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 lg:hidden"
          >
            <IconClose size={20} />
          </button>
        </div>

        <nav aria-label="Menu quản trị" className="flex-1 space-y-1 px-3 py-2">
          {MENU_ITEMS.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={linkClass}
              // Chọn một mục thì đóng ngăn kéo trên điện thoại
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 font-bold text-white">
              {user.fullName.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 !border-white/15 !bg-white/5 !text-slate-200 hover:!bg-white/10"
              onClick={() => logout()}
            >
              <IconLogOut size={16} />
              Đăng xuất
            </Button>
            <ThemeToggle className="!h-9 !w-9 border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Thanh trên cùng chỉ hiện trên điện thoại: nút mở menu */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            <IconMenu size={20} />
          </button>
          <Logo tone="dark" />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
