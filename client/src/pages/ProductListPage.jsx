/**
 * @feature [F04] Duyệt và tìm sản phẩm - Trang danh sách: lọc, sắp xếp, tìm kiếm, phân trang (US-11, US-12).
 * Toàn bộ bộ lọc nằm trên URL (?category=...&brand=...&minPrice=...&onSale=true&sort=...&search=...&page=...) nên
 * chia sẻ được, tải lại vẫn đúng và nút Back của trình duyệt hoạt động (US-11 AC4). Không có state riêng cho bộ lọc.
 *
 * Bố cục: máy tính có bảng lọc cố định bên trái; điện thoại thu gọn thành nút "Bộ lọc" mở ngăn kéo.
 */
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Button, IconFilter, IconSearch } from '@techstore/shared';
import { api } from '../lib/api.js';
import { useBrands, useCategories } from '../hooks/useCatalog.js';
import ActiveFilters from '../components/list/ActiveFilters.jsx';
import FilterDrawer from '../components/list/FilterDrawer.jsx';
import FilterPanel from '../components/list/FilterPanel.jsx';
import Pagination from '../components/Pagination.jsx';
import ProductGrid from '../components/ProductGrid.jsx';

const PAGE_SIZE = 12;
const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất' },
  { value: 'price_asc', label: 'Giá tăng dần' },
  { value: 'price_desc', label: 'Giá giảm dần' },
];

// Đọc bộ lọc từ URL. Giá trị sai (page=abc, sort=lung-tung) được đưa về mặc định thay vì làm hỏng trang
const readFilters = (params) => {
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    search: params.get('search') ?? '',
    category: params.get('category') ?? '',
    brand: params.get('brand') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    onSale: params.get('onSale') === 'true',
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : 'newest',
    page: page >= 1 ? page : 1,
  };
};

export default function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const filters = readFilters(searchParams);

  const categories = useCategories();
  const brands = useBrands();

  // Chỉ gửi những bộ lọc có giá trị
  const apiParams = {
    pageSize: PAGE_SIZE,
    sort: filters.sort,
    page: filters.page,
    ...Object.fromEntries(
      ['search', 'category', 'brand', 'minPrice', 'maxPrice']
        .filter((key) => filters[key] !== '')
        .map((key) => [key, filters[key]]),
    ),
    ...(filters.onSale && { onSale: 'true' }),
  };

  const products = useQuery({
    queryKey: ['products', 'list', apiParams],
    queryFn: () => api.get('/products', { params: apiParams }).then((res) => res.data),
    // Giữ kết quả cũ trong lúc tải trang/bộ lọc mới, tránh nhấp nháy
    placeholderData: keepPreviousData,
  });

  // Đổi bộ lọc: ghi lên URL và về trang 1 (trừ khi chính là đổi trang)
  const updateFilters = (changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      const isDefault = value === '' || (key === 'sort' && value === 'newest');
      if (isDefault) next.delete(key);
      else next.set(key, value);
    });
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next);
  };

  const clearFilters = () => setSearchParams({});

  const linkFor = (page) => {
    const next = new URLSearchParams(searchParams);
    if (page <= 1) next.delete('page');
    else next.set('page', String(page));
    const query = next.toString();
    return query ? `/san-pham?${query}` : '/san-pham';
  };

  const currentCategory = categories.data?.find((category) => category.slug === filters.category);
  const currentBrand = brands.data?.find((brand) => brand.slug === filters.brand);
  const activeCount = [
    filters.search,
    filters.category,
    filters.brand,
    filters.minPrice || filters.maxPrice,
    filters.onSale,
  ].filter(Boolean).length;
  const hasFilters = activeCount > 0;

  const heading = filters.search
    ? `Kết quả tìm kiếm cho "${filters.search}"`
    : (currentCategory?.name ?? (filters.onSale ? 'Sản phẩm khuyến mãi' : 'Tất cả sản phẩm'));
  const total = products.data?.total;
  const totalPages = total ? Math.ceil(total / PAGE_SIZE) : 1;

  // US-12 AC2: không có kết quả thì gợi ý bỏ bớt bộ lọc; trang vượt quá số trang thì dẫn về trang đầu
  const emptyMessage =
    total > 0 ? (
      <p>
        Trang này không có sản phẩm.{' '}
        <Link to={linkFor(1)} className="font-semibold text-brand-600 hover:underline">
          Về trang đầu
        </Link>
      </p>
    ) : (
      <div className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <IconSearch size={30} />
        </span>
        <p className="font-display text-lg font-semibold text-slate-900">
          Không tìm thấy sản phẩm nào.
        </p>
        {hasFilters && (
          <>
            <p>Hãy thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm.</p>
            <Button variant="secondary" onClick={clearFilters}>
              Xóa tất cả bộ lọc
            </Button>
          </>
        )}
      </div>
    );

  const panel = (
    <FilterPanel
      filters={filters}
      categories={categories.data ?? []}
      brands={brands.data ?? []}
      onChange={updateFilters}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{heading}</h1>
          {total !== undefined && (
            <p className="mt-1 text-sm text-slate-500">
              {total > 0 ? `Tìm thấy ${total} sản phẩm` : 'Không có sản phẩm nào'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="lg:hidden"
            aria-label={activeCount > 0 ? `Bộ lọc (${activeCount})` : 'Bộ lọc'}
            onClick={() => setDrawerOpen(true)}
          >
            <IconFilter size={16} />
            Bộ lọc{activeCount > 0 && ` (${activeCount})`}
          </Button>
          <select
            aria-label="Sắp xếp"
            value={filters.sort}
            onChange={(event) => updateFilters({ sort: event.target.value })}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ActiveFilters
        filters={filters}
        categoryName={currentCategory?.name ?? filters.category}
        brandName={currentBrand?.name ?? filters.brand}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      <div className="grid gap-8 lg:grid-cols-[17rem_1fr]">
        <aside
          aria-label="Bộ lọc sản phẩm"
          className="sticky top-36 hidden h-fit max-h-[calc(100vh-10rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:block"
        >
          {panel}
        </aside>

        <div className="min-w-0 space-y-8">
          <ProductGrid query={products} emptyMessage={emptyMessage} skeletonCount={PAGE_SIZE} />
          <Pagination page={filters.page} totalPages={totalPages} linkFor={linkFor} />
        </div>
      </div>

      <FilterDrawer open={drawerOpen} onClose={closeDrawer} total={total ?? 0}>
        {panel}
      </FilterDrawer>
    </div>
  );
}
