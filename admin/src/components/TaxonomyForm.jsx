/**
 * @feature [F02] Danh mục và thương hiệu - Form thêm hoặc sửa một danh mục/thương hiệu (US-06, US-07).
 * item = null nghĩa là thêm mới. Dùng chung cho cả hai loại, khác nhau ở tên trường ảnh và có mô tả hay không.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FormField, isValidHttpUrl, useFormState } from '@techstore/shared';
import { api } from '../lib/api.js';

export default function TaxonomyForm({
  path,
  noun,
  item,
  imageField,
  imageLabel,
  withDescription,
  onDone,
  onCancel,
}) {
  const queryClient = useQueryClient();
  const form = useFormState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    [imageField]: item?.[imageField] ?? '',
    isActive: item?.isActive ?? true,
  });

  const validate = (values) => {
    const errors = {};
    if (!values.name.trim()) errors.name = 'Vui lòng nhập tên';
    else if (values.name.trim().length > 100) errors.name = 'Tên tối đa 100 ký tự';
    if (withDescription && values.description.trim().length > 500) {
      errors.description = 'Mô tả tối đa 500 ký tự';
    }
    const image = values[imageField].trim();
    if (image && !isValidHttpUrl(image)) {
      errors[imageField] = 'Đường dẫn phải bắt đầu bằng http:// hoặc https://';
    }
    return errors;
  };

  const submit = async (values) => {
    // Ô ảnh/mô tả để trống thì gửi chuỗi rỗng, backend hiểu là xóa giá trị
    const payload = {
      name: values.name.trim(),
      [imageField]: values[imageField].trim(),
      isActive: values.isActive,
      ...(withDescription && { description: values.description.trim() }),
    };
    if (item) await api.patch(`${path}/${item.id}`, payload);
    else await api.post(path, payload);
    await queryClient.invalidateQueries({ queryKey: [path] });
    onDone();
  };

  return (
    <form
      onSubmit={form.handleSubmit(validate, submit)}
      aria-label={item ? `Sửa ${noun}` : `Thêm ${noun}`}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
      noValidate
    >
      <h2 className="text-lg font-semibold text-slate-900">
        {item ? `Sửa ${noun}` : `Thêm ${noun} mới`}
      </h2>

      {form.serverError && <Alert>{form.serverError}</Alert>}

      <FormField label="Tên" {...form.bind('name')} />
      {withDescription && <FormField label="Mô tả" multiline {...form.bind('description')} />}
      <FormField label={imageLabel} type="url" {...form.bind(imageField)} />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.values.isActive}
          onChange={form.bind('isActive').onChange}
        />
        Hiển thị trên website
      </label>

      <div className="flex gap-2">
        <Button type="submit" loading={form.submitting}>
          Lưu
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}
