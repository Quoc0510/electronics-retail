/**
 * @feature [F07] Quản lý đơn hàng - Trang /don-hang (yêu cầu đăng nhập): lịch sử đơn của chính khách (US-17 AC1).
 *  - Mới nhất trước; lọc theo trạng thái và phân trang đều nằm trên URL (?status=PENDING&page=2) nên tải lại,
 *    chia sẻ hay bấm Back đều đúng kết quả.
 *  - Mỗi đơn hiện mã, ngày đặt, trạng thái, vài sản phẩm đầu và tổng tiền; bấm vào để xem chi tiết và theo dõi.
 *  - Đủ trạng thái biên: khung chờ, lỗi kèm Thử lại, chưa có đơn nào, lọc không ra đơn, trang vượt quá số trang.
 */
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  IconBag,
  IconChevronRight,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  formatDateTime,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { api, assetUrl } from '../lib/api.js';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 10;

// Tham số URL sai (status lạ, page=abc) thì về mặc định thay vì làm hỏng trang
const readFilters = (params) => {
  const status = ORDER_STATUSES.includes(params.get('status')) ? params.get('status') : '';
  const page = Number.parseInt(params.get('page'), 10);
  return { status, page: Number.isInteger(page) && page >= 1 ? page : 1 };
};

function OrderCard({ order }) {
  return (
    <li>
      <Link
        to={`/don-hang/${order.code}`}
        className="group block space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-base font-bold text-slate-900">{order.code}</p>
            <p className="text-xs text-slate-500">Đặt lúc {formatDateTime(order.createdAt)}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
          >
            {ORDER_STATUS_LABELS[order.status]}
          </span>
        </div>

        <ul className="flex flex-wrap items-center gap-3">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`} className="flex items-center gap-2 text-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                {item.thumbnail ? (
                  <img
                    src={assetUrl(item.thumbnail)}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <IconBag size={16} className="text-slate-400" />
                )}
              </span>
              <span className="flex max-w-80 items-baseline gap-1 text-slate-700">
                <span className="truncate">{item.productName}</span>
                <span className="shrink-0 text-slate-500">× {item.quantity}</span>
              </span>
            </li>
          ))}
          {order.moreItems > 0 && (
            <li className="text-sm text-slate-500">và {order.moreItems} sản phẩm khác</li>
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-600">{order.itemCount} sản phẩm</span>
          <span className="flex items-center gap-3">
            <span>
              Tổng tiền{' '}
              <strong className="font-display text-lg text-rose-600">
                {formatVnd(order.total)}
              </strong>
            </span>
            <IconChevronRight
              size={18}
              className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-500"
            />
          </span>
        </div>
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Đang tải đơn hàng" className="space-y-4">
      {[0, 1, 2].map((n) => (
        <div key={n} className="skeleton h-36 rounded-2xl" />
      ))}
    </div>
  );
}

export default function OrderListPage() {
  const [params, setParams] = useSearchParams();
  const { status, page } = readFilters(params);

  useEffect(() => {
    document.title = 'Đơn hàng của tôi - TechStore';
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, []);

  const orders = useQuery({
    queryKey: ['orders', 'list', status, page],
    queryFn: () =>
      api
        .get('/orders', { params: { pageSize: PAGE_SIZE, page, ...(status ? { status } : {}) } })
        .then((res) => res.data),
    // Đổi bộ lọc thì giữ danh sách cũ trên màn hình trong lúc tải, không nhấp nháy
    placeholderData: keepPreviousData,
  });

  // Bộ lọc và trang nằm trên URL: trang 1 và "Tất cả" không ghi tham số cho URL gọn
  const paramsFor = (nextPage, nextStatus = status) => {
    const next = new URLSearchParams();
    if (nextStatus) next.set('status', nextStatus);
    if (nextPage > 1) next.set('page', String(nextPage));
    return next;
  };
  const linkFor = (nextPage, nextStatus = status) => {
    const query = paramsFor(nextPage, nextStatus).toString();
    return query ? `/don-hang?${query}` : '/don-hang';
  };

  const total = orders.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Đơn hàng của tôi</h1>

      <nav aria-label="Lọc theo trạng thái">
        <ul className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'Tất cả' },
            ...ORDER_STATUSES.map((value) => ({ value, label: ORDER_STATUS_LABELS[value] })),
          ].map((tab) => (
            <li key={tab.value || 'all'}>
              <button
                type="button"
                aria-pressed={status === tab.value}
                onClick={() => setParams(paramsFor(1, tab.value))}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  status === tab.value
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {orders.isPending && <ListSkeleton />}

      {orders.isError && !orders.data && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(orders.error)}</Alert>
          <Button variant="secondary" onClick={() => orders.refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {orders.data && orders.data.items.length === 0 && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <IconBag size={30} />
          </span>
          {total > 0 ? (
            <>
              <p className="text-slate-700">Trang này không có đơn hàng.</p>
              <Link to={linkFor(1)} className="font-semibold text-brand-600 hover:underline">
                Về trang đầu
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900">
                {status
                  ? `Không có đơn hàng nào ở trạng thái "${ORDER_STATUS_LABELS[status]}"`
                  : 'Bạn chưa có đơn hàng nào'}
              </h2>
              <Link
                to="/san-pham"
                className="rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110"
              >
                Bắt đầu mua sắm
              </Link>
            </>
          )}
        </div>
      )}

      {orders.data && orders.data.items.length > 0 && (
        <>
          <p role="status" className="text-sm text-slate-500">
            {total} đơn hàng
          </p>
          <ul className="space-y-4">
            {orders.data.items.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
          <Pagination page={page} totalPages={totalPages} linkFor={linkFor} />
        </>
      )}
    </div>
  );
}
