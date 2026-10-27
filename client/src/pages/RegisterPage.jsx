/**
 * @feature [F01] Xác thực (frontend) - Trang đăng ký tài khoản (US-01).
 * Kiểm tra ngay phía trình duyệt theo đúng quy tắc của backend; đăng ký xong tự đăng nhập (AC3).
 */
import { Link, Navigate } from 'react-router-dom';
import {
  Alert,
  Button,
  FormField,
  isValidEmail,
  isValidPhone,
  useFormState,
  validatePassword,
} from '@techstore/shared';
import { useAuth } from '../context/AuthContext.jsx';
import AuthShell from '../components/AuthShell.jsx';

const validate = ({ fullName, email, phone, password, confirmPassword }) => {
  const errors = {};
  if (!fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên';
  if (!email.trim()) errors.email = 'Vui lòng nhập email';
  else if (!isValidEmail(email)) errors.email = 'Email không đúng định dạng';
  // Số điện thoại không bắt buộc, nhưng nếu nhập thì phải đúng định dạng
  if (phone.trim() && !isValidPhone(phone)) {
    errors.phone = 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0';
  }
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  if (!errors.password && confirmPassword !== password) {
    errors.confirmPassword = 'Mật khẩu nhập lại không khớp';
  }
  return errors;
};

export default function RegisterPage() {
  const { user, register } = useAuth();
  const form = useFormState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  if (user) return <Navigate to="/" replace />;

  const submit = ({ fullName, email, phone, password }) =>
    register({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      // Không gửi trường phone khi để trống (backend không chấp nhận chuỗi rỗng)
      ...(phone.trim() && { phone: phone.trim() }),
    });

  return (
    <AuthShell
      title="Đăng ký tài khoản"
      subtitle="Tạo tài khoản để đặt hàng và theo dõi đơn dễ dàng"
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="font-semibold text-brand-600 hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(validate, submit)} className="space-y-4" noValidate>
        {form.serverError && <Alert>{form.serverError}</Alert>}

        <FormField label="Họ và tên" autoComplete="name" {...form.bind('fullName')} />
        <FormField label="Email" type="email" autoComplete="email" {...form.bind('email')} />
        <FormField
          label="Số điện thoại (không bắt buộc)"
          type="tel"
          autoComplete="tel"
          {...form.bind('phone')}
        />
        <FormField
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          {...form.bind('password')}
        />
        <p className="-mt-2 text-xs text-slate-500">Ít nhất 8 ký tự, gồm cả chữ và số.</p>
        <FormField
          label="Nhập lại mật khẩu"
          type="password"
          autoComplete="new-password"
          {...form.bind('confirmPassword')}
        />

        <Button type="submit" loading={form.submitting} className="w-full" size="lg">
          Đăng ký
        </Button>
      </form>
    </AuthShell>
  );
}
