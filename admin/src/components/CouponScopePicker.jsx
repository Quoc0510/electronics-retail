/**
 * @feature [F09] Quản lý mã giảm giá - Chọn phạm vi áp dụng của mã (US-24): một hoặc nhiều sản phẩm, danh mục, thương hiệu.
 * Phạm vi là HỢP của ba danh sách (khớp một trong ba là được); không chọn gì cả = áp dụng cho mọi sản phẩm.
 *  - Danh mục và thương hiệu: danh sách ô chọn (số lượng ít, tải một lần).
 *  - Sản phẩm: gõ tên hoặc SKU để tìm rồi bấm Thêm (số lượng lớn nên không tải hết); các sản phẩm đã chọn hiện thành thẻ có nút bỏ.
 *  - Id còn trong mã nhưng sản phẩm/danh mục/thương hiệu đã bị xóa vẫn hiện (ghi "đã xóa") để Admin bỏ đi được; mã vẫn không
 *    áp dụng cho ai thay vì thành "áp dụng tất cả" (xem backend/src/lib/coupon.js).
 */
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, IconClose } from '@techstore/shared';
import { api } from '../lib/api.js';

export const MAX_SCOPE_ITEMS = 50;

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm text-brand-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Bỏ ${label}`}
        className="rounded-full p-0.5 hover:bg-brand-100"
      >
        <IconClose size={14} />
      </button>
    </span>
  );
}

// Danh sách ô chọn cho danh mục hoặc thương hiệu; id không còn trong danh sách hiện thành thẻ "đã xóa"
function CheckGroup({ legend, endpoint, selected, onToggle, onRemoveUnknown }) {
  const { data, isPending, isError } = useQuery({
    queryKey: [endpoint, 'all'],
    queryFn: () => api.get(endpoint).then((res) => res.data),
  });
  const known = new Set((data ?? []).map((item) => item.id));
  const unknown = selected.filter((id) => data && !known.has(id));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">{legend}</legend>
      {isPending && <p className="text-sm text-slate-500">Đang tải...</p>}
      {isError && (
        <p className="text-sm text-rose-600">Không tải được danh sách {legend.toLowerCase()}</p>
      )}
      <div className="grid max-h-40 gap-1 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-2">
        {(data ?? []).map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => onToggle(item.id)}
            />
            <span>
              {item.name}
              {item.isActive === false && <span className="text-slate-400"> (đang ẩn)</span>}
            </span>
          </label>
        ))}
      </div>
      {unknown.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unknown.map((id) => (
            <Chip key={id} label={`#${id} (đã xóa)`} onRemove={() => onRemoveUnknown(id)} />
          ))}
        </div>
      )}
    </fieldset>
  );
}

function ProductPicker({ products, onChange }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  // Chờ người dùng ngừng gõ 300ms mới tìm
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ['/admin/products', 'picker', search],
    queryFn: () =>
      api.get('/admin/products', { params: { search, pageSize: 6 } }).then((res) => res.data),
    enabled: search.length >= 2,
    placeholderData: keepPreviousData,
  });
  const chosen = new Set(products.map((product) => product.id));
  const full = products.length >= MAX_SCOPE_ITEMS;

  return (
    <div className="space-y-2">
      <label htmlFor="coupon-product-search" className="block text-sm font-medium text-slate-700">
        Sản phẩm
      </label>
      <input
        id="coupon-product-search"
        type="search"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Gõ tên hoặc SKU sản phẩm để tìm (ít nhất 2 ký tự)"
        autoComplete="off"
        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
      {search.length >= 2 && (
        <ul
          aria-label="Kết quả tìm sản phẩm"
          className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm"
        >
          {isError && <li className="p-2 text-rose-600">Không tìm được sản phẩm</li>}
          {data && data.items.length === 0 && !isFetching && (
            <li className="p-2 text-slate-500">Không có sản phẩm nào khớp</li>
          )}
          {(data?.items ?? []).map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-2 p-2">
              <span className="min-w-0 truncate">
                {product.name} <span className="text-slate-400">· {product.sku}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={chosen.has(product.id) || full}
                aria-label={`Thêm ${product.name}`}
                onClick={() => onChange([...products, { id: product.id, name: product.name }])}
              >
                {chosen.has(product.id) ? 'Đã chọn' : 'Thêm'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {full && <p className="text-sm text-amber-700">Đã chọn tối đa {MAX_SCOPE_ITEMS} sản phẩm.</p>}
      {products.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {products.map((product) => (
            <Chip
              key={product.id}
              label={product.name ?? `#${product.id} (đã xóa)`}
              onRemove={() => onChange(products.filter((p) => p.id !== product.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ products: Array<{id:number,name:string|null}>, categoryIds: number[], brandIds: number[],
 *   onChange: (patch: object) => void }} props
 */
export default function CouponScopePicker({ products, categoryIds, brandIds, onChange }) {
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const overLimit = (list) => list.length > MAX_SCOPE_ITEMS;

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div>
        <h3 className="font-semibold text-slate-900">Phạm vi áp dụng</h3>
        <p className="text-sm text-slate-500">
          Chọn sản phẩm, danh mục hoặc thương hiệu mà mã được áp dụng (khớp một trong ba là được).
          Để trống cả ba thì mã áp dụng cho mọi sản phẩm. Số tiền giảm và đơn tối thiểu chỉ tính
          trên các sản phẩm được áp dụng.
        </p>
      </div>
      <ProductPicker products={products} onChange={(next) => onChange({ products: next })} />
      <CheckGroup
        legend="Danh mục"
        endpoint="/admin/categories"
        selected={categoryIds}
        onToggle={(id) => {
          const next = toggle(categoryIds, id);
          if (!overLimit(next)) onChange({ categoryIds: next });
        }}
        onRemoveUnknown={(id) => onChange({ categoryIds: categoryIds.filter((x) => x !== id) })}
      />
      <CheckGroup
        legend="Thương hiệu"
        endpoint="/admin/brands"
        selected={brandIds}
        onToggle={(id) => {
          const next = toggle(brandIds, id);
          if (!overLimit(next)) onChange({ brandIds: next });
        }}
        onRemoveUnknown={(id) => onChange({ brandIds: brandIds.filter((x) => x !== id) })}
      />
    </div>
  );
}
