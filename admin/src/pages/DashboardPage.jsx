/**
 * @feature [F00][F01][F04][F07] Trang tổng quan của Admin: số liệu nhanh (sản phẩm, danh mục, thương hiệu), lối tắt thao tác
 * và trạng thái kết nối máy chủ. Thống kê doanh thu, đơn hàng sẽ được làm ở F10.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  IconArrowRight,
  IconBag,
  IconBox,
  IconGrid,
  IconLayers,
  IconPlus,
} from '@techstore/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';

function StatCard({ label, value, Icon, tone, to }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
    >
      <span
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md`}
      >
        <Icon size={26} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="font-display text-3xl font-bold text-slate-900">
          {value ?? <span className="skeleton inline-block h-8 w-12 rounded align-middle" />}
        </p>
      </div>
      <IconArrowRight
        size={18}
        className="ml-auto text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-500"
      />
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  // Gọi trang đầu với pageSize=1 chỉ để lấy tổng số sản phẩm (trường total), không tải dữ liệu thừa
  const products = useQuery({
    queryKey: ['/admin/products', 'count'],
    queryFn: () =>
      api.get('/admin/products', { params: { pageSize: 1 } }).then((res) => res.data.total),
  });
  // [F07] Số đơn đang chờ xác nhận: lấy tổng (total) của trang đầu với pageSize=1
  const pendingOrders = useQuery({
    queryKey: ['/admin/orders', 'pending-count'],
    queryFn: () =>
      api
        .get('/admin/orders', { params: { status: 'PENDING', pageSize: 1 } })
        .then((res) => res.data.total),
  });
  const categories = useQuery({
    queryKey: ['/admin/categories', 'all'],
    queryFn: () => api.get('/admin/categories').then((res) => res.data),
  });
  const brands = useQuery({
    queryKey: ['/admin/brands', 'all'],
    queryFn: () => api.get('/admin/brands').then((res) => res.data),
  });
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then((res) => res.data),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tổng quan"
        description={`Xin chào ${user.fullName}, chúc bạn một ngày làm việc hiệu quả.`}
      >
        <span
          role="status"
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            health.isError ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${health.isError ? 'bg-rose-500' : 'bg-emerald-500'}`}
          />
          {health.isPending && 'Đang kết nối máy chủ...'}
          {health.isError && 'Không kết nối được máy chủ'}
          {health.data && `Máy chủ: ${health.data.status}`}
        </span>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Đơn chờ xác nhận"
          value={pendingOrders.data}
          Icon={IconBag}
          tone="from-amber-500 to-orange-600"
          to="/don-hang"
        />
        <StatCard
          label="Sản phẩm"
          value={products.data}
          Icon={IconBox}
          tone="from-brand-500 to-violet-600"
          to="/san-pham"
        />
        <StatCard
          label="Danh mục"
          value={categories.data?.length}
          Icon={IconGrid}
          tone="from-cyan-500 to-blue-600"
          to="/danh-muc"
        />
        <StatCard
          label="Thương hiệu"
          value={brands.data?.length}
          Icon={IconLayers}
          tone="from-emerald-500 to-teal-600"
          to="/thuong-hieu"
        />
      </div>

      <section aria-labelledby="quick-heading" className="space-y-3">
        <h2 id="quick-heading" className="text-lg font-bold text-slate-900">
          Thao tác nhanh
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/san-pham/them"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:shadow-glow hover:brightness-110"
          >
            <IconPlus size={18} />
            Thêm sản phẩm mới
          </Link>
          <Link
            to="/danh-muc"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
          >
            Quản lý danh mục
          </Link>
          <Link
            to="/thuong-hieu"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
          >
            Quản lý thương hiệu
          </Link>
        </div>
      </section>
    </div>
  );
}
