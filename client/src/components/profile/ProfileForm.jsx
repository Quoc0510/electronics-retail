/**
 * @feature [F01] Xác thực (frontend) - Form sửa họ tên và số điện thoại (US-04 AC1).
 * Email hiển thị nhưng không cho sửa (backend cũng không nhận thay đổi email).
 */
import { useState } from 'react';
import { Alert, Button, FormField, isValidPhone, useFormState } from '@techstore/shared';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const validate = ({ fullName, phone }) => {
  const errors = {};
  if (!fullName.trim()) errors.fullName = 'Họ tên không được để trống';
  if (phone.trim() && !isValidPhone(phone)) {
    errors.phone = 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0';
  }
  return errors;
};

export default function ProfileForm() {
  const { user, setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const form = useFormState({ fullName: user.fullName, phone: user.phone ?? '' });

  const submit = async ({ fullName, phone }) => {
    setSaved(false);
    // Gửi null để xóa số điện thoại khi người dùng để trống
    const res = await api.patch('/users/me', {
      fullName: fullName.trim(),
      phone: phone.trim() || null,
    });
    setUser(res.data);
    setSaved(true);
  };

  return (
    <form onSubmit={form.handleSubmit(validate, submit)} className="max-w-md space-y-4" noValidate>
      {form.serverError && <Alert>{form.serverError}</Alert>}
      {saved && <Alert type="success">Đã lưu thay đổi</Alert>}

      <FormField label="Email" value={user.email} disabled readOnly />
      <FormField label="Họ và tên" autoComplete="name" {...form.bind('fullName')} />
      <FormField label="Số điện thoại" type="tel" autoComplete="tel" {...form.bind('phone')} />

      <Button type="submit" loading={form.submitting}>
        Lưu thay đổi
      </Button>
    </form>
  );
}
