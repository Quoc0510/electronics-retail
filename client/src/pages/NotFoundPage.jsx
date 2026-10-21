/**
 * @feature [F00] Nền tảng - Trang 404 khi người dùng vào đường dẫn không tồn tại.
 */
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6">
      <h1 className="text-5xl font-bold text-slate-900">404</h1>
      <p className="text-slate-600">Trang bạn tìm không tồn tại.</p>
      <Link to="/" className="text-blue-600 underline">
        Về trang chủ
      </Link>
    </main>
  );
}
