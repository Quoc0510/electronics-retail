/**
 * @feature [F01] Xác thực (frontend) - Trang đăng nhập (US-02).
 * Đăng nhập xong quay lại trang người dùng đang định vào (nếu bị chặn bởi ProtectedRoute), mặc định về trang chủ.
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Alert, Button, FormField, isValidEmail, useFormState } from '@techstore/shared';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';

const validate = ({ email, password }) => {
  const errors = {};
  if (!email.trim()) errors.email = 'Vui lòng nhập email';
  else if (!isValidEmail(email)) errors.email = 'Email không đúng định dạng';
  if (!password) errors.password = 'Vui lòng nhập mật khẩu';
  return errors;
};

export default function LoginPage() {
  const { user, login, notice, clearNotice } = useAuth();
  const location = useLocation();
  const form = useFormState({ email: '', password: '' });

  // Giữ thông báo (ví dụ "đổi mật khẩu thành công") trong state của trang rồi xóa khỏi context,
  // để lần sau quay lại trang đăng nhập không hiện lại thông báo cũ
  const [flash] = useState(notice);
  useEffect(() => {
    clearNotice();
  }, [clearNotice]);

  const redirectTo = location.state?.from?.pathname ?? '/';
  // Đăng nhập thành công làm user có giá trị, trang tự chuyển hướng ở dòng dưới
  if (user) return <Navigate to={redirectTo} replace />;

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Chào mừng bạn quay lại TechStore"
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/dang-ky" className="font-semibold text-brand-600 hover:underline">
            Đăng ký ngay
          </Link>
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit(validate, ({ email, password }) =>
          login(email.trim(), password),
        )}
        className="space-y-4"
        noValidate
      >
        {flash && <Alert type="success">{flash}</Alert>}
        {form.serverError && <Alert>{form.serverError}</Alert>}

        <FormField label="Email" type="email" autoComplete="email" {...form.bind('email')} />
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
    </AuthShell>
  );
}
