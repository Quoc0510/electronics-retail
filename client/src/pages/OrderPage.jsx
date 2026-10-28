/**
 * @feature [F06][F07][F13] Đơn hàng - Trang /don-hang/:code: chi tiết một đơn.
 * Vừa đặt xong (state.justPlaced) thì hiện khung "Đặt hàng thành công" kèm mã đơn (US-16 AC3). Có dòng thời gian trạng thái
 * (US-17 AC2) và, khi đơn còn chờ xác nhận, khung hủy đơn có lý do (US-18); đơn đã hủy hiện lý do hủy.
 * Đơn không tồn tại hoặc của người khác đều hiện "không tìm thấy" (backend trả 404 cho cả hai).
 *
 * [F13] Hai cách xem đơn, cùng một giao diện:
 *  - Thành viên đã đăng nhập: xem đơn của chính mình (GET /orders/:code), kèm điểm thành viên (BR-15).
 *  - Khách không đăng nhập: xem bằng mã đơn + số điện thoại (POST /orders/lookup). Số điện thoại được nhớ trong tab
 *    (lib/guestOrder.js) sau khi đặt hoặc tra cứu; chưa có thì chuyển sang trang tra cứu thay vì bắt đăng nhập.
 */
import { useEffect } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, IconCheckCircle, formatVnd, getErrorMessage } from '@techstore/shared';
import { api, assetUrl } from '../lib/api.js';
import { getGuestOrderPhone } from '../lib/guestOrder.js'; // [F13]
import { useAuth } from '../context/AuthContext.jsx'; // [F13]
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
} from '../lib/orderStatus.js';
import CancelOrderPanel from '../components/order/CancelOrderPanel.jsx'; // [F07]

function Skeleton() {
  return (
    <div role="status" aria-label="Đang tải đơn hàng" className="space-y-4">
      <div className="skeleton h-24 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}

export default function OrderPage() {
  const { code } = useParams();
  const location = useLocation();
  const justPlaced = location.state?.justPlaced === true;
  const queryClient = useQueryClient();
  const { user, initializing } = useAuth();

  // [F13] Có số điện thoại đã nhớ cho mã đơn này thì xem như khách không đăng nhập
  const guestPhone = getGuestOrderPhone(code);
  const isGuestView = Boolean(guestPhone);
  const orderKey = isGuestView ? ['orders', 'guest', code, guestPhone] : ['orders', code];

  const {
    data: order,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: orderKey,
    queryFn: () =>
      (isGuestView
        ? api.post('/orders/lookup', { code, phone: guestPhone })
        : api.get(`/orders/${code}`)
      ).then((res) => res.data),
    // Chưa đăng nhập và chưa có số điện thoại thì chưa có gì để hỏi (xem chuyển trang bên dưới)
    enabled: isGuestView || Boolean(user),
    // Đơn vừa được nạp (trang tra cứu ghi sẵn vào cache) thì không hỏi lại ngay: tra cứu bị giới hạn số lần theo IP
    staleTime: 30_000,
    // Đơn không có (404) hoặc mã sai định dạng (400) thì thử lại cũng vô ích
    retry: (failureCount, err) => ![400, 404].includes(err.response?.status) && failureCount < 1,
  });

  // [F07] Hủy đơn: máy chủ trả lại đơn mới (trạng thái, lý do, lịch sử) nên ghi thẳng vào cache; danh sách đơn tải lại khi mở
  const cancel = useMutation({
    mutationFn: (reason) =>
      (isGuestView
        ? api.post('/orders/lookup/cancel', { code, phone: guestPhone, reason })
        : api.post(`/orders/${code}/cancel`, { reason })
      ).then((res) => res.data),
    onSuccess: (updated) => {
      queryClient.setQueryData(orderKey, updated);
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] });
    },
  });

  useEffect(() => {
    document.title = `Đơn hàng ${code} - TechStore`;
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, [code]);

  // [F13] Chưa đăng nhập và chưa nhớ số điện thoại của đơn này: đưa tới trang tra cứu (có điền sẵn mã đơn)
  if (!isGuestView && !user) {
    if (initializing) return <Skeleton />;
    return <Navigate to={`/tra-cuu-don-hang?code=${encodeURIComponent(code)}`} replace />;
  }

  if (isPending) return <Skeleton />;

  if (isError) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Không tìm thấy đơn hàng</h1>
          <p className="text-slate-600">
            {isGuestView
              ? 'Mã đơn hoặc số điện thoại chưa đúng.'
              : 'Đơn hàng không tồn tại hoặc không phải của bạn.'}
          </p>
          <Link to="/tra-cuu-don-hang" className="font-semibold text-brand-600 hover:underline">
            Tra cứu bằng mã đơn và số điện thoại
          </Link>
          <Link to="/san-pham" className="font-semibold text-brand-600 hover:underline">
            Tiếp tục mua sắm
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <Alert>{getErrorMessage(error)}</Alert>
        <Button variant="secondary" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {justPlaced && (
        <div
          role="status"
          className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"
        >
          <IconCheckCircle size={32} className="shrink-0 text-emerald-600" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold">Đặt hàng thành công!</h2>
            <p>
              Mã đơn hàng của bạn là <strong className="font-mono text-lg">{order.code}</strong>.
              Chúng tôi sẽ xác nhận đơn và giao hàng sớm nhất. Bạn thanh toán khi nhận hàng.
            </p>
            {order.isGuest && (
              <p>
                Hãy ghi lại mã đơn và số điện thoại <strong>{order.phone}</strong> để tra cứu đơn
                sau này. Muốn tích điểm cho các lần mua tiếp theo?{' '}
                <Link to="/dang-ky" className="font-semibold underline underline-offset-2">
                  Đăng ký thành viên
                </Link>
                .
              </p>
            )}
            {order.pointsExpected > 0 && (
              <p>
                Bạn sẽ nhận <strong>{order.pointsExpected} điểm thành viên</strong> khi đơn được
                giao thành công.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-slate-900">
          Đơn hàng <span className="font-mono">{order.code}</span>
        </h1>
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>
      <p className="-mt-3 text-sm text-slate-500">Đặt lúc {formatDateTime(order.createdAt)}</p>

      {order.status === 'CANCELLED' && order.cancelReason && (
        <p
          role="status"
          className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700"
        >
          <strong>Đơn hàng đã được hủy.</strong> Lý do: {order.cancelReason}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <section
          aria-labelledby="items-heading"
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <h2 id="items-heading" className="text-lg font-bold text-slate-900">
            Sản phẩm
          </h2>
          <ul className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <li key={item.id} className="flex gap-4 py-3 text-sm first:pt-0 last:pb-0">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                  {item.thumbnail ? (
                    <img
                      src={assetUrl(item.thumbnail)}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Chưa có ảnh</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/san-pham/${item.slug}`}
                    className="line-clamp-2 font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {item.productName}
                  </Link>
                  <span className="block text-slate-500">Mã: {item.productSku}</span>
                  <span className="block text-slate-500">
                    {formatVnd(item.unitPrice)} × {item.quantity}
                  </span>
                </span>
                <span className="font-semibold text-slate-900">{formatVnd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-6">
          <section
            aria-label="Tổng tiền"
            className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-card"
          >
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-slate-600">Tạm tính</dt>
                <dd className="font-semibold text-slate-900">{formatVnd(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-600">Phí vận chuyển</dt>
                <dd className="font-semibold text-slate-900">
                  {order.shippingFee === 0 ? 'Miễn phí' : formatVnd(order.shippingFee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
                <dt className="font-bold text-slate-900">Tổng thanh toán</dt>
                <dd className="font-display text-xl font-bold text-rose-600">
                  {formatVnd(order.total)}
                </dd>
              </div>
            </dl>
            <p className="pt-2 text-slate-600">
              {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
              <span className="font-semibold">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</span>
            </p>
            {/* [F13] BR-15: điểm thành viên */}
            {order.pointsEarned > 0 && (
              <p className="font-semibold text-emerald-700">
                Đã cộng {order.pointsEarned} điểm thành viên
              </p>
            )}
            {order.pointsExpected > 0 && (
              <p className="font-medium text-brand-700">
                Dự kiến nhận {order.pointsExpected} điểm thành viên khi đơn hoàn thành
              </p>
            )}
            {order.isGuest && order.status !== 'CANCELLED' && (
              <p className="text-slate-500">Đơn đặt khi chưa đăng nhập nên không tích điểm.</p>
            )}
          </section>

          <section
            aria-labelledby="shipping-heading"
            className="space-y-1 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-card"
          >
            <h2 id="shipping-heading" className="text-lg font-bold text-slate-900">
              Giao tới
            </h2>
            <p className="font-semibold text-slate-900">
              {order.recipientName} · {order.phone}
            </p>
            <p className="text-slate-600">{order.shippingAddress}</p>
            {order.note && <p className="pt-2 text-slate-600">Ghi chú: {order.note}</p>}
          </section>

          {order.status === 'PENDING' && (
            <CancelOrderPanel onCancel={(reason) => cancel.mutateAsync(reason)} />
          )}

          <section
            aria-labelledby="history-heading"
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-card"
          >
            <h2 id="history-heading" className="text-lg font-bold text-slate-900">
              Lịch sử đơn hàng
            </h2>
            <ol className="space-y-3 border-l-2 border-brand-200 pl-4">
              {order.history.map((entry, index) => (
                <li key={`${entry.status}-${index}`}>
                  <p className="font-semibold text-slate-900">
                    {ORDER_STATUS_LABELS[entry.status]}
                  </p>
                  <p className="text-slate-500">{formatDateTime(entry.createdAt)}</p>
                  {entry.note && <p className="text-slate-600">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {user && !isGuestView ? (
          <Link to="/don-hang" className="font-semibold text-brand-600 hover:underline">
            Tất cả đơn hàng của tôi
          </Link>
        ) : (
          <Link to="/tra-cuu-don-hang" className="font-semibold text-brand-600 hover:underline">
            Tra cứu đơn hàng khác
          </Link>
        )}
        <Link to="/san-pham" className="font-semibold text-brand-600 hover:underline">
          Tiếp tục mua sắm
        </Link>
      </div>
    </div>
  );
}
