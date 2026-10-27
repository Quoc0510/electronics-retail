/**
 * @feature [F00][F04] Trang 404 của Admin khi vào đường dẫn không tồn tại.
 */
import { Link } from 'react-router-dom';
import { IconArrowRight } from '@techstore/shared';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <h1 className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text font-display text-8xl font-bold text-transparent">
        404
      </h1>
      <p className="text-slate-600">Trang bạn tìm không tồn tại.</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:gap-3 hover:shadow-glow"
      >
        Về trang tổng quan
        <IconArrowRight size={18} />
      </Link>
    </div>
  );
}
