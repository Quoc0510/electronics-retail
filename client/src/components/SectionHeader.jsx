/**
 * @feature [F04] Tiêu đề một khối nội dung (ví dụ "Sản phẩm mới") kèm mô tả ngắn và liên kết "Xem tất cả".
 */
import { Link } from 'react-router-dom';
import { IconArrowRight } from '@techstore/shared';

export default function SectionHeader({ id, title, subtitle, to, linkLabel = 'Xem tất cả' }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-2xl font-bold text-slate-900 md:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {to && (
        <Link
          to={to}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand-600 transition hover:gap-2 hover:text-brand-800"
        >
          {linkLabel}
          <IconArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
