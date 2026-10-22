/**
 * @feature [F01] Phân quyền (frontend) - Trang đăng nhập của Admin (US-02, US-05 AC2).
 * Tài khoản không phải ADMIN bị AuthContext từ chối và hiện thông báo lỗi ngay tại đây.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Button, FormField, isValidEmail, useFormState } from '@techstore/shared';
import { useAuth } from '../context/AuthContext.jsx';

const validate = ({ email, password }) => {
  const errors = {};
  if (!email.trim()) errors.email = 'Vui lòng nhập email';
  else if (!isValidEmail(email)) errors.email = 'Email không đúng định dạng';
  if (!password) errors.password = 'Vui lòng nhập mật khẩu';
  return errors;
};

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const form = useFormState({ email: '', password: '' });

  const redirectTo = location.state?.from?.pathname ?? '/';
  if (user) return <Navigate to={redirectTo} replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="text-2xl font-bold text-slate-900">TechStore Admin</h1>
        <p className="mb-6 text-sm text-slate-500">Đăng nhập để quản lý cửa hàng</p>

        <form
          onSubmit={form.handleSubmit(validate, ({ email, password }) =>
            login(email.trim(), password),
          )}
          className="space-y-4"
          noValidate
        >
          {form.serverError && <Alert>{form.serverError}</Alert>}

          <FormField label="Email" type="email" autoComplete="username" {...form.bind('email')} />
          <FormField
            label="Mật khẩu"
            type="password"
            autoComplete="current-password"
            {...form.bind('password')}
          />

          <Button type="submit" loading={form.submitting} className="w-full">
            Đăng nhập
          </Button>
        </form>
      </div>
    </div>
  );
}
