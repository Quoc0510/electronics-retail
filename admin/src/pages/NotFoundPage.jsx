/**
 * @feature [F00] Nền tảng - Trang 404 của Admin khi vào đường dẫn không tồn tại.
 */
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <h1 className="text-5xl font-bold text-slate-900">404</h1>
      <p className="text-slate-600">Trang bạn tìm không tồn tại.</p>
      <Link to="/" className="text-blue-600 underline">
        Về trang tổng quan
      </Link>
    </div>
  );
}
