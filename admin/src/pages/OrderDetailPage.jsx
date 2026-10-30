/**
 * @feature [F07][F09][F13] Quản lý đơn hàng - Trang chi tiết đơn của Admin: thông tin khách, sản phẩm, tổng tiền (kèm mã giảm giá), lịch sử và
 * xử lý đơn (US-19 AC2 đến AC4) cùng in phiếu đơn hàng (US-20).
 *  - Chỉ hiện các nút của bước tiếp theo hợp lệ (BR-06, danh sách do máy chủ trả về trong allowedNext); máy chủ vẫn từ chối bước sai.
 *  - Hủy đơn bắt buộc có lý do (kho được hoàn lại, BR-07); hoàn thành đơn COD thì thành "đã thanh toán" (BR-08).
 *  - In phiếu: nút "In phiếu" gọi hộp thoại in của trình duyệt; kiểu in ẩn thanh bên và các nút, chỉ giữ nội dung phiếu.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_STYLES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTime,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { api, assetUrl } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

// Nút cho từng bước tiếp theo (CANCELLED xử lý riêng vì cần lý do)
const STEP_LABELS = {
  CONFIRMED: 'Xác nhận đơn',
  SHIPPING: 'Bắt đầu giao hàng',
  COMPLETED: 'Hoàn thành (đã thu tiền)',
};

function Card({ title, children, className = '' }) {
  return (
    <section
      className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card ${className}`}
    >
      {title && <h2 className="text-lg font-bold text-slate-900">{title}</h2>}
      {children}
    </section>
  );
}

export default function OrderDetailPage() {
  const { code } = useParams();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const {
    data: order,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['/admin/orders', 'detail', code],
    queryFn: () => api.get(`/admin/orders/${code}`).then((res) => res.data),
    retry: (failureCount, err) => ![400, 404].includes(err.response?.status) && failureCount < 1,
  });

  useEffect(() => {
    document.title = `Đơn ${code} - TechStore Admin`;
    return () => {
      document.title = 'TechStore Admin - Quản trị cửa hàng';
    };
  }, [code]);

  const update = useMutation({
    mutationFn: ({ status, note: text }) =>
      api
        .patch(`/admin/orders/${code}/status`, { status, ...(text ? { note: text } : {}) })
        .then((res) => res.data),
    onSuccess: (updated) => {
      // Máy chủ trả lại đơn mới (trạng thái, lịch sử, bước tiếp theo): ghi thẳng vào cache và làm mới danh sách
      queryClient.setQueryData(['/admin/orders', 'detail', code], updated);
      queryClient.invalidateQueries({ queryKey: ['/admin/orders', 'list'] });
      setNote('');
      setCancelling(false);
      setReason('');
    },
  });

  if (isPending) {
    return (
      <p role="status" className="text-slate-500">
        Đang tải...
      </p>
    );
  }

  if (isError) {
    if ([400, 404].includes(error.response?.status)) {
      return (
        <div className="space-y-3">
          <PageHeader title="Không tìm thấy đơn hàng" />
          <Link to="/don-hang" className="font-semibold text-brand-600 hover:underline">
            Về danh sách đơn hàng
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

  const nextSteps = order.allowedNext.filter((status) => status !== 'CANCELLED');
  const canCancel = order.allowedNext.includes('CANCELLED');

  const submitCancel = (event) => {
    event.preventDefault();
    const text = reason.trim();
    if (text.length < 3) {
      setReasonError('Vui lòng nhập lý do hủy đơn (ít nhất 3 ký tự)');
      return;
    }
    setReasonError('');
    update.mutate({ status: 'CANCELLED', note: text });
  };

  return (
    <div className="space-y-6">
      {/* Đầu phiếu chỉ hiện khi in */}
      <div className="hidden print:block">
        <p className="text-2xl font-bold">TechStore</p>
        <p className="text-sm">Phiếu đơn hàng</p>
      </div>

      <div className="print:hidden">
        <Link to="/don-hang" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Tất cả đơn hàng
        </Link>
      </div>

      <PageHeader
        title={`Đơn ${order.code}`}
        description={`Đặt lúc ${formatDateTime(order.createdAt)}`}
      >
        <span
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${ORDER_STATUS_STYLES[order.status]}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="print:hidden"
          onClick={() => window.print()}
        >
          In phiếu
        </Button>
      </PageHeader>

      {order.status === 'CANCELLED' && order.cancelReason && (
        <p
          role="status"
          className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-700"
        >
          <strong>Đơn đã hủy.</strong> Lý do: {order.cancelReason}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem] print:block">
        <div className="space-y-6">
          <Card title="Sản phẩm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Sản phẩm</th>
                    <th className="px-4 py-2 font-medium">Đơn giá</th>
                    <th className="px-4 py-2 font-medium">SL</th>
                    <th className="py-2 pl-4 text-right font-medium">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {item.thumbnail && (
                            <img
                              src={assetUrl(item.thumbnail)}
                              alt=""
                              className="h-12 w-12 rounded-lg object-contain ring-1 ring-slate-200 print:hidden"
                            />
                          )}
                          <div>
                            <div className="font-medium text-slate-900">{item.productName}</div>
                            <div className="text-xs text-slate-500">Mã: {item.productSku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {formatVnd(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                      <td className="py-3 pl-4 text-right font-medium whitespace-nowrap text-slate-900">
                        {formatVnd(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto max-w-xs space-y-2 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-600">Tạm tính</dt>
                <dd className="font-semibold text-slate-900">{formatVnd(order.subtotal)}</dd>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-slate-600">Mã giảm giá ({order.couponCode})</dt>
                  <dd className="font-semibold text-emerald-700">-{formatVnd(order.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-600">Phí vận chuyển</dt>
                <dd className="font-semibold text-slate-900">
                  {order.shippingFee === 0 ? 'Miễn phí' : formatVnd(order.shippingFee)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                <dt className="font-bold text-slate-900">Tổng thanh toán</dt>
                <dd className="font-display text-lg font-bold text-rose-600">
                  {formatVnd(order.total)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card title="Lịch sử đơn hàng" className="print:hidden">
            <ol className="space-y-3 border-l-2 border-brand-200 pl-4 text-sm">
              {order.history.map((entry, index) => (
                <li key={`${entry.status}-${index}`}>
                  <p className="font-semibold text-slate-900">
                    {ORDER_STATUS_LABELS[entry.status]}
                  </p>
                  <p className="text-slate-500">
                    {formatDateTime(entry.createdAt)}
                    {entry.changedBy && ` · ${entry.changedBy.fullName}`}
                  </p>
                  {entry.note && <p className="text-slate-600">{entry.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6 print:mt-6">
          <Card title="Khách hàng">
            {order.customer ? (
              <>
                <p className="font-semibold text-slate-900">{order.customer.fullName}</p>
                <p className="text-sm text-slate-600">{order.customer.email}</p>
                <p className="text-sm text-slate-600">
                  Điểm thành viên hiện có: <strong>{order.customer.points}</strong>
                </p>
                {order.pointsEarned > 0 && (
                  <p className="text-sm font-medium text-emerald-700">
                    Đơn này đã cộng {order.pointsEarned} điểm
                  </p>
                )}
                {order.pointsExpected > 0 && (
                  <p className="text-sm text-slate-600">
                    Đơn này sẽ cộng {order.pointsExpected} điểm khi hoàn thành
                  </p>
                )}
              </>
            ) : (
              // [F13] Đơn đặt khi chưa đăng nhập: không có tài khoản, không tích điểm (BR-15)
              <>
                <p className="font-semibold text-slate-900">Khách không đăng nhập</p>
                <p className="text-sm text-slate-600">
                  Không có tài khoản nên đơn này không tích điểm. Liên hệ khách qua số điện thoại ở
                  mục Giao tới.
                </p>
              </>
            )}
          </Card>

          <Card title="Giao tới">
            <p className="font-semibold text-slate-900">
              {order.recipientName} · {order.phone}
            </p>
            <p className="text-sm text-slate-600">{order.shippingAddress}</p>
            {order.note && (
              <p className="text-sm text-slate-600">Ghi chú của khách: {order.note}</p>
            )}
            <p className="border-t border-slate-100 pt-3 text-sm text-slate-600">
              {PAYMENT_METHOD_LABELS[order.paymentMethod]} ·{' '}
              <span className="font-semibold">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</span>
            </p>
          </Card>

          <Card title="Xử lý đơn hàng" className="print:hidden">
            {order.allowedNext.length === 0 ? (
              <p className="text-sm text-slate-600">
                Đơn hàng đã kết thúc ({ORDER_STATUS_LABELS[order.status].toLowerCase()}), không thể
                đổi trạng thái.
              </p>
            ) : (
              <div className="space-y-3">
                {update.isError && <Alert>{getErrorMessage(update.error)}</Alert>}

                {!cancelling && (
                  <>
                    <label className="block text-sm font-medium text-slate-700">
                      Ghi chú vào lịch sử (không bắt buộc)
                      <input
                        value={note}
                        maxLength={200}
                        onChange={(event) => setNote(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {nextSteps.map((status) => (
                        <Button
                          key={status}
                          loading={update.isPending && update.variables?.status === status}
                          disabled={update.isPending}
                          onClick={() => update.mutate({ status, note: note.trim() })}
                        >
                          {STEP_LABELS[status]}
                        </Button>
                      ))}
                      {canCancel && (
                        <Button
                          variant="danger"
                          disabled={update.isPending}
                          onClick={() => setCancelling(true)}
                        >
                          Hủy đơn
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {cancelling && (
                  <form
                    onSubmit={submitCancel}
                    aria-label="Hủy đơn"
                    noValidate
                    className="space-y-3"
                  >
                    <p className="text-sm text-rose-700">
                      Hủy đơn sẽ trả sản phẩm về kho và không thể khôi phục.
                    </p>
                    <label className="block text-sm font-medium text-slate-700">
                      Lý do hủy đơn
                      <input
                        value={reason}
                        maxLength={200}
                        onChange={(event) => {
                          setReason(event.target.value);
                          setReasonError('');
                        }}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
                      />
                    </label>
                    {reasonError && (
                      <p role="alert" className="text-sm text-rose-600">
                        {reasonError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" variant="danger" loading={update.isPending}>
                        Xác nhận hủy đơn
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={update.isPending}
                        onClick={() => {
                          setCancelling(false);
                          setReasonError('');
                        }}
                      >
                        Không hủy
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
