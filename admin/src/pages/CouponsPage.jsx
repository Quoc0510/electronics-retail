/**
 * @feature [F09] Quản lý mã giảm giá - Trang /ma-giam-gia của Admin (US-24): xem danh sách mã kèm trạng thái và số lượt đã dùng,
 * tạo mã mới (giảm theo % hoặc số tiền, đơn tối thiểu, thời hạn, số lượt tối đa), sửa mã, bật/tắt mã (AC2).
 * Không có nút xóa: mã đã gắn vào đơn hàng chỉ được tắt. Mã không đổi được sau khi tạo vì đơn cũ đã lưu bản sao mã (BR-04).
 * Mã đang chạy bị sửa thì chỉ ảnh hưởng các đơn đặt sau đó; đơn đã đặt giữ nguyên số tiền giảm.
 * Điều kiện phụ: điểm thành viên tối thiểu và phạm vi áp dụng (sản phẩm, danh mục, thương hiệu - chọn ở CouponScopePicker).
 */
import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  FormField,
  IconPlus,
  SelectField,
  formatDateTime,
  formatVnd,
  getErrorMessage,
  useFormState,
} from '@techstore/shared';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';
import CouponScopePicker, { MAX_SCOPE_ITEMS } from '../components/CouponScopePicker.jsx'; // [F09]

const PAGE_SIZE = 10;
const DAY_MS = 24 * 3600 * 1000;

const controlClass =
  'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';

const STATES = {
  RUNNING: { label: 'Đang chạy', className: 'bg-emerald-100 text-emerald-700' },
  UPCOMING: { label: 'Sắp diễn ra', className: 'bg-brand-100 text-brand-700' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-slate-200 text-slate-700' },
  EXHAUSTED: { label: 'Hết lượt', className: 'bg-amber-100 text-amber-800' },
  DISABLED: { label: 'Đã tắt', className: 'bg-slate-200 text-slate-700' },
};

const TYPE_OPTIONS = [
  { value: 'PERCENT', label: 'Giảm theo phần trăm (%)' },
  { value: 'FIXED', label: 'Giảm số tiền cố định (₫)' },
];

const describeValue = (coupon) =>
  coupon.type === 'PERCENT' ? `${coupon.value}%` : formatVnd(coupon.value);

// <input type="datetime-local"> dùng giờ địa phương dạng "2026-10-30T09:00"; máy chủ lưu và trả giờ UTC (ISO)
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const emptyForm = () => {
  const now = Date.now();
  return {
    code: '',
    type: 'PERCENT',
    value: '',
    minOrder: '0',
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(now + 30 * DAY_MS),
    maxUses: '100',
    minPoints: '0',
    products: [],
    categoryIds: [],
    brandIds: [],
  };
};

const formFromCoupon = (coupon) => ({
  code: coupon.code,
  type: coupon.type,
  value: String(coupon.value),
  minOrder: String(coupon.minOrder),
  startsAt: toLocalInput(coupon.startsAt),
  endsAt: toLocalInput(coupon.endsAt),
  maxUses: String(coupon.maxUses),
  minPoints: String(coupon.minPoints),
  products: coupon.scope.products,
  categoryIds: coupon.scope.categories.map((item) => item.id),
  brandIds: coupon.scope.brands.map((item) => item.id),
});

const isWholeNumber = (text) => /^\d+$/.test(text.trim());

const validate = (values, editing) => {
  const errors = {};
  if (!editing && !/^[A-Za-z0-9_-]{3,30}$/.test(values.code.trim())) {
    errors.code = 'Mã gồm 3-30 ký tự: chữ, số, dấu gạch ngang hoặc gạch dưới';
  }
  if (!isWholeNumber(values.value) || Number(values.value) < 1) {
    errors.value = 'Mức giảm phải là số nguyên lớn hơn 0';
  } else if (values.type === 'PERCENT' && Number(values.value) > 100) {
    errors.value = 'Giảm theo phần trăm không được quá 100%';
  }
  if (!isWholeNumber(values.minOrder)) errors.minOrder = 'Đơn tối thiểu phải là số nguyên từ 0';
  if (!isWholeNumber(values.maxUses) || Number(values.maxUses) < 1) {
    errors.maxUses = 'Số lượt tối đa phải là số nguyên từ 1';
  }
  if (!isWholeNumber(values.minPoints)) errors.minPoints = 'Điểm tối thiểu phải là số nguyên từ 0';
  if (
    values.products.length > MAX_SCOPE_ITEMS ||
    values.categoryIds.length > MAX_SCOPE_ITEMS ||
    values.brandIds.length > MAX_SCOPE_ITEMS
  ) {
    errors.scope = `Mỗi loại chọn tối đa ${MAX_SCOPE_ITEMS} mục`;
  }
  const start = new Date(values.startsAt);
  const end = new Date(values.endsAt);
  if (Number.isNaN(start.getTime())) errors.startsAt = 'Vui lòng chọn ngày bắt đầu';
  if (Number.isNaN(end.getTime())) errors.endsAt = 'Vui lòng chọn ngày kết thúc';
  if (!errors.startsAt && !errors.endsAt && end <= start) {
    errors.endsAt = 'Ngày kết thúc phải sau ngày bắt đầu';
  }
  return errors;
};

// Tóm tắt điều kiện phụ của một mã trong bảng; di chuột để xem tên từng mục trong phạm vi
function ScopeSummary({ coupon }) {
  const { products, categories, brands } = coupon.scope;
  const names = (list) => list.map((item) => item.name ?? `#${item.id} (đã xóa)`).join(', ');
  const parts = [
    products.length > 0 && { label: `${products.length} sản phẩm`, title: names(products) },
    categories.length > 0 && { label: `${categories.length} danh mục`, title: names(categories) },
    brands.length > 0 && { label: `${brands.length} thương hiệu`, title: names(brands) },
  ].filter(Boolean);

  return (
    <div className="space-y-0.5">
      <div>
        {parts.length === 0 ? (
          'Mọi sản phẩm'
        ) : (
          <span
            title={parts
              .map((part) => `${part.label}: ${part.title}`)
              .join(String.fromCharCode(10))}
          >
            {parts.map((part) => part.label).join(' · ')}
          </span>
        )}
      </div>
      {coupon.minPoints > 0 && (
        <div className="text-xs text-slate-500">Từ {coupon.minPoints} điểm thành viên</div>
      )}
    </div>
  );
}

function CouponForm({ coupon, onDone, onCancel }) {
  const editing = Boolean(coupon);
  const form = useFormState(coupon ? formFromCoupon(coupon) : emptyForm());
  const queryClient = useQueryClient();

  const submit = async (values) => {
    const payload = {
      type: values.type,
      value: Number(values.value),
      minOrder: Number(values.minOrder),
      startsAt: new Date(values.startsAt).toISOString(),
      endsAt: new Date(values.endsAt).toISOString(),
      maxUses: Number(values.maxUses),
      minPoints: Number(values.minPoints),
      productIds: values.products.map((product) => product.id),
      categoryIds: values.categoryIds,
      brandIds: values.brandIds,
    };
    if (editing) await api.patch(`/admin/coupons/${coupon.id}`, payload);
    else await api.post('/admin/coupons', { ...payload, code: values.code.trim() });
    await queryClient.invalidateQueries({ queryKey: ['/admin/coupons'] });
    onDone();
  };

  return (
    <form
      onSubmit={form.handleSubmit((values) => validate(values, editing), submit)}
      aria-label={editing ? `Sửa mã ${coupon.code}` : 'Thêm mã giảm giá'}
      noValidate
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
    >
      <h2 className="text-lg font-bold text-slate-900">
        {editing ? `Sửa mã ${coupon.code}` : 'Thêm mã giảm giá'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Mã giảm giá"
          {...form.bind('code')}
          disabled={editing}
          maxLength={30}
          placeholder="Ví dụ: KHAITRUONG10"
          autoComplete="off"
        />
        <SelectField label="Loại giảm" options={TYPE_OPTIONS} {...form.bind('type')} />
        <FormField
          label={form.values.type === 'PERCENT' ? 'Mức giảm (%)' : 'Số tiền giảm (₫)'}
          inputMode="numeric"
          {...form.bind('value')}
        />
        <FormField label="Đơn tối thiểu (₫)" inputMode="numeric" {...form.bind('minOrder')} />
        <FormField label="Bắt đầu" type="datetime-local" {...form.bind('startsAt')} />
        <FormField label="Kết thúc" type="datetime-local" {...form.bind('endsAt')} />
        <FormField label="Số lượt dùng tối đa" inputMode="numeric" {...form.bind('maxUses')} />
        <FormField
          label="Điểm thành viên tối thiểu"
          inputMode="numeric"
          {...form.bind('minPoints')}
        />
      </div>
      <p className="-mt-2 text-sm text-slate-500">
        Điểm tối thiểu: người dùng mã phải đang có ít nhất chừng này điểm thành viên (0 = không yêu
        cầu). Khách chưa đăng nhập tính là 0 điểm.
      </p>
      <CouponScopePicker
        products={form.values.products}
        categoryIds={form.values.categoryIds}
        brandIds={form.values.brandIds}
        onChange={(patch) =>
          Object.entries(patch).forEach(([name, value]) => form.setFieldValue(name, value))
        }
      />
      {/* Lỗi của ô phạm vi (kiểm tra ở form hoặc do máy chủ báo id không tồn tại): ba danh sách không phải FormField nên tự hiện */}
      {[form.errors.scope, form.errors.productIds, form.errors.categoryIds, form.errors.brandIds]
        .filter(Boolean)
        .map((message) => (
          <p key={message} role="alert" className="text-sm text-rose-600">
            {message}
          </p>
        ))}
      {editing && (
        <p className="text-sm text-slate-500">
          Đã dùng {coupon.usedCount} lượt. Số lượt tối đa không được nhỏ hơn số này. Đơn đã đặt giữ
          nguyên số tiền giảm.
        </p>
      )}
      {form.serverError && <Alert>{form.serverError}</Alert>}
      <div className="flex gap-3">
        <Button type="submit" loading={form.submitting}>
          {editing ? 'Lưu thay đổi' : 'Tạo mã'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export default function CouponsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  // null = đóng form; 'new' = thêm mã; một mã = đang sửa mã đó
  const [formTarget, setFormTarget] = useState(null);

  // Chờ người dùng ngừng gõ 300ms mới tìm; chỉ về trang 1 khi từ khóa thật sự đổi
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
  };

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['/admin/coupons', 'list', params],
    queryFn: () => api.get('/admin/coupons', { params }).then((res) => res.data),
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: (target) =>
      api.patch(`/admin/coupons/${target.id}`, { isActive: !target.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/admin/coupons'] }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasFilter = Boolean(search || status);

  return (
    <div className="space-y-4">
      <PageHeader title="Mã giảm giá" description="Tạo mã khuyến mãi cho khách dùng khi thanh toán">
        {formTarget === null && (
          <Button onClick={() => setFormTarget('new')}>
            <IconPlus size={18} />
            Thêm mã giảm giá
          </Button>
        )}
      </PageHeader>

      {formTarget !== null && (
        <CouponForm
          key={formTarget === 'new' ? 'new' : formTarget.id}
          coupon={formTarget === 'new' ? null : formTarget}
          onDone={() => setFormTarget(null)}
          onCancel={() => setFormTarget(null)}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          aria-label="Tìm mã giảm giá"
          placeholder="Tìm theo mã..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          className={`${controlClass} w-full max-w-xs`}
        />
        <select
          aria-label="Lọc theo bật tắt"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          className={controlClass}
        >
          <option value="">Tất cả mã</option>
          <option value="on">Đang bật</option>
          <option value="off">Đã tắt</option>
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
          {hasFilter ? 'Không có mã nào khớp bộ lọc.' : 'Chưa có mã giảm giá nào.'}
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Mã</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Mức giảm</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Đơn tối thiểu</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Điều kiện</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Thời hạn</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Đã dùng</th>
                  <th className="whitespace-nowrap px-4 py-3 font-medium">Trạng thái</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 [&>tr]:transition [&>tr:hover]:bg-brand-50/40">
                {data.items.map((coupon) => {
                  const state = STATES[coupon.state];
                  const busy = toggle.isPending && toggle.variables?.id === coupon.id;
                  return (
                    <tr key={coupon.id} className={coupon.isActive ? '' : 'bg-slate-50/70'}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono font-semibold text-slate-900">
                        {coupon.code}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-rose-600">
                        {describeValue(coupon)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {coupon.minOrder > 0 ? formatVnd(coupon.minOrder) : 'Không'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <ScopeSummary coupon={coupon} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDateTime(coupon.startsAt)}
                        <br />
                        <span className="text-xs text-slate-500">
                          đến {formatDateTime(coupon.endsAt)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {coupon.usedCount}/{coupon.maxUses}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${state.className}`}
                        >
                          {state.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`Sửa mã ${coupon.code}`}
                            onClick={() => setFormTarget(coupon)}
                          >
                            Sửa
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy}
                            disabled={toggle.isPending}
                            aria-label={`${coupon.isActive ? 'Tắt' : 'Bật'} mã ${coupon.code}`}
                            onClick={() => toggle.mutate(coupon)}
                          >
                            {coupon.isActive ? 'Tắt' : 'Bật'}
                          </Button>
                        </div>
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
              Tổng {data.total} mã · Trang {data.page}/{totalPages}
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
