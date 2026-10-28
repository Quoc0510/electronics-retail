/**
 * @feature [F01][F04] Khu vực tài khoản trên thanh đầu trang.
 *  - Chưa đăng nhập: nút Đăng nhập và Đăng ký.
 *  - Đã đăng nhập: ảnh đại diện chữ cái đầu + tên, bấm mở menu (Tài khoản của tôi, Đăng xuất).
 * Menu đóng khi bấm ra ngoài, nhấn Esc hoặc chọn một mục (chuẩn truy cập bàn phím cho menu thả xuống).
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconBag, IconChevronDown, IconLogOut, IconUser } from '@techstore/shared';
import { useAuth } from '../../context/AuthContext.jsx';

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const initial = user.fullName.trim().charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 text-sm text-white transition hover:bg-white/10"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-sm font-bold">
          {initial}
        </span>
        <span className="hidden max-w-32 truncate font-medium sm:inline">
          Xin chào, {user.fullName}
        </span>
        <IconChevronDown size={16} className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="follow-theme absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-sm text-slate-700 shadow-xl animate-fade-in"
        >
          <p className="truncate border-b border-slate-100 px-4 py-3 text-xs text-slate-500">
            {user.email}
          </p>
          <Link
            role="menuitem"
            to="/tai-khoan"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 hover:bg-brand-50 hover:text-brand-700"
          >
            <IconUser size={16} />
            Tài khoản của tôi
          </Link>
          <Link
            role="menuitem"
            to="/don-hang"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 hover:bg-brand-50 hover:text-brand-700"
          >
            <IconBag size={16} />
            Đơn hàng của tôi
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-rose-50 hover:text-rose-700"
          >
            <IconLogOut size={16} />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

export default function AccountMenu() {
  const { user, initializing, logout } = useAuth();

  // Đang xác minh phiên cũ: chưa biết đã đăng nhập hay chưa nên chưa hiện gì để tránh nháy
  if (initializing) return <div className="h-9 w-24" aria-hidden="true" />;

  if (user) return <UserMenu user={user} onLogout={() => logout()} />;

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        to="/dang-nhap"
        className="rounded-full px-2 py-2 font-medium text-slate-200 sm:px-3 transition hover:bg-white/10 hover:text-white"
      >
        Đăng nhập
      </Link>
      <Link
        to="/dang-ky"
        className="rounded-full bg-gradient-to-r from-brand-500 to-violet-600 px-3 py-2 sm:px-4 font-semibold text-white shadow-sm transition hover:brightness-110"
      >
        Đăng ký
      </Link>
    </div>
  );
}
