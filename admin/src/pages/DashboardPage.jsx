/**
 * @feature [F00][F01][F04][F07][F10] Trang tổng quan của Admin: thống kê kinh doanh 30 ngày (US-26: doanh thu theo ngày,
 * đơn theo trạng thái, sản phẩm bán chạy, tồn kho thấp), số liệu danh mục, lối tắt thao tác và trạng thái kết nối máy chủ.
 * Thống kê và số liệu danh mục tải độc lập: một khối lỗi không làm hỏng các khối còn lại.
 */
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  IconArrowRight,
  IconBag,
  IconBox,
  IconCash,
  IconCheckCircle,
  IconGrid,
  IconLayers,
  IconPlus,
  IconUsers,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import RevenueChart from '../components/RevenueChart.jsx';

function StatCard({ label, value, hint, Icon, tone, to }) {
  // Biểu tượng và nhãn ở hàng trên, số liệu chiếm cả bề ngang bên dưới để số tiền lớn không bị ngắt dòng
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-md`}
        >
          <Icon size={20} />
        </span>
        <p className="min-w-0 flex-1 text-sm text-slate-500">{label}</p>
        {to && (
          <IconArrowRight
            size={16}
            className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand-500"
          />
        )}
      </div>
      <p className="mt-3 whitespace-nowrap font-display text-2xl font-bold text-slate-900 sm:text-3xl">
        {value ?? <span className="skeleton inline-block h-8 w-16 rounded align-middle" />}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const className = 'group block rounded-2xl border border-slate-200 bg-white p-5 shadow-card';
  return to ? (
    <Link
      to={to}
      className={`${className} transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Panel({ id, title, hint, children }) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
    >
      <div className="mb-4">
        <h2 id={id} className="text-lg font-bold text-slate-900">
          {title}
        </h2>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }) => (
  <p className="py-6 text-center text-sm text-slate-500">{children}</p>
);

const Loading = () => (
  <p role="status" className="py-6 text-center text-sm text-slate-500">
    Đang tải...
  </p>
);

export default function DashboardPage() {
  const { user } = useAuth();

  const stats = useQuery({
    queryKey: ['/admin/stats'],
    queryFn: () => api.get('/admin/stats').then((res) => res.data),
  });
  // Gọi trang đầu với pageSize=1 chỉ để lấy tổng số sản phẩm (trường total), không tải dữ liệu thừa
  const products = useQuery({
    queryKey: ['/admin/products', 'count'],
    queryFn: () =>
      api.get('/admin/products', { params: { pageSize: 1 } }).then((res) => res.data.total),
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

  const data = stats.data;
  // Khi thống kê lỗi, thẻ hiện dấu gạch thay vì quay vòng mãi
  const figure = (read) => (data ? read(data) : stats.isError ? '–' : undefined);
  const maxStatusCount = data ? Math.max(1, ...Object.values(data.ordersByStatus)) : 1;

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

      {stats.isError && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(stats.error)}</Alert>
          <Button variant="secondary" onClick={() => stats.refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Doanh thu"
          value={figure((d) => formatVnd(d.summary.revenue))}
          hint={`${data?.days ?? 30} ngày gần nhất, đơn hoàn thành`}
          Icon={IconCash}
          tone="from-emerald-500 to-teal-600"
        />
        <StatCard
          label="Đơn hoàn thành"
          value={figure((d) => d.summary.completedOrders)}
          hint={`${data?.days ?? 30} ngày gần nhất`}
          Icon={IconCheckCircle}
          tone="from-brand-500 to-violet-600"
          to="/don-hang"
        />
        <StatCard
          label="Đơn chờ xác nhận"
          value={figure((d) => d.summary.pendingOrders)}
          Icon={IconBag}
          tone="from-amber-500 to-orange-600"
          to="/don-hang"
        />
        <StatCard
          label="Khách hàng"
          value={figure((d) => d.summary.customers)}
          Icon={IconUsers}
          tone="from-cyan-500 to-blue-600"
          to="/nguoi-dung"
        />
      </div>

      <Panel
        id="revenue-heading"
        title="Doanh thu theo ngày"
        hint="Tính theo ngày đơn chuyển sang Hoàn thành (giờ Việt Nam), không tính đơn chưa hoàn thành hoặc đã hủy"
      >
        {data ? <RevenueChart days={data.revenueByDay} /> : !stats.isError && <Loading />}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel id="status-heading" title="Đơn hàng theo trạng thái" hint="Toàn bộ thời gian">
          {data ? (
            <ul className="space-y-3">
              {ORDER_STATUSES.map((status) => {
                const count = data.ordersByStatus[status];
                return (
                  <li key={status} className="flex items-center gap-3 text-sm">
                    <span
                      className={`w-32 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-semibold ${ORDER_STATUS_STYLES[status]}`}
                    >
                      {ORDER_STATUS_LABELS[status]}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                    >
                      <span
                        className="block h-full rounded-full bg-brand-500"
                        style={{ width: `${(count / maxStatusCount) * 100}%` }}
                      />
                    </span>
                    <span className="w-10 text-right font-semibold text-slate-900">{count}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            !stats.isError && <Loading />
          )}
        </Panel>

        <Panel
          id="top-heading"
          title="Sản phẩm bán chạy"
          hint={`Top 5 theo số lượng, ${data?.days ?? 30} ngày gần nhất, không tính đơn đã hủy`}
        >
          {data && data.topProducts.length === 0 && <Empty>Chưa có đơn hàng nào.</Empty>}
          {data && data.topProducts.length > 0 && (
            <ol className="divide-y divide-slate-100">
              {data.topProducts.map((product, index) => (
                <li key={product.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/san-pham/${product.id}`}
                      className="block truncate font-medium text-slate-900 hover:text-brand-600"
                    >
                      {product.name}
                    </Link>
                    <span className="font-mono text-xs text-slate-500">{product.sku}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">{product.sold} cái</div>
                    <div className="text-xs text-slate-500">{formatVnd(product.revenue)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {!data && !stats.isError && <Loading />}
        </Panel>
      </div>

      <Panel
        id="stock-heading"
        title="Sản phẩm sắp hết hàng"
        hint={data ? `Đang bán và tồn kho từ ${data.lowStock.threshold} trở xuống` : undefined}
      >
        {data && data.lowStock.items.length === 0 && (
          <Empty>Không có sản phẩm nào sắp hết hàng.</Empty>
        )}
        {data && data.lowStock.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">SKU</th>
                    <th className="py-2 pr-4 font-medium">Sản phẩm</th>
                    <th className="py-2 text-right font-medium">Tồn kho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.lowStock.items.map((product) => (
                    <tr key={product.id}>
                      <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-xs text-slate-500">
                        {product.sku}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Link
                          to={`/san-pham/${product.id}`}
                          className="font-medium text-slate-900 hover:text-brand-600"
                        >
                          {product.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap py-2.5 text-right">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            product.stock === 0
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {product.stock === 0 ? 'Hết hàng' : `Còn ${product.stock}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.lowStock.total > data.lowStock.items.length && (
              <p className="mt-3 text-xs text-slate-500">
                Hiển thị {data.lowStock.items.length} trong {data.lowStock.total} sản phẩm, ít hàng
                nhất trước.
              </p>
            )}
          </>
        )}
        {!data && !stats.isError && <Loading />}
      </Panel>

      <section aria-labelledby="catalog-heading" className="space-y-3">
        <h2 id="catalog-heading" className="text-lg font-bold text-slate-900">
          Danh mục hàng hóa
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
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
      </section>

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
