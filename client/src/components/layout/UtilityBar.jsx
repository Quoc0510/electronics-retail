/**
 * @feature [F12][F13] Thanh tiện ích trên cùng của đầu trang (chỉ hiện từ màn hình vừa trở lên):
 * hotline, giờ làm việc bên trái; lối tắt tới tra cứu đơn hàng (khách không đăng nhập) và các trang thông tin bên phải.
 */
import { Link } from 'react-router-dom';
import { IconClock, IconPhone } from '@techstore/shared';
import { INFO_LINKS, STORE } from '../../lib/storeInfo.js';

export default function UtilityBar() {
  return (
    <div className="hidden border-b border-white/10 bg-ink-950/60 text-xs text-slate-300 md:block">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-1.5">
        <p className="flex items-center gap-4">
          <a href={STORE.hotlineHref} className="flex items-center gap-1.5 hover:text-white">
            <IconPhone size={13} className="text-accent-400" />
            Hotline: <strong className="font-semibold text-white">{STORE.hotline}</strong>
          </a>
          <span className="hidden items-center gap-1.5 lg:flex">
            <IconClock size={13} className="text-accent-400" />
            {STORE.hours}
          </span>
        </p>
        <nav aria-label="Thông tin cửa hàng">
          <ul className="flex items-center gap-5">
            <li>
              <Link to="/tra-cuu-don-hang" className="transition hover:text-white">
                Tra cứu đơn hàng
              </Link>
            </li>
            {INFO_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="transition hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
