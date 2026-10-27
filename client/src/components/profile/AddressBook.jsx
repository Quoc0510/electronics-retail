/**
 * @feature [F01] Xác thực (frontend) - Sổ địa chỉ giao hàng: xem, thêm, sửa, xóa, đặt mặc định (US-04 AC3).
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  FormField,
  getErrorMessage,
  isValidPhone,
  useFormState,
} from '@techstore/shared';
import { api } from '../../lib/api.js';

const EMPTY_ADDRESS = {
  recipientName: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  street: '',
  isDefault: false,
};

const REQUIRED_FIELDS = {
  recipientName: 'Vui lòng nhập tên người nhận',
  province: 'Vui lòng nhập tỉnh/thành phố',
  district: 'Vui lòng nhập quận/huyện',
  ward: 'Vui lòng nhập phường/xã',
  street: 'Vui lòng nhập số nhà, tên đường',
};

const validate = (values) => {
  const errors = {};
  Object.entries(REQUIRED_FIELDS).forEach(([field, message]) => {
    if (!values[field].trim()) errors[field] = message;
  });
  if (!isValidPhone(values.phone)) errors.phone = 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0';
  return errors;
};

// Form thêm hoặc sửa một địa chỉ. address = null nghĩa là thêm mới
function AddressForm({ address, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const form = useFormState(address ?? EMPTY_ADDRESS);

  const submit = async ({ id: _id, userId: _userId, createdAt: _c, updatedAt: _u, ...values }) => {
    const payload = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() : value,
      ]),
    );
    if (address) await api.patch(`/users/me/addresses/${address.id}`, payload);
    else await api.post('/users/me/addresses', payload);
    await queryClient.invalidateQueries({ queryKey: ['addresses'] });
    onDone();
  };

  return (
    <form
      onSubmit={form.handleSubmit(validate, submit)}
      aria-label={address ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}
      className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
      noValidate
    >
      {form.serverError && <Alert>{form.serverError}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Tên người nhận" {...form.bind('recipientName')} />
        <FormField label="Số điện thoại người nhận" type="tel" {...form.bind('phone')} />
        <FormField label="Tỉnh/Thành phố" {...form.bind('province')} />
        <FormField label="Quận/Huyện" {...form.bind('district')} />
        <FormField label="Phường/Xã" {...form.bind('ward')} />
        <FormField label="Số nhà, tên đường" {...form.bind('street')} />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.values.isDefault}
          onChange={form.bind('isDefault').onChange}
        />
        Đặt làm địa chỉ mặc định
      </label>

      <div className="flex gap-2">
        <Button type="submit" loading={form.submitting}>
          Lưu địa chỉ
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Hủy
        </Button>
      </div>
    </form>
  );
}

export default function AddressBook() {
  const queryClient = useQueryClient();
  // null: đang xem danh sách; 'new': đang thêm; object: đang sửa địa chỉ đó
  const [editing, setEditing] = useState(null);

  const {
    data: addresses,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/me/addresses').then((res) => res.data),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/users/me/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const makeDefault = useMutation({
    mutationFn: (id) => api.patch(`/users/me/addresses/${id}`, { isDefault: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
  });

  const handleDelete = (address) => {
    if (window.confirm(`Xóa địa chỉ "${address.street}"?`)) remove.mutate(address.id);
  };

  if (isPending)
    return (
      <p role="status" className="text-slate-500">
        Đang tải địa chỉ...
      </p>
    );
  if (isError) return <Alert>{getErrorMessage(error)}</Alert>;

  if (editing) {
    return (
      <AddressForm
        address={editing === 'new' ? null : editing}
        onDone={() => setEditing(null)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  const mutationError = remove.error ?? makeDefault.error;

  return (
    <div className="space-y-4">
      {mutationError && <Alert>{getErrorMessage(mutationError)}</Alert>}

      {addresses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
          Bạn chưa có địa chỉ nào. Hãy thêm địa chỉ để đặt hàng nhanh hơn.
        </p>
      ) : (
        <ul className="space-y-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className={`rounded-2xl border p-5 transition ${address.isDefault ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{address.recipientName}</span>
                <span className="text-slate-600">{address.phone}</span>
                {address.isDefault && (
                  <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Mặc định
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm text-slate-600">
                {address.street}, {address.ward}, {address.district}, {address.province}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setEditing(address)}>
                  Sửa
                </Button>
                {!address.isDefault && (
                  <Button variant="secondary" onClick={() => makeDefault.mutate(address.id)}>
                    Đặt làm mặc định
                  </Button>
                )}
                <Button variant="danger" onClick={() => handleDelete(address)}>
                  Xóa
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button onClick={() => setEditing('new')}>Thêm địa chỉ mới</Button>
    </div>
  );
}
