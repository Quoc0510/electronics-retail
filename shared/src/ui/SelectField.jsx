/**
 * @feature [F03] Ô chọn trong danh sách thả xuống, có nhãn và thông báo lỗi (giống FormField).
 * options: [{ value, label }]. placeholder là lựa chọn đầu tiên mang giá trị rỗng (ví dụ "Chọn danh mục").
 */
import { useId } from 'react';

export default function SelectField({ label, error, id, options, placeholder, ...selectProps }) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = `${selectId}-error`;

  return (
    <div className="space-y-1">
      <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-md border bg-white px-3 py-2 text-slate-900 shadow-sm focus:outline-none focus:ring-2 ${
          error
            ? 'border-red-500 focus:ring-red-300'
            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-200'
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
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
