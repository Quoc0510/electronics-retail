/**
 * @feature [F04] Danh sách sản phẩm - Bảng bộ lọc: danh mục, thương hiệu, khoảng giá, khuyến mãi (US-11 AC1).
 * Dùng cho cả thanh bên (máy tính) lẫn ngăn kéo (điện thoại). Component chỉ hiển thị giá trị lọc hiện tại
 * và báo thay đổi qua onChange; việc ghi lên URL do trang danh sách đảm nhận.
 */
import { useState } from 'react';
import { Button } from '@techstore/shared';
import { categoryIcon } from '../../lib/categoryIcons.js';

// Các mức giá chọn nhanh (đồng). min/max rỗng nghĩa là không giới hạn phía đó
export const PRICE_RANGES = [
  { label: 'Dưới 5 triệu', minPrice: '', maxPrice: '5000000' },
  { label: '5 - 10 triệu', minPrice: '5000000', maxPrice: '10000000' },
  { label: '10 - 20 triệu', minPrice: '10000000', maxPrice: '20000000' },
  { label: '20 - 30 triệu', minPrice: '20000000', maxPrice: '30000000' },
  { label: 'Trên 30 triệu', minPrice: '30000000', maxPrice: '' },
];

const optionClass = (active) =>
  `flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
    active
      ? 'bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-200'
      : 'text-slate-700 hover:bg-slate-100'
  }`;

function Section({ title, children }) {
  return (
    <section className="space-y-2 border-b border-slate-200 pb-5 last:border-0 last:pb-0">
      <h2 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Ô nhập khoảng giá tự chọn. Được tạo lại (qua key) mỗi khi giá trên URL đổi nên luôn khớp với URL
function CustomPrice({ minPrice, maxPrice, onApply }) {
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const digits = /^\d*$/;
    if (!digits.test(min.trim()) || !digits.test(max.trim())) {
      setError('Giá chỉ gồm chữ số, không có dấu chấm hay phẩy.');
    } else if (min.trim() && max.trim() && Number(min) > Number(max)) {
      setError('Giá tối thiểu không được lớn hơn giá tối đa.');
    } else {
      setError('');
      onApply({ minPrice: min.trim(), maxPrice: max.trim() });
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';

  return (
    <form onSubmit={handleSubmit} aria-label="Lọc theo giá" className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <input
          aria-label="Giá từ (đồng)"
          placeholder="Giá từ"
          inputMode="numeric"
          value={min}
          onChange={(event) => setMin(event.target.value)}
          className={inputClass}
        />
        <span className="text-slate-400">-</span>
        <input
          aria-label="Giá đến (đồng)"
          placeholder="Giá đến"
          inputMode="numeric"
          value={max}
          onChange={(event) => setMax(event.target.value)}
          className={inputClass}
        />
      </div>
      <Button type="submit" variant="secondary" size="sm" className="w-full">
        Áp dụng
      </Button>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
    </form>
  );
}

export default function FilterPanel({ filters, categories, brands, onChange }) {
  return (
    <div className="space-y-5">
      <Section title="Danh mục">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              aria-pressed={!filters.category}
              onClick={() => onChange({ category: '' })}
              className={optionClass(!filters.category)}
            >
              Tất cả danh mục
            </button>
          </li>
          {categories.map((category) => {
            const Icon = categoryIcon(category.slug);
            const active = filters.category === category.slug;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ category: active ? '' : category.slug })}
                  className={optionClass(active)}
                >
                  <span className="flex items-center gap-2">
                    <Icon size={16} />
                    {category.name}
                  </span>
                  <span className="text-xs text-slate-400">{category.productCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Thương hiệu">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              aria-pressed={!filters.brand}
              onClick={() => onChange({ brand: '' })}
              className={optionClass(!filters.brand)}
            >
              Tất cả thương hiệu
            </button>
          </li>
          {brands.map((brand) => {
            const active = filters.brand === brand.slug;
            return (
              <li key={brand.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ brand: active ? '' : brand.slug })}
                  className={optionClass(active)}
                >
                  {brand.name}
                  <span className="text-xs text-slate-400">{brand.productCount}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Khoảng giá">
        <ul className="flex flex-wrap gap-2">
          {PRICE_RANGES.map((range) => {
            const active =
              filters.minPrice === range.minPrice && filters.maxPrice === range.maxPrice;
            return (
              <li key={range.label}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange(
                      active
                        ? { minPrice: '', maxPrice: '' }
                        : { minPrice: range.minPrice, maxPrice: range.maxPrice },
                    )
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50'
                  }`}
                >
                  {range.label}
                </button>
              </li>
            );
          })}
        </ul>
        <CustomPrice
          key={`${filters.minPrice}-${filters.maxPrice}`}
          minPrice={filters.minPrice}
          maxPrice={filters.maxPrice}
          onApply={onChange}
        />
      </Section>

      <Section title="Ưu đãi">
        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          <input
            type="checkbox"
            checked={filters.onSale}
            onChange={(event) => onChange({ onSale: event.target.checked ? 'true' : '' })}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Chỉ sản phẩm đang khuyến mãi
        </label>
      </Section>
    </div>
  );
}
