/**
 * @feature [F00] Nền tảng - Trang chủ tạm thời, dùng để kiểm tra Client kết nối được Backend.
 * Sẽ được thay bằng trang chủ thật ở F04.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export default function HomePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((res) => res.data),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold text-slate-900">TechStore</h1>
      <p className="text-slate-600">Website bán thiết bị điện tử - đang xây dựng</p>
      <p className="rounded-full bg-slate-100 px-4 py-1 text-sm" role="status">
        {isPending && 'Đang kết nối máy chủ...'}
        {isError && 'Không kết nối được máy chủ'}
        {data && `Máy chủ: ${data.status}`}
      </p>
    </main>
  );
}
