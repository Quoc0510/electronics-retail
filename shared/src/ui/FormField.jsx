/**
 * @feature [F01] Xác thực (frontend) - Ô nhập liệu có nhãn và thông báo lỗi, dùng cho mọi form.
 * Gắn aria-invalid và aria-describedby để trình đọc màn hình đọc được lỗi.
 */
import { useId } from 'react';

export default function FormField({ label, error, id, ...inputProps }) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-md border px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500 ${
          error
            ? 'border-red-500 focus:ring-red-300'
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
        }`}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
