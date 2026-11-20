/**
 * @feature [F16] Cài đặt cửa hàng - Trang /cai-dat của Admin: đặt ngưỡng miễn phí vận chuyển (BR-05).
 * Đơn có tiền hàng SAU khi trừ mã giảm giá từ ngưỡng này được miễn phí vận chuyển (cửa hàng chịu phí). Nhập 0 thì không miễn phí
 * cho đơn nào. Đổi xong có hiệu lực ngay cho khách (giỏ hàng, trang đặt hàng) và cho các đơn đặt sau đó; đơn đã đặt giữ nguyên phí.
 * "Dùng mặc định" xóa cài đặt để hệ thống quay về giá trị trong cấu hình máy chủ (SHIPPING_FREE_THRESHOLD).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  FormField,
  formatDateTime,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

const MAX_AMOUNT = 2_000_000_000;
const QUERY_KEY = ['/admin/settings/shipping'];

// Chấp nhận "5000000" hoặc "5.000.000" (người dùng hay gõ dấu chấm ngăn cách hàng nghìn)
const parseAmount = (text) => {
  const digits = text.trim().replaceAll('.', '');
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
};

const describeThreshold = (value) =>
  value === 0
    ? 'không miễn phí vận chuyển cho đơn nào'
    : `miễn phí vận chuyển từ ${formatVnd(value)}`;

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get('/admin/settings/shipping').then((res) => res.data),
  });

  // Ô nhập hiện giá trị đang dùng (từ máy chủ); chỉ khi người dùng đang gõ mới giữ bản nháp riêng, lưu xong thì bỏ nháp
  const [draft, setDraft] = useState(null);
  const [fieldError, setFieldError] = useState('');
  const [saved, setSaved] = useState('');
  const text = draft ?? (data ? String(data.freeThreshold) : '');

  const save = useMutation({
    mutationFn: (freeThreshold) =>
      api.put('/admin/settings/shipping', { freeThreshold }).then((res) => res.data),
    onSuccess: (next, freeThreshold) => {
      queryClient.setQueryData(QUERY_KEY, next);
      setDraft(null);
      setSaved(
        freeThreshold === null
          ? `Đã quay về giá trị mặc định: ${describeThreshold(next.freeThreshold)}.`
          : `Đã lưu: ${describeThreshold(next.freeThreshold)}. Khách thấy ngay ở giỏ hàng và trang đặt hàng.`,
      );
    },
  });

  const submit = (event) => {
    event.preventDefault();
    setSaved('');
    const amount = parseAmount(text);
    if (amount === null) {
      setFieldError('Vui lòng nhập số tiền là số nguyên không âm (đồng)');
      return;
    }
    if (amount > MAX_AMOUNT) {
      setFieldError('Số tiền quá lớn');
      return;
    }
    setFieldError('');
    save.mutate(amount);
  };

  const useDefault = () => {
    setSaved('');
    setFieldError('');
    save.mutate(null);
  };

  const amount = parseAmount(text);
  const unchanged = data && amount === data.freeThreshold;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cài đặt"
        description="Các thiết lập của cửa hàng áp dụng cho khách hàng ngay sau khi lưu"
      />

      {isPending && <p className="text-sm text-slate-500">Đang tải cài đặt...</p>}

      {isError && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {data && (
        <form
          onSubmit={submit}
          noValidate
          aria-label="Miễn phí vận chuyển"
          className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Miễn phí vận chuyển</h2>
            <p className="mt-1 text-sm text-slate-500">
              Đơn có tiền hàng sau khi trừ mã giảm giá từ mức này trở lên được miễn phí vận chuyển
              (cửa hàng chịu phí). Nhập 0 nếu không muốn miễn phí cho đơn nào.
            </p>
          </div>

          {save.isError && <Alert>{getErrorMessage(save.error)}</Alert>}
          {saved && <Alert type="success">{saved}</Alert>}

          <FormField
            label="Ngưỡng miễn phí vận chuyển (₫)"
            inputMode="numeric"
            autoComplete="off"
            value={text}
            error={fieldError}
            onChange={(event) => {
              setDraft(event.target.value);
              setFieldError('');
              setSaved('');
            }}
          />
          {amount !== null && amount <= MAX_AMOUNT && !fieldError && (
            <p className="-mt-2 text-sm text-slate-600">
              {amount === 0 ? 'Không miễn phí cho đơn nào' : `Tương đương ${formatVnd(amount)}`}
            </p>
          )}

          <dl className="grid gap-1 text-sm text-slate-500">
            <div className="flex flex-wrap gap-x-2">
              <dt>Giá trị mặc định của hệ thống:</dt>
              <dd className="font-medium text-slate-700">{formatVnd(data.defaultFreeThreshold)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt>Lần chỉnh gần nhất:</dt>
              <dd className="font-medium text-slate-700">
                {data.updatedAt ? formatDateTime(data.updatedAt) : 'Chưa chỉnh, đang dùng mặc định'}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" loading={save.isPending} disabled={unchanged}>
              Lưu
            </Button>
            <Button
              variant="secondary"
              onClick={useDefault}
              disabled={save.isPending || data.updatedAt === null}
            >
              Dùng mặc định ({formatVnd(data.defaultFreeThreshold)})
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
