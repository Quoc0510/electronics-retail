/**
 * @feature [F00][F01] Nền tảng, Phân quyền - Trang tổng quan tạm thời của Admin.
 * Hiện chỉ chào người dùng và kiểm tra kết nối Backend; sẽ được thay bằng dashboard thống kê thật ở F10.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((res) => res.data),
  });

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-slate-900">Tổng quan</h1>
      <p className="text-slate-600">Xin chào {user.fullName}, trang quản trị đang được xây dựng.</p>
      <p className="inline-block rounded-full bg-white px-4 py-1 text-sm shadow-sm" role="status">
        {isPending && 'Đang kết nối máy chủ...'}
        {isError && 'Không kết nối được máy chủ'}
        {data && `Máy chủ: ${data.status}`}
      </p>
    </div>
  );
}
