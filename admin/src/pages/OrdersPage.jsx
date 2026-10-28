/**
 * @feature [F07][F13] Quản lý đơn hàng - Trang danh sách đơn của Admin (US-19 AC1): lọc theo trạng thái, tìm theo mã đơn
 * (hoặc tên, số điện thoại người nhận) và phân trang; đơn mới nhất trước. Bấm mã đơn để xem và xử lý.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

const PAGE_SIZE = 10;

const controlClass =
  'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';

export default function OrdersPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Chờ người dùng ngừng gõ 300ms mới tìm; đổi từ khóa thì về trang 1
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      // Chỉ về trang 1 khi từ khóa thật sự đổi: nếu không, bấm "Trang sau" trong 300ms đầu sẽ bị giật về trang 1
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(search && { search }),
    ...(status && { status }),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['/admin/orders', 'list', params],
    queryFn: () => api.get('/admin/orders', { params }).then((res) => res.data),
    // Giữ bảng cũ trong lúc tải kết quả mới, tránh nhấp nháy
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilter = Boolean(search || status);

  return (
    <div className="space-y-4">
      <PageHeader title="Đơn hàng" description="Xem, tìm kiếm và xử lý đơn hàng của khách" />

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Tìm đơn hàng"
          placeholder="Tìm theo mã đơn, tên hoặc số điện thoại..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className={`${controlClass} w-full max-w-sm`}
        />
        <select
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className={controlClass}
        >
          <option value="">Mọi trạng thái</option>
          {ORDER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {isPending && (
        <p role="status" className="text-slate-500">
          Đang tải...
        </p>
      )}
      {isError && !data && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {hasFilter ? 'Không có đơn hàng nào khớp bộ lọc.' : 'Chưa có đơn hàng nào.'}
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Mã đơn</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Khách hàng</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Tổng tiền</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Thanh toán</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Ngày đặt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 [&>tr]:transition [&>tr:hover]:bg-brand-50/40">
                {data.items.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        to={`/don-hang/${order.code}`}
                        className="font-mono font-semibold text-brand-600 hover:underline"
                      >
                        {order.code}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{order.recipientName}</div>
                      <div className="text-xs text-slate-500">
                        {/* [F13] Đơn đặt khi chưa đăng nhập không có tài khoản */}
                        {order.isGuest ? 'Khách không đăng nhập' : order.customer?.email}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {order.itemCount} sản phẩm
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {formatVnd(order.total)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
                      >
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDateTime(order.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            aria-label="Phân trang"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">
              Tổng {data.total} đơn hàng · Trang {data.page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
