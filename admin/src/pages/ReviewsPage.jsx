/**
 * @feature [F08] Quản lý đánh giá - Trang danh sách đánh giá của Admin (US-23): tìm theo sản phẩm, người viết hoặc nội dung,
 * lọc theo trạng thái và số sao, phân trang, ẩn và bỏ ẩn đánh giá vi phạm.
 * Đánh giá bị ẩn không hiện ở Client và không tính vào điểm trung bình; bỏ ẩn thì hiện lại (không xóa dữ liệu).
 */
import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, IconStar, formatDateTime, getErrorMessage } from '@techstore/shared';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

const PAGE_SIZE = 10;

const controlClass =
  'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [rating, setRating] = useState('');
  const [page, setPage] = useState(1);

  // Chờ người dùng ngừng gõ 300ms mới tìm; chỉ về trang 1 khi từ khóa thật sự đổi (bấm "Trang sau" trong 300ms đầu không bị giật về)
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== search) {
        setSearch(next);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(search && { search }),
    ...(status && { status }),
    ...(rating && { rating }),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['/admin/reviews', 'list', params],
    queryFn: () => api.get('/admin/reviews', { params }).then((res) => res.data),
    // Giữ bảng cũ trong lúc tải kết quả mới, tránh nhấp nháy
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: (target) =>
      api.patch(`/admin/reviews/${target.id}/visibility`, { isHidden: !target.isHidden }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/admin/reviews'] }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilter = Boolean(search || status || rating);

  const resetPageOn = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Đánh giá"
        description="Xem đánh giá của khách và ẩn những đánh giá vi phạm"
      />

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Tìm đánh giá"
          placeholder="Tìm theo sản phẩm, người viết hoặc nội dung..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className={`${controlClass} w-full max-w-sm`}
        />
        <select
          aria-label="Lọc theo trạng thái đánh giá"
          value={status}
          onChange={resetPageOn(setStatus)}
          className={controlClass}
        >
          <option value="">Mọi trạng thái</option>
          <option value="visible">Đang hiện</option>
          <option value="hidden">Đã ẩn</option>
        </select>
        <select
          aria-label="Lọc theo số sao"
          value={rating}
          onChange={resetPageOn(setRating)}
          className={controlClass}
        >
          <option value="">Mọi số sao</option>
          {[5, 4, 3, 2, 1].map((star) => (
            <option key={star} value={star}>
              {star} sao
            </option>
          ))}
        </select>
      </div>

      {toggle.isError && <Alert>{getErrorMessage(toggle.error)}</Alert>}

      {isPending && (
        <p role="status" className="text-slate-500">
          Đang tải...
        </p>
      )}
      {isError && !data && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {hasFilter ? 'Không có đánh giá nào khớp bộ lọc.' : 'Chưa có đánh giá nào.'}
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Sản phẩm</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Người đánh giá</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Số sao</th>
                  <th className="px-4 py-3 font-medium">Bình luận</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Ngày</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 [&>tr]:transition [&>tr:hover]:bg-brand-50/40">
                {data.items.map((row) => {
                  const busy = toggle.isPending && toggle.variables?.id === row.id;
                  return (
                    <tr key={row.id} className={row.isHidden ? 'bg-slate-50/70' : ''}>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.product.name}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{row.user.fullName}</div>
                        <div className="text-xs text-slate-500">{row.user.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 font-semibold text-slate-800"
                          aria-label={`${row.rating} trên 5 sao`}
                        >
                          <IconStar size={16} className="fill-amber-400 text-amber-400" />
                          {row.rating}/5
                        </span>
                      </td>
                      <td className="min-w-56 max-w-xs px-4 py-3 text-slate-600">
                        {row.comment ? (
                          <p className="line-clamp-3 whitespace-pre-line" title={row.comment}>
                            {row.comment}
                          </p>
                        ) : (
                          <span className="text-slate-400">Không có bình luận</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.isHidden
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {row.isHidden ? 'Đã ẩn' : 'Đang hiện'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={busy}
                          disabled={toggle.isPending}
                          aria-label={`${row.isHidden ? 'Bỏ ẩn' : 'Ẩn'} đánh giá của ${row.user.email}`}
                          onClick={() => toggle.mutate(row)}
                        >
                          {row.isHidden ? 'Bỏ ẩn' : 'Ẩn'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <nav
            aria-label="Phân trang"
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span className="text-slate-600">
              Tổng {data.total} đánh giá · Trang {data.page}/{totalPages}
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
