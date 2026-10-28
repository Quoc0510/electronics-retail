/**
 * @feature [F05] Giỏ hàng - Bộ chọn số lượng (nút − / ô nhập / nút +), tối thiểu 1 và tối đa theo `max` (US-15 AC1).
 * Bấm − hoặc + áp dụng ngay; gõ số vào ô thì áp dụng khi rời ô hoặc nhấn Enter. Giá trị gõ sai (rỗng, chữ, ngoài khoảng)
 * được đưa về giá trị hợp lệ gần nhất thay vì gửi lên máy chủ.
 * Nơi dùng gắn `key` theo số lượng hiện tại để ô nhập được tạo lại khi giá trị thật thay đổi (không cần đồng bộ bằng effect).
 */
import { useState } from 'react';
import { IconPlus } from '@techstore/shared';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  label,
}) {
  const [draft, setDraft] = useState(String(value));

  const commit = (next) => {
    const parsed = Number.parseInt(next, 10);
    const valid = Number.isNaN(parsed) ? value : clamp(parsed, min, max);
    setDraft(String(valid));
    if (valid !== value) onChange(valid);
  };

  const buttonClass =
    'flex h-9 w-9 items-center justify-center text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div
      role="group"
      aria-label={label ? `Số lượng ${label}` : 'Số lượng'}
      className="inline-flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white"
    >
      <button
        type="button"
        aria-label="Giảm số lượng"
        disabled={disabled || value <= min}
        onClick={() => commit(value - 1)}
        className={buttonClass}
      >
        <span aria-hidden="true" className="text-lg leading-none">
          −
        </span>
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Số lượng"
        disabled={disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit(event.currentTarget.value);
        }}
        className="h-9 w-12 border-x border-slate-200 bg-transparent text-center text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:opacity-60"
      />
      <button
        type="button"
        aria-label="Tăng số lượng"
        disabled={disabled || value >= max}
        onClick={() => commit(value + 1)}
        className={buttonClass}
      >
        <IconPlus size={16} />
      </button>
    </div>
  );
}
