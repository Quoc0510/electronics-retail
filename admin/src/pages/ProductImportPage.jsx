/**
 * @feature [F14] Nhập sản phẩm từ Excel - Trang /san-pham/nhap-excel của Admin (US-35 thêm mới, US-36 cập nhật).
 * Luồng ba bước: chọn chế độ và tải file mẫu -> chọn file .xlsx rồi XEM TRƯỚC (dòng đúng, dòng sai kèm cột và lý do, chưa ghi gì)
 * -> bấm Nhập để ghi các dòng đúng. Dòng sai được bỏ qua và có thể tải về (kèm cột "Lỗi") để sửa rồi nhập lại.
 * Hai chế độ tách riêng để không sửa nhầm: "Thêm mới" bỏ qua SKU đã có, "Cập nhật" bỏ qua SKU chưa có.
 * Máy chủ đọc và kiểm tra lại file ở bước Nhập, nên kết quả luôn theo dữ liệu mới nhất chứ không theo bản xem trước.
 */
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, IconCheckCircle, IconPlus, getErrorMessage } from '@techstore/shared';
import { api } from '../lib/api.js';
import PageHeader from '../components/PageHeader.jsx';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // khớp giới hạn của máy chủ

const MODES = {
  create: {
    label: 'Thêm sản phẩm mới',
    hint: 'Chỉ thêm sản phẩm chưa có. Dòng có SKU đã tồn tại sẽ bị bỏ qua và báo lỗi.',
    importLabel: 'Thêm',
    templateName: 'mau-nhap-san-pham.xlsx',
  },
  update: {
    label: 'Cập nhật sản phẩm đã có',
    hint: 'Chỉ sửa sản phẩm đã có theo SKU. Ô để trống thì giữ nguyên; dòng có SKU chưa tồn tại sẽ bị bỏ qua và báo lỗi.',
    importLabel: 'Cập nhật',
    templateName: 'cap-nhat-san-pham.xlsx',
  },
};

const STATUS = {
  OK: { label: 'Hợp lệ', className: 'bg-emerald-100 text-emerald-700' },
  ERROR: { label: 'Lỗi', className: 'bg-rose-100 text-rose-700' },
  CREATED: { label: 'Đã thêm', className: 'bg-emerald-100 text-emerald-700' },
  UPDATED: { label: 'Đã cập nhật', className: 'bg-emerald-100 text-emerald-700' },
};

// Lưu dữ liệu nhị phân thành file tải về (file mẫu, file dòng lỗi)
const saveBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const toForm = (file) => {
  const form = new FormData();
  form.append('file', file);
  return form;
};

const describeError = (error) =>
  error.column ? `${error.column}: ${error.message}` : error.message;

function Summary({ items }) {
  return (
    <dl className="flex flex-wrap gap-3">
      {items.map(({ label, value, tone }) => (
        <div key={label} className={`rounded-xl px-4 py-2 ${tone}`}>
          <dt className="text-xs uppercase tracking-wide opacity-80">{label}</dt>
          <dd className="text-xl font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RowsTable({ rows }) {
  return (
    <div className="max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-card">
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3 font-medium">Dòng</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium">SKU</th>
            <th className="whitespace-nowrap px-4 py-3 font-medium">Trạng thái</th>
            <th className="px-4 py-3 font-medium">Chi tiết lỗi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const status = STATUS[row.status];
            return (
              <tr key={row.row} className={row.status === 'ERROR' ? 'bg-rose-50/50' : ''}>
                <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">{row.row}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono font-semibold text-slate-900">
                  {row.sku || '(trống)'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status.className}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-rose-700">
                  {row.errors.length > 0 && (
                    <ul className="list-disc space-y-0.5 pl-4">
                      {row.errors.map((error) => (
                        <li key={describeError(error)}>{describeError(error)}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ProductImportPage() {
  const queryClient = useQueryClient();
  const fileInput = useRef(null);
  const [mode, setMode] = useState('create');
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');

  const params = { mode };
  const reset = () => {
    previewMutation.reset();
    importMutation.reset();
  };

  const template = useMutation({
    mutationFn: () =>
      api
        .get('/admin/products/import/template', { params, responseType: 'blob' })
        .then((res) => res.data),
    onSuccess: (blob) => saveBlob(blob, MODES[mode].templateName),
  });
  const previewMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/products/import/preview', toForm(file), { params }).then((res) => res.data),
  });
  const importMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/products/import', toForm(file), { params }).then((res) => res.data),
    // Sản phẩm vừa đổi nên làm mới mọi danh sách sản phẩm đang được lưu đệm
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/admin/products'] }),
  });
  const errorFile = useMutation({
    mutationFn: () =>
      api
        .post('/admin/products/import/errors', toForm(file), { params, responseType: 'blob' })
        .then((res) => res.data),
    onSuccess: (blob) => saveBlob(blob, 'dong-loi.xlsx'),
  });

  const chooseMode = (next) => {
    setMode(next);
    reset();
    errorFile.reset();
  };

  const chooseFile = (event) => {
    const chosen = event.target.files?.[0] ?? null;
    reset();
    errorFile.reset();
    setFileError('');
    if (chosen && !chosen.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null);
      setFileError('Chỉ nhận file Excel định dạng .xlsx');
      return;
    }
    if (chosen && chosen.size > MAX_FILE_SIZE) {
      setFile(null);
      setFileError('File tối đa 2MB');
      return;
    }
    setFile(chosen);
  };

  const clearFile = () => {
    setFile(null);
    reset();
    errorFile.reset();
    if (fileInput.current) fileInput.current.value = '';
  };

  const result = importMutation.data;
  const previewData = previewMutation.data;
  const busy = previewMutation.isPending || importMutation.isPending;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nhập sản phẩm từ Excel"
        description="Thêm hoặc cập nhật nhiều sản phẩm cùng lúc bằng file .xlsx"
      >
        <Link
          to="/san-pham"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Về danh sách sản phẩm
        </Link>
      </PageHeader>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-bold text-slate-900">1. Chọn kiểu nhập và tải file mẫu</h2>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Kiểu nhập</legend>
          {Object.entries(MODES).map(([key, item]) => (
            <label
              key={key}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition ${
                mode === key
                  ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                  : 'border-slate-200 hover:border-brand-300'
              }`}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === key}
                onChange={() => chooseMode(key)}
                className="mt-1"
              />
              <span>
                <span className="block font-semibold text-slate-900">{item.label}</span>
                <span className="block text-slate-600">{item.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => template.mutate()}
            loading={template.isPending}
          >
            Tải file mẫu
          </Button>
          <p className="text-sm text-slate-500">
            {mode === 'update'
              ? 'File mẫu đã điền sẵn các sản phẩm hiện có để bạn sửa tại chỗ.'
              : 'File mẫu có sẵn tiêu đề cột, danh sách danh mục, thương hiệu và hướng dẫn. Tối đa 500 dòng mỗi lần.'}
          </p>
        </div>
        {template.isError && <Alert>{getErrorMessage(template.error)}</Alert>}
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-lg font-bold text-slate-900">2. Chọn file và xem trước</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="import-file" className="text-sm font-medium text-slate-700">
            File Excel (.xlsx)
          </label>
          <input
            id="import-file"
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={chooseFile}
            className="text-sm"
          />
          <Button
            onClick={() => previewMutation.mutate()}
            disabled={!file || busy || Boolean(result)}
            loading={previewMutation.isPending}
          >
            Xem trước
          </Button>
          {file && (
            <Button variant="ghost" onClick={clearFile} disabled={busy}>
              Chọn file khác
            </Button>
          )}
        </div>
        {fileError && <Alert>{fileError}</Alert>}
        {previewMutation.isError && <Alert>{getErrorMessage(previewMutation.error)}</Alert>}
      </section>

      {previewData && !result && (
        <section
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
          aria-label="Kết quả xem trước"
        >
          <h2 className="text-lg font-bold text-slate-900">3. Kết quả xem trước</h2>
          <Summary
            items={[
              {
                label: 'Tổng số dòng',
                value: previewData.summary.total,
                tone: 'bg-slate-100 text-slate-800',
              },
              {
                label: 'Hợp lệ',
                value: previewData.summary.ok,
                tone: 'bg-emerald-50 text-emerald-800',
              },
              { label: 'Lỗi', value: previewData.summary.failed, tone: 'bg-rose-50 text-rose-800' },
            ]}
          />
          {previewData.ignoredColumns.length > 0 && (
            <p role="status" className="text-sm text-amber-700">
              Các cột không nhận ra nên bị bỏ qua: {previewData.ignoredColumns.join(', ')}.
            </p>
          )}
          <RowsTable rows={previewData.rows} />
          {importMutation.isError && <Alert>{getErrorMessage(importMutation.error)}</Alert>}
          {errorFile.isError && <Alert>{getErrorMessage(errorFile.error)}</Alert>}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => importMutation.mutate()}
              disabled={previewData.summary.ok === 0 || busy}
              loading={importMutation.isPending}
            >
              <IconPlus size={16} />
              {MODES[mode].importLabel} {previewData.summary.ok} dòng hợp lệ
            </Button>
            {previewData.summary.failed > 0 && (
              <Button
                variant="secondary"
                onClick={() => errorFile.mutate()}
                loading={errorFile.isPending}
                disabled={busy}
              >
                Tải các dòng lỗi để sửa
              </Button>
            )}
          </div>
          {previewData.summary.failed > 0 && previewData.summary.ok > 0 && (
            <p className="text-sm text-slate-500">
              Chỉ các dòng hợp lệ được nhập; dòng lỗi được bỏ qua.
            </p>
          )}
        </section>
      )}

      {result && (
        <section
          className="space-y-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-card"
          aria-label="Kết quả nhập"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-800">
            <IconCheckCircle size={22} /> Đã nhập xong
          </h2>
          <Summary
            items={[
              ...(result.mode === 'create'
                ? [
                    {
                      label: 'Đã thêm',
                      value: result.summary.created,
                      tone: 'bg-emerald-50 text-emerald-800',
                    },
                  ]
                : [
                    {
                      label: 'Đã cập nhật',
                      value: result.summary.updated,
                      tone: 'bg-emerald-50 text-emerald-800',
                    },
                  ]),
              {
                label: 'Bị bỏ qua (lỗi)',
                value: result.summary.failed,
                tone: 'bg-rose-50 text-rose-800',
              },
            ]}
          />
          {result.summary.failed > 0 && (
            <RowsTable rows={result.rows.filter((row) => row.status === 'ERROR')} />
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              to="/san-pham"
              className="rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
            >
              Xem danh sách sản phẩm
            </Link>
            <Button variant="secondary" onClick={clearFile}>
              Nhập file khác
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
