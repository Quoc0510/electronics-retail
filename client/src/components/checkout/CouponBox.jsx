/**
 * @feature [F09] Mã giảm giá - Ô nhập mã giảm giá ở trang đặt hàng (US-25).
 *  - Mã hợp lệ: hiện ngay số tiền giảm (AC1) và nút bỏ mã; mã lỗi: nói đúng lý do (hết hạn, hết lượt, chưa đủ đơn tối thiểu - AC2).
 *  - Mỗi đơn một mã (AC4): đang áp một mã thì muốn dùng mã khác phải bỏ mã cũ trước.
 *  - Nằm trong form đặt hàng nên phím Enter trong ô nhập chỉ áp mã, không được gửi đơn.
 */
import { useState } from 'react';
import { Alert, Button, IconTag, formatVnd, getErrorMessage } from '@techstore/shared';

export default function CouponBox({ appliedCode, onApply, onRemove, quote, checking, error }) {
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
          <span className="truncate">
            Đã áp dụng mã <strong>{quote.code}</strong>: giảm {formatVnd(quote.discount)}
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
