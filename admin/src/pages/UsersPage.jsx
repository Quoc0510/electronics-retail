/**
 * @feature [F10] Quản lý người dùng - Trang danh sách người dùng của Admin (US-27): tìm theo email hoặc tên, lọc theo
 * trạng thái, phân trang, khóa và mở khóa tài khoản. Khóa thì người đó bị đăng xuất khỏi mọi thiết bị (AC2);
 * không khóa được chính mình (AC3).
 */
import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, formatDateTime, getErrorMessage } from '@techstore/shared';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageHeader from '../components/PageHeader.jsx';

const PAGE_SIZE = 10;

const controlClass =
  'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';

const ROLE_LABELS = { ADMIN: 'Quản trị viên', CUSTOMER: 'Khách hàng' };

export default function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
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

  const params = {
    page,
    pageSize: PAGE_SIZE,
    ...(search && { search }),
    ...(status && { status }),
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['/admin/users', 'list', params],
    queryFn: () => api.get('/admin/users', { params }).then((res) => res.data),
    // Giữ bảng cũ trong lúc tải kết quả mới, tránh nhấp nháy
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: (target) =>
      api.patch(`/admin/users/${target.id}/status`, { isActive: !target.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/admin/users'] }),
  });

  const handleToggle = (target) => {
    // Khóa là thao tác có hậu quả ngay (đăng xuất mọi thiết bị) nên hỏi lại; mở khóa thì làm luôn
    if (
      target.isActive &&
      !window.confirm(
        `Khóa tài khoản ${target.email}? Người này sẽ bị đăng xuất khỏi mọi thiết bị và không đăng nhập lại được cho tới khi mở khóa.`,
      )
    ) {
      return;
    }
    toggle.mutate(target);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilter = Boolean(search || status);

  return (
    <div className="space-y-4">
      <PageHeader title="Người dùng" description="Xem tài khoản, khóa hoặc mở khóa khi cần" />

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Tìm người dùng"
          placeholder="Tìm theo email hoặc họ tên..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className={`${controlClass} w-full max-w-sm`}
        />
        <select
          aria-label="Lọc theo trạng thái tài khoản"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className={controlClass}
        >
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="locked">Đã khóa</option>
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
          {hasFilter ? 'Không có người dùng nào khớp bộ lọc.' : 'Chưa có người dùng nào.'}
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Người dùng</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Điện thoại</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Đơn hàng</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Điểm</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Ngày đăng ký</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 [&>tr]:transition [&>tr:hover]:bg-brand-50/40">
                {data.items.map((row) => {
                  const isSelf = row.id === me.id;
                  const busy = toggle.isPending && toggle.variables?.id === row.id;
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {row.fullName}
                          {row.role === 'ADMIN' && (
                            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">
                              {ROLE_LABELS.ADMIN}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{row.email}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.phone ?? '–'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.orderCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{row.points}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            row.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {row.isActive ? 'Hoạt động' : 'Đã khóa'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {isSelf ? (
                          <span className="text-xs text-slate-500">Tài khoản của bạn</span>
                        ) : (
                          <Button
                            variant={row.isActive ? 'danger' : 'secondary'}
                            size="sm"
                            loading={busy}
                            disabled={toggle.isPending}
                            aria-label={`${row.isActive ? 'Khóa' : 'Mở khóa'} tài khoản ${row.email}`}
                            onClick={() => handleToggle(row)}
                          >
                            {row.isActive ? 'Khóa' : 'Mở khóa'}
                          </Button>
                        )}
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
              Tổng {data.total} người dùng · Trang {data.page}/{totalPages}
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
