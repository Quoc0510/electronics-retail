/**
 * @feature [F12] So sánh sản phẩm - Trang /so-sanh: bảng thông số các sản phẩm đã chọn đặt cạnh nhau.
 * Dữ liệu (giá, tình trạng, thông số) tải mới từ API theo slug nên luôn đúng; danh sách chọn lấy từ CompareContext.
 *  - Hàng thông số có giá trị KHÁC nhau giữa các sản phẩm được tô nổi; công tắc "Chỉ hiện điểm khác biệt" ẩn các hàng giống nhau.
 *  - Sản phẩm có giá bán hiện hành thấp nhất được gắn nhãn "Giá tốt nhất" (chỉ khi có >= 2 sản phẩm tải được).
 *  - Sản phẩm không còn bán (404) hoặc lỗi mạng hiện thành cột báo lỗi kèm nút bỏ, không làm hỏng cả bảng.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Button, IconClose, IconCompare, formatVnd } from '@techstore/shared';
import { api, assetUrl } from '../lib/api.js';
import { useCompare } from '../context/CompareContext.jsx';
import Price from '../components/Price.jsx';

const effectivePrice = (product) => product.salePrice ?? product.price;

// Gom tên thông số của mọi sản phẩm theo thứ tự xuất hiện đầu tiên (sản phẩm nào thiếu thì ô hiện "-")
const collectSpecNames = (products) => {
  const names = [];
  for (const product of products) {
    for (const name of Object.keys(product.specs ?? {})) {
      if (!names.includes(name)) names.push(name);
    }
  }
  return names;
};

const sameValues = (values) => values.every((value) => value === values[0]);

function ProductHeader({ item, product, isCheapest, onRemove }) {
  const image = assetUrl(product.images[0]?.url);

  return (
    <div className="relative space-y-3 text-left">
      <button
        type="button"
        aria-label={`Bỏ ${item.name} khỏi so sánh`}
        onClick={onRemove}
        className="absolute -right-1 -top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-700"
      >
        <IconClose size={16} />
      </button>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        {image ? (
          <img src={image} alt={item.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">Chưa có ảnh</span>
        )}
        {isCheapest && (
          <span className="absolute left-2 top-2 rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white shadow">
            Giá tốt nhất
          </span>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
        {product.brand.name}
      </p>
      <Link
        to={`/san-pham/${item.slug}`}
        className="line-clamp-2 block min-h-10 text-sm font-semibold text-slate-900 hover:text-brand-700"
      >
        {item.name}
      </Link>
      <Price price={product.price} salePrice={product.salePrice} />
    </div>
  );
}

export default function ComparePage() {
  const { items, remove, clear } = useCompare();
  const [onlyDifferences, setOnlyDifferences] = useState(false);

  useEffect(() => {
    document.title = 'So sánh sản phẩm - TechStore';
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, []);

  const queries = useQueries({
    queries: items.map((item) => ({
      queryKey: ['products', 'detail', item.slug],
      queryFn: () => api.get(`/products/${item.slug}`).then((res) => res.data),
      retry: (failureCount, err) => err.response?.status !== 404 && failureCount < 1,
    })),
  });

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <IconCompare size={30} />
        </span>
        <h1 className="text-2xl font-bold text-slate-900">Chưa có sản phẩm để so sánh</h1>
        <p className="text-slate-600">
          Bấm nút so sánh trên thẻ hoặc trang chi tiết của sản phẩm để thêm vào đây (tối đa 4 sản
          phẩm cùng danh mục).
        </p>
        <Link
          to="/san-pham"
          className="rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110"
        >
          Xem sản phẩm
        </Link>
      </div>
    );
  }

  const loaded = queries.map((query) => query.data).filter(Boolean);
  const specNames = collectSpecNames(loaded);
  const cheapest =
    loaded.length >= 2 ? Math.min(...loaded.map((product) => effectivePrice(product))) : null;

  // Mỗi hàng: tên thuộc tính và giá trị theo từng cột (null nếu cột chưa tải được)
  const rows = [
    {
      key: 'price',
      label: 'Giá bán',
      values: queries.map((q) => (q.data ? formatVnd(effectivePrice(q.data)) : null)),
    },
    {
      key: 'stock',
      label: 'Tình trạng',
      values: queries.map((q) => (q.data ? (q.data.inStock ? 'Còn hàng' : 'Hết hàng') : null)),
    },
    {
      key: 'brand',
      label: 'Thương hiệu',
      values: queries.map((q) => q.data?.brand.name ?? null),
    },
    ...specNames.map((name) => ({
      key: `spec:${name}`,
      label: name,
      values: queries.map((q) => (q.data ? (q.data.specs?.[name] ?? '-') : null)),
    })),
  ].map((row) => ({ ...row, differs: !sameValues(row.values.filter((v) => v !== null)) }));

  const visibleRows = onlyDifferences ? rows.filter((row) => row.differs) : rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">So sánh sản phẩm</h1>
          <p className="mt-1 text-sm text-slate-500">
            Đang so sánh {items.length} sản phẩm thuộc danh mục {items[0].category.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={onlyDifferences}
              onChange={(event) => setOnlyDifferences(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            Chỉ hiện điểm khác biệt
          </label>
          <Button variant="secondary" size="sm" onClick={clear}>
            Xóa tất cả
          </Button>
        </div>
      </div>

      {items.length < 2 && (
        <p
          role="status"
          className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700"
        >
          Hãy thêm ít nhất 1 sản phẩm nữa cùng danh mục để so sánh.{' '}
          <Link
            to={`/san-pham?category=${items[0].category.slug}`}
            className="font-semibold underline"
          >
            Chọn thêm
          </Link>
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Bảng so sánh thông số các sản phẩm đã chọn</caption>
          <thead>
            <tr>
              <td className="w-40 min-w-32 border-b border-slate-200 bg-slate-50 p-4" />
              {items.map((item, index) => {
                const query = queries[index];
                return (
                  <th
                    key={item.slug}
                    scope="col"
                    className="w-1/4 min-w-44 border-b border-l border-slate-200 p-4 align-top font-normal"
                  >
                    {query.isPending ? (
                      <div
                        role="status"
                        aria-label="Đang tải sản phẩm"
                        className="skeleton aspect-square rounded-xl"
                      />
                    ) : query.isError ? (
                      <div className="space-y-3 text-left">
                        <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                        <p role="alert" className="text-xs text-rose-600">
                          {query.error.response?.status === 404
                            ? 'Sản phẩm này không còn được bán.'
                            : 'Không tải được thông tin sản phẩm.'}
                        </p>
                        <Button variant="secondary" size="sm" onClick={() => remove(item.slug)}>
                          Bỏ khỏi so sánh
                        </Button>
                      </div>
                    ) : (
                      <ProductHeader
                        item={item}
                        product={query.data}
                        isCheapest={cheapest !== null && effectivePrice(query.data) === cheapest}
                        onRemove={() => remove(item.slug)}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.key} className={row.differs ? 'bg-brand-50/60' : ''}>
                <th
                  scope="row"
                  className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-left font-medium text-slate-500"
                >
                  {row.label}
                  {row.differs && (
                    <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[0.65rem] font-semibold text-brand-700">
                      Khác nhau
                    </span>
                  )}
                </th>
                {row.values.map((value, index) => (
                  <td
                    key={items[index].slug}
                    className="border-b border-l border-slate-100 px-4 py-3 font-medium text-slate-900"
                  >
                    {value ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {onlyDifferences && visibleRows.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">
            Các sản phẩm này giống nhau ở mọi thông số.
          </p>
        )}
      </div>
    </div>
  );
}
