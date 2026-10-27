/**
 * @feature [F03][F04] Ô chọn trong danh sách thả xuống, có nhãn và thông báo lỗi (giống FormField).
 * options: [{ value, label }]. placeholder là lựa chọn đầu tiên mang giá trị rỗng (ví dụ "Chọn danh mục").
 */
import { useId } from 'react';

export default function SelectField({ label, error, id, options, placeholder, ...selectProps }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-slate-900 shadow-sm transition focus:outline-none focus:ring-4 ${
          error
            ? 'border-rose-500 focus:ring-rose-100'
            : 'border-slate-300 hover:border-slate-400 focus:border-brand-500 focus:ring-brand-100'
        }`}
        {...selectProps}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
