/**
 * @feature [F04] Duyệt và tìm sản phẩm - Phân trang bằng các liên kết (US-11 AC3, AC4).
 * Mỗi trang là một đường dẫn thật (?page=2) nên chia sẻ, tải lại hay quay lại bằng trình duyệt đều đúng trang.
 */
import { Link } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight } from '@techstore/shared';

// Hiện trang đầu, trang cuối và các trang quanh trang hiện tại; chỗ bị lược bằng "…"
const pageList = (current, total) => {
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('gap');
    result.push(page);
  });
  return result;
};

/**
 * @param {number} page Trang hiện tại (bắt đầu từ 1)
 * @param {number} totalPages Tổng số trang
 * @param {(page: number) => string} linkFor Tạo đường dẫn cho một trang, giữ nguyên các bộ lọc khác
 */
export default function Pagination({ page, totalPages, linkFor }) {
  if (totalPages <= 1) return null;

  const base =
    'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-xl border px-3 text-sm font-medium transition';
  const idle = `${base} border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700`;
  const disabled = `${base} cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400`;

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link to={linkFor(page - 1)} className={idle}>
          <IconChevronLeft size={16} />
          Trang trước
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          <IconChevronLeft size={16} />
          Trang trước
        </span>
      )}

      {pageList(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={item}
            to={linkFor(item)}
            aria-label={`Trang ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={
              item === page
                ? `${base} border-transparent bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-glow`
                : idle
            }
          >
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link to={linkFor(page + 1)} className={idle}>
          Trang sau
          <IconChevronRight size={16} />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled}>
          Trang sau
          <IconChevronRight size={16} />
        </span>
      )}
    </nav>
  );
}
