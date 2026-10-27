/**
 * @feature [F12] Trang thông tin - Khung chung của các trang Giới thiệu, Liên hệ, Hỏi đáp, Chính sách:
 * đường dẫn (breadcrumb), tiêu đề, mô tả ngắn và (trên màn hình rộng) cột điều hướng giữa các trang thông tin.
 */
import { useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { IconChevronRight } from '@techstore/shared';
import { INFO_LINKS } from '../../lib/storeInfo.js';

const navClass = ({ isActive }) =>
  `block rounded-xl px-4 py-2.5 text-sm font-medium transition ${
    isActive
      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

export default function InfoLayout({ title, description, crumbs = [], children }) {
  // Tiêu đề tab trình duyệt theo trang
  useEffect(() => {
    document.title = `${title} - TechStore`;
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, [title]);

  return (
    <div className="space-y-6">
      <nav
        aria-label="Đường dẫn"
        className="flex flex-wrap items-center gap-1.5 text-sm text-slate-500"
      >
        <Link to="/" className="hover:text-brand-700">
          Trang chủ
        </Link>
        {crumbs.map((crumb) => (
          <span key={crumb.label} className="flex items-center gap-1.5">
            <IconChevronRight size={14} />
            {crumb.to ? (
              <Link to={crumb.to} className="hover:text-brand-700">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-medium text-slate-700">
                {crumb.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        <aside className="hidden lg:block">
          <nav aria-label="Trang thông tin" className="sticky top-36 space-y-1">
            {INFO_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} className={navClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-8">
          <header className="space-y-2">
            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">{title}</h1>
            {description && <p className="max-w-2xl text-slate-600">{description}</p>}
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
