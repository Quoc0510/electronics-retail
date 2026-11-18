/**
 * @feature [F16] Ô chọn có tìm kiếm - Thay cho <select> khi danh sách dài (ví dụ vài trăm phường/xã): gõ để lọc, không cần
 * cuộn. Tìm không phân biệt hoa thường và dấu tiếng Việt ("sai gon" ra "Phường Sài Gòn").
 *
 * Cách dùng giống SelectField (nhãn, lỗi, options [{ value, label }], placeholder) nhưng onChange nhận THẲNG giá trị được chọn:
 *   <ComboboxField label="Phường/Xã" options={...} value={form.values.ward} onChange={(v) => form.setFieldValue('ward', v)} />
 * Bàn phím: mũi tên lên/xuống để di chuyển, Enter để chọn, Esc để đóng. Theo mẫu ARIA combobox + listbox.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { IconCheck, IconChevronDown } from './icons.jsx';

// Bỏ dấu và đổi đ -> d để gõ không dấu vẫn tìm được
const fold = (text) =>
  String(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

export default function ComboboxField({
  label,
  options,
  value,
  onChange,
  placeholder = 'Chọn',
  emptyText = 'Không có kết quả phù hợp',
  error,
  id,
  name,
  disabled = false,
}) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const errorId = `${inputId}-error`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef(null);

  const selected = options.find((option) => option.value === value);
  const matches = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return options;
    return options.filter((option) => fold(option.label).includes(needle));
  }, [options, query]);

  // Giữ mục đang chọn bằng bàn phím luôn nằm trong vùng nhìn thấy của danh sách dài
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView?.({ block: 'nearest' });
  }, [active, open]);

  const openList = () => {
    if (disabled || open) return;
    setQuery('');
    // Mở ra thì đưa mục đang chọn (nếu có) vào tầm nhìn
    const index = options.findIndex((option) => option.value === value);
    setActive(Math.max(index, 0));
    setOpen(true);
  };

  const choose = (option) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return openList();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) =>
        Math.min(Math.max(current + step, 0), Math.max(matches.length - 1, 0)),
      );
    } else if (event.key === 'Enter') {
      // Đang mở thì Enter là chọn, không gửi cả form
      if (open) {
        event.preventDefault();
        if (matches[active]) choose(matches[active]);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setQuery('');
      }
    }
  };

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${inputId}-opt-${active}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          disabled={disabled}
          placeholder={placeholder}
          // Đang mở: hiện chữ người dùng gõ; đóng: hiện mục đã chọn
          value={open ? query : (selected?.label ?? '')}
          onFocus={openList}
          onClick={openList}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onBlur={() => {
            setOpen(false);
            setQuery('');
          }}
          onKeyDown={onKeyDown}
          className={`w-full rounded-xl border bg-white py-2.5 pl-3.5 pr-10 text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-4 disabled:bg-slate-100 disabled:text-slate-500 ${
            error
              ? 'border-rose-500 focus:ring-rose-100'
              : 'border-slate-300 hover:border-slate-400 focus:border-brand-500 focus:ring-brand-100'
          }`}
        />
        <IconChevronDown
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={`Danh sách ${label}`}
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {matches.length === 0 ? (
            <li role="presentation" className="px-3.5 py-2 text-slate-500">
              {emptyText}
            </li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option.value}
                id={`${inputId}-opt-${index}`}
                role="option"
                aria-selected={option.value === value}
                // mousedown + preventDefault: chọn xong trước khi ô nhập mất tiêu điểm (nếu không danh sách đóng trước khi nhận click)
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 ${
                  index === active ? 'bg-brand-50 text-brand-700' : 'text-slate-800'
                }`}
              >
                <span>{option.label}</span>
                {option.value === value && <IconCheck size={16} className="shrink-0" />}
              </li>
            ))
          )}
        </ul>
      )}

      {error && (
        <p id={errorId} className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
