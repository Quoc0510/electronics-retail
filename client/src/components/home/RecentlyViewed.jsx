/**
 * @feature [F12] Trang chủ - Khối "Sản phẩm bạn đã xem" (đọc từ localStorage, chỉ hiện khi có lịch sử).
 * Dùng thẻ gọn (ảnh + tên + thương hiệu) cuộn ngang được; có nút xóa lịch sử.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IconHistory } from '@techstore/shared';
import { assetUrl } from '../../lib/api.js';
import { clearRecent, getRecent } from '../../lib/recentlyViewed.js';

export default function RecentlyViewed() {
  const [items, setItems] = useState(getRecent);

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="recent-heading" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2
          id="recent-heading"
          className="flex items-center gap-2 text-2xl font-bold text-slate-900 md:text-3xl"
        >
          <IconHistory size={26} className="text-brand-500" />
          Bạn đã xem
        </h2>
        <button
          type="button"
          onClick={() => {
            clearRecent();
            setItems([]);
          }}
          className="text-sm font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline"
        >
          Xóa lịch sử
        </button>
      </div>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {items.map((item) => (
          <li key={item.slug} className="w-44 shrink-0">
            <Link
              to={`/san-pham/${item.slug}`}
              className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover"
            >
              <div className="flex aspect-square items-center justify-center bg-white">
                {item.thumbnail ? (
                  <img
                    src={assetUrl(item.thumbnail)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-400">Chưa có ảnh</span>
                )}
              </div>
              <div className="space-y-0.5 p-3">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-brand-600">
                  {item.brand}
                </p>
                <p className="line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                  {item.name}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
