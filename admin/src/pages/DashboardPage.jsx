/**
 * @feature [F00] Nền tảng - Trang tổng quan tạm thời của Admin, kiểm tra kết nối Backend.
 * Sẽ được thay bằng dashboard thống kê thật ở F10.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export default function DashboardPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((res) => res.data),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold text-slate-900">TechStore Admin</h1>
      <p className="text-slate-600">Trang quản trị cửa hàng - đang xây dựng</p>
      <p className="rounded-full bg-slate-100 px-4 py-1 text-sm" role="status">
        {isPending && 'Đang kết nối máy chủ...'}
        {isError && 'Không kết nối được máy chủ'}
        {data && `Máy chủ: ${data.status}`}
      </p>
    </main>
  );
}
