/**
 * @feature [F09] Mã giảm giá - Ô nhập mã giảm giá ở trang đặt hàng (US-25).
 *  - Mã hợp lệ: hiện ngay số tiền giảm (AC1) và nút bỏ mã; mã lỗi: nói đúng lý do (hết hạn, hết lượt, chưa đủ đơn tối thiểu - AC2).
 *  - Mỗi đơn một mã (AC4): đang áp một mã thì muốn dùng mã khác phải bỏ mã cũ trước.
 *  - Mã có điều kiện phụ: ghi rõ khi mã chỉ áp dụng cho một số sản phẩm trong giỏ; khách chưa đăng nhập gặp mã yêu cầu điểm
 *    thành viên thì có đường dẫn đăng nhập (giỏ hàng được giữ nguyên).
 *  - Mã tự động áp dụng (US-25 AC10): hiện "Đã tự động áp dụng mã X" cùng nút Bỏ mã; bỏ rồi thì hiện lại ô nhập để khách tự nhập mã
 *    khác và mã tự động không được điền lại. Mã đã bỏ vẫn được GỢI Ý ngay trên ô nhập ("Mã dành cho bạn: X, giảm Y") kèm nút
 *    "Dùng mã này" để áp lại bằng một lần bấm, nên khách bỏ nhầm không bị mất mã.
 *  - Nằm trong form đặt hàng nên phím Enter trong ô nhập chỉ áp mã, không được gửi đơn.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, IconTag, formatVnd, getErrorMessage } from '@techstore/shared';

// Khách chưa đăng nhập bị từ chối vì mã cần điểm thành viên (details.points = null): mời đăng nhập thay vì chỉ báo lỗi
const needsLogin = (error) => {
  const body = error?.response?.data?.error;
  return body?.code === 'COUPON_MIN_POINTS' && body.details?.points === null;
};

export default function CouponBox({
  appliedCode,
  auto = false,
  suggestion = null,
  onRestoreSuggestion,
  onApply,
  onRemove,
  quote,
  checking,
  error,
}) {
  const [input, setInput] = useState('');

  const apply = () => {
    const code = input.trim().toUpperCase();
    if (code) onApply(code);
  };

  if (appliedCode && quote) {
    return (
      <div
        role="status"
        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium text-emerald-800">
          <IconTag size={16} className="shrink-0" />
          <span>
            {auto ? 'Đã tự động áp dụng mã ' : 'Đã áp dụng mã '}
            <strong>{quote.code}</strong>: giảm {formatVnd(quote.discount)}
            {quote.scoped && ' (chỉ áp dụng cho một số sản phẩm trong giỏ)'}
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 font-semibold text-emerald-900 underline hover:no-underline"
        >
          Bỏ mã
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {suggestion && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 text-brand-800">
            <IconTag size={16} className="shrink-0" />
            <span>
              Mã dành cho bạn: <strong>{suggestion.code}</strong>, giảm{' '}
              {formatVnd(suggestion.discount)}
            </span>
          </span>
          <button
            type="button"
            onClick={onRestoreSuggestion}
            className="shrink-0 font-semibold text-brand-700 underline hover:no-underline"
          >
            Dùng mã này
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              apply();
            }
          }}
          aria-label="Mã giảm giá"
          placeholder="Nhập mã giảm giá"
          maxLength={30}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm uppercase placeholder:normal-case focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <Button variant="secondary" onClick={apply} loading={checking} disabled={!input.trim()}>
          Áp dụng
        </Button>
      </div>
      {appliedCode && error && (
        <div className="space-y-2">
          <Alert>{getErrorMessage(error)}</Alert>
          {needsLogin(error) && (
            <Link
              to="/dang-nhap"
              state={{ from: { pathname: '/dat-hang' } }}
              className="text-sm font-semibold text-brand-600 hover:underline"
            >
              Đăng nhập để dùng mã này
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setInput('');
              onRemove();
            }}
            className="text-sm font-semibold text-slate-600 underline hover:no-underline"
          >
            Xóa mã {appliedCode}
          </button>
        </div>
      )}
    </div>
  );
}
