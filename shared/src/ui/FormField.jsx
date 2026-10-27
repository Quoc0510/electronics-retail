/**
 * @feature [F01][F02][F04] Ô nhập liệu có nhãn và thông báo lỗi, dùng cho mọi form.
 * Gắn aria-invalid và aria-describedby để trình đọc màn hình đọc được lỗi.
 * multiline = true hiển thị ô nhập nhiều dòng (dùng cho mô tả).
 */
import { useId } from 'react';

export default function FormField({ label, error, id, multiline = false, ...inputProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const Control = multiline ? 'textarea' : 'input';

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <Control
        id={inputId}
        rows={multiline ? 3 : undefined}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:bg-slate-100 disabled:text-slate-500 ${
          error
            ? 'border-rose-500 focus:ring-rose-100'
            : 'border-slate-300 hover:border-slate-400 focus:border-brand-500 focus:ring-brand-100'
        }`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
