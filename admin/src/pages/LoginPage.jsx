/**
 * @feature [F01] Phân quyền (frontend) - Trang đăng nhập của Admin (US-02, US-05 AC2).
 * Tài khoản không phải ADMIN bị AuthContext từ chối và hiện thông báo lỗi ngay tại đây.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Button, FormField, Logo, isValidEmail, useFormState } from '@techstore/shared';
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
    <div className="surface-dark relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-900 p-4">
      <div className="bg-tech-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -right-24 bottom-1/4 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white p-8 shadow-2xl animate-fade-up sm:p-10">
        <div className="mb-8 space-y-4">
          <Logo tone="dark" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">TechStore Admin</h1>
            <p className="text-sm text-slate-500">Đăng nhập để quản lý cửa hàng</p>
          </div>
        </div>

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

          <Button type="submit" loading={form.submitting} className="w-full" size="lg">
            Đăng nhập
          </Button>
        </form>
      </div>
    </div>
  );
}
