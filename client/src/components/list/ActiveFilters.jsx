/**
 * @feature [F04] Danh sách sản phẩm - Các "chip" bộ lọc đang áp dụng, bấm dấu × để bỏ từng bộ lọc (US-11, US-12).
 * Giúp người dùng luôn biết kết quả đang bị lọc theo điều kiện nào và gỡ nhanh mà không phải tìm lại trong bảng lọc.
 */
import { IconClose, formatVnd } from '@techstore/shared';

// Mô tả khoảng giá bằng lời: "Từ 5.000.000 ₫", "Đến 10.000.000 ₫" hoặc "5.000.000 ₫ - 10.000.000 ₫"
const priceLabel = (min, max) => {
  if (min && max) return `${formatVnd(Number(min))} - ${formatVnd(Number(max))}`;
  if (min) return `Từ ${formatVnd(Number(min))}`;
  return `Đến ${formatVnd(Number(max))}`;
};

export default function ActiveFilters({ filters, categoryName, brandName, onChange, onClear }) {
  const chips = [];
  if (filters.search)
    chips.push({ key: 'search', label: `Từ khóa: "${filters.search}"`, reset: { search: '' } });
  if (filters.category)
    chips.push({ key: 'category', label: categoryName, reset: { category: '' } });
  if (filters.brand) chips.push({ key: 'brand', label: brandName, reset: { brand: '' } });
  if (filters.minPrice || filters.maxPrice) {
    chips.push({
      key: 'price',
      label: priceLabel(filters.minPrice, filters.maxPrice),
      reset: { minPrice: '', maxPrice: '' },
    });
  }
  if (filters.onSale)
    chips.push({ key: 'onSale', label: 'Đang khuyến mãi', reset: { onSale: '' } });

  if (chips.length === 0) return null;

  return (
    <ul aria-label="Bộ lọc đang áp dụng" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            aria-label={`Bỏ lọc ${chip.label}`}
            onClick={() => onChange(chip.reset)}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-2 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
          >
            {chip.label}
            <IconClose size={14} />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onClear}
          className="px-2 py-1 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline"
        >
          Xóa tất cả bộ lọc
        </button>
      </li>
    </ul>
  );
}
