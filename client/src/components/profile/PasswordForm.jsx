/**
 * @feature [F01] Xác thực (frontend) - Form đổi mật khẩu (US-04 AC2).
 * Backend thu hồi mọi phiên khi đổi mật khẩu (kể cả phiên hiện tại), nên đổi xong phải đăng nhập lại.
 */
import { Alert, Button, FormField, useFormState, validatePassword } from '@techstore/shared';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';

const validate = ({ currentPassword, newPassword, confirmPassword }) => {
  const errors = {};
  if (!currentPassword) errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
  const passwordError = validatePassword(newPassword);
  if (passwordError) errors.newPassword = passwordError;
  if (!errors.newPassword && confirmPassword !== newPassword) {
    errors.confirmPassword = 'Mật khẩu nhập lại không khớp';
  }
  return errors;
};

export default function PasswordForm() {
  const { logout } = useAuth();
  const form = useFormState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  const submit = async ({ currentPassword, newPassword }) => {
    await api.put('/users/me/password', { currentPassword, newPassword });
    // ProtectedRoute tự chuyển về trang đăng nhập khi mất phiên; thông báo được truyền qua AuthContext
    await logout('Đổi mật khẩu thành công, vui lòng đăng nhập lại bằng mật khẩu mới.');
  };

  return (
    <form onSubmit={form.handleSubmit(validate, submit)} className="max-w-md space-y-4" noValidate>
      {form.serverError && <Alert>{form.serverError}</Alert>}

      <FormField
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        {...form.bind('currentPassword')}
      />
      <FormField
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        {...form.bind('newPassword')}
      />
      <FormField
        label="Nhập lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        {...form.bind('confirmPassword')}
      />

      <Button type="submit" loading={form.submitting}>
        Đổi mật khẩu
      </Button>
    </form>
  );
}
