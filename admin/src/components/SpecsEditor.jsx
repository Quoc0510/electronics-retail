/**
 * @feature [F03] Sản phẩm - Bảng nhập thông số kỹ thuật dạng cặp tên - giá trị (US-08 AC5).
 * rows: [{ name, value }]. Component này chỉ hiển thị và báo thay đổi; việc đổi sang object do form xử lý.
 */
import { Button } from '@techstore/shared';

export default function SpecsEditor({ rows, onChange, error }) {
  const updateRow = (index, field, value) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100';

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-slate-700">Thông số kỹ thuật</legend>

      {rows.length === 0 && (
        <p className="text-sm text-slate-500">Chưa có thông số nào (ví dụ: Màn hình, Chip, RAM).</p>
      )}

      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <input
            aria-label={`Tên thông số ${index + 1}`}
            placeholder="Tên (ví dụ: RAM)"
            value={row.name}
            onChange={(event) => updateRow(index, 'name', event.target.value)}
            className={`${inputClass} flex-1 basis-40`}
          />
          <input
            aria-label={`Giá trị thông số ${index + 1}`}
            placeholder="Giá trị (ví dụ: 8GB)"
            value={row.value}
            onChange={(event) => updateRow(index, 'value', event.target.value)}
            className={`${inputClass} flex-[2] basis-48`}
          />
          <Button
            variant="secondary"
            aria-label={`Xóa thông số ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            Xóa
          </Button>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}

      <Button variant="secondary" onClick={() => onChange([...rows, { name: '', value: '' }])}>
        Thêm thông số
      </Button>
    </fieldset>
  );
}
