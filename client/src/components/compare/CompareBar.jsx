/**
 * @feature [F12] So sánh sản phẩm - Thanh nổi ở đáy màn hình hiện các sản phẩm đã chọn, lối vào trang so sánh.
 * Chỉ hiện khi đã chọn ít nhất 1 sản phẩm và không hiện ở chính trang so sánh. Cần >= 2 sản phẩm mới so sánh được.
 * Chiều cao cố định (COMPARE_BAR_HEIGHT) để thanh giá dính ở trang chi tiết biết cách chừa chỗ.
 */
import { Link, useLocation } from 'react-router-dom';
import { IconClose, IconCompare } from '@techstore/shared';
import { assetUrl } from '../../lib/api.js';
import { COMPARE_MAX, useCompare } from '../../context/CompareContext.jsx';

export default function CompareBar() {
  const { items, remove, clear, notice, dismissNotice } = useCompare();
  const { pathname } = useLocation();

  if (items.length === 0 || pathname === '/so-sanh') return null;
  const canCompare = items.length >= 2;

  return (
    <section
      aria-label="Sản phẩm đang so sánh"
      className="surface-dark fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-900/95 text-white shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.5)] backdrop-blur animate-fade-up"
    >
      {notice && (
        <p
          role="status"
          className="flex items-center justify-between gap-3 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-200"
        >
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={dismissNotice}
            className="rounded-full p-1 hover:bg-white/10"
          >
            <IconClose size={14} />
          </button>
        </p>
      )}
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-3 px-4">
        <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {items.map((item) => (
            <li
              key={item.slug}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1 pl-1 pr-2"
            >
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                {item.thumbnail ? (
                  <img
                    src={assetUrl(item.thumbnail)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <IconCompare size={16} className="text-slate-400" />
                )}
              </span>
              <span className="hidden max-w-32 truncate text-xs font-medium sm:block">
                {item.name}
              </span>
              <button
                type="button"
                aria-label={`Bỏ ${item.name} khỏi so sánh`}
                onClick={() => remove(item.slug)}
                className="rounded-full p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <IconClose size={14} />
              </button>
            </li>
          ))}
        </ul>

        <p className="hidden text-xs text-slate-400 md:block">
          {items.length}/{COMPARE_MAX} sản phẩm
          {!canCompare && ' · chọn thêm ít nhất 1 sản phẩm'}
        </p>
        <button
          type="button"
          onClick={clear}
          className="shrink-0 text-xs font-semibold text-slate-300 underline-offset-2 hover:text-white hover:underline"
        >
          Xóa tất cả
        </button>
        {canCompare ? (
          <Link
            to="/so-sanh"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-glow transition hover:brightness-110"
          >
            <IconCompare size={16} />
            So sánh ({items.length})
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="inline-flex shrink-0 cursor-not-allowed items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-slate-400"
          >
            <IconCompare size={16} />
            So sánh ({items.length})
          </span>
        )}
      </div>
    </section>
  );
}
