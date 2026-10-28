/**
 * @feature [F03] Sản phẩm - Trang danh sách sản phẩm: tìm theo tên/SKU, lọc, phân trang, ẩn/hiện, xóa (US-09).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  IconEdit,
  IconPlus,
  IconTrash,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { api, assetUrl } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

const PAGE_SIZE = 10;
const LOW_STOCK = 5; // Cùng ngưỡng cảnh báo tồn kho thấp của dashboard (US-26)

const selectClass =
  'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState(''); // '' = tất cả, 'true' = đang bán, 'false' = đang ẩn
  const [page, setPage] = useState(1);

  // Chờ người dùng ngừng gõ 300ms mới tìm; đổi từ khóa thì về trang 1
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      // Chỉ về trang 1 khi từ khóa thật sự đổi: nếu không, bấm "Trang sau" trong 300ms đầu sẽ bị giật về trang 1
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const categories = useQuery({
    queryKey: ['/admin/categories', 'all'],
    queryFn: () => api.get('/admin/categories').then((res) => res.data),
  });

  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(search && { search }),
    ...(categoryId && { categoryId }),
    ...(status && { isActive: status }),
  };

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['/admin/products', 'list', params],
    queryFn: () => api.get('/admin/products', { params }).then((res) => res.data),
    // Giữ bảng cũ trong lúc tải trang/kết quả mới, tránh nhấp nháy
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['/admin/products'] });

  const toggleActive = useMutation({
    mutationFn: (product) =>
      api.patch(`/admin/products/${product.id}`, { isActive: !product.isActive }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (product) => api.delete(`/admin/products/${product.id}`),
    onSuccess: refresh,
  });

  const handleDelete = (product) => {
    if (window.confirm(`Xóa sản phẩm "${product.name}"?`)) remove.mutate(product);
  };

  const changeFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const actionError = toggleActive.error ?? remove.error;
  const hasFilter = Boolean(search || categoryId || status);

  return (
    <div className="space-y-4">
      <PageHeader title="Sản phẩm" description="Quản lý hàng hóa, giá, tồn kho và ảnh">
        <Link
          to="/san-pham/them"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-glow hover:brightness-110"
        >
          <IconPlus size={16} />
          Thêm sản phẩm
        </Link>
      </PageHeader>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Tìm sản phẩm"
          placeholder="Tìm theo tên hoặc SKU..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className={`${selectClass} w-full max-w-xs`}
        />
        <select
          aria-label="Lọc theo danh mục"
          value={categoryId}
          onChange={changeFilter(setCategoryId)}
          className={selectClass}
        >
          <option value="">Tất cả danh mục</option>
          {(categories.data ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Lọc theo trạng thái"
          value={status}
          onChange={changeFilter(setStatus)}
          className={selectClass}
        >
          <option value="">Mọi trạng thái</option>
          <option value="true">Đang bán</option>
          <option value="false">Đang ẩn</option>
        </select>
      </div>

      {actionError && <Alert>{getErrorMessage(actionError)}</Alert>}
      {isPending && (
        <p role="status" className="text-slate-500">
          Đang tải...
        </p>
      )}
      {isError && <Alert>{getErrorMessage(error)}</Alert>}

      {data && data.items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {hasFilter
            ? 'Không có sản phẩm nào khớp bộ lọc.'
            : 'Chưa có sản phẩm nào. Bấm "Thêm sản phẩm" để tạo mới.'}
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Ảnh</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Danh mục</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Thương hiệu</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Giá</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Tồn kho</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 [&>tr]:transition [&>tr:hover]:bg-brand-50/40">
                {data.items.map((product) => (
                  <tr key={product.id}>
                    <td className="px-4 py-3">
                      {product.thumbnail ? (
                        <img
                          src={assetUrl(product.thumbnail)}
                          alt={product.name}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
                          Chưa có
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{product.name}</div>
                      <div className="text-xs text-slate-500">{product.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{product.category.name}</td>
                    <td className="px-4 py-3 text-slate-600">{product.brand.name}</td>
                    <td className="px-4 py-3">
                      {product.salePrice ? (
                        <>
                          <div className="font-medium text-rose-600">
                            {formatVnd(product.salePrice)}
                          </div>
                          <div className="text-xs text-slate-400 line-through">
                            {formatVnd(product.price)}
                          </div>
                        </>
                      ) : (
                        <div className="font-medium text-slate-900">{formatVnd(product.price)}</div>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 ${
                        product.stock <= LOW_STOCK ? 'font-medium text-rose-600' : 'text-slate-600'
                      }`}
                    >
                      {product.stock}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          product.isActive
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {product.isActive ? 'Đang bán' : 'Đang ẩn'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-nowrap items-center gap-1.5">
                        <Link
                          to={`/san-pham/${product.id}`}
                          aria-label={`Sửa ${product.name}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                        >
                          <IconEdit size={14} />
                          Sửa
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive.mutate(product)}
                        >
                          {product.isActive ? 'Ẩn' : 'Hiện'}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          aria-label="Xóa"
                          title="Xóa sản phẩm"
                          onClick={() => handleDelete(product)}
                        >
                          <IconTrash size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav
            aria-label="Phân trang"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">
              Tổng {data.total} sản phẩm · Trang {data.page}/{totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Trang sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
