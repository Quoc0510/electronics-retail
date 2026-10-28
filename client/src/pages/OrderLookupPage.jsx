/**
 * @feature [F13] Đặt hàng không cần đăng nhập - Trang /tra-cuu-don-hang: khách không có tài khoản xem lại đơn bằng mã đơn
 * và số điện thoại nhận hàng. Đúng cả hai mới xem được (sai một trong hai đều báo "không tìm thấy" như nhau, không lộ đơn có
 * tồn tại). Đơn của thành viên được bảo vệ bằng đăng nhập nên không tra được ở đây.
 */
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, FormField, IconBag, isValidPhone, useFormState } from '@techstore/shared';
import { api } from '../lib/api.js';
import { rememberGuestOrder } from '../lib/guestOrder.js';
import { useAuth } from '../context/AuthContext.jsx';

// Giống ORDER_CODE_PATTERN ở backend; khách gõ chữ thường vẫn được (đổi sang chữ hoa trước khi kiểm tra)
const CODE_PATTERN = /^TS\d{6}-[A-HJ-NP-Z2-9]{4}$/;

const validate = (values) => {
  const errors = {};
  if (!CODE_PATTERN.test(values.code.trim().toUpperCase())) {
    errors.code = 'Mã đơn hàng có dạng TS261028-AB3K';
  }
  if (!isValidPhone(values.phone)) errors.phone = 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0';
  return errors;
};

export default function OrderLookupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  // Mã đơn có thể được điền sẵn từ liên kết (ví dụ mở lại trang đơn khi đã mất số điện thoại ở tab này)
  const form = useFormState({ code: params.get('code') ?? '', phone: '' });

  useEffect(() => {
    document.title = 'Tra cứu đơn hàng - TechStore';
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, []);

  const submit = async (values) => {
    const code = values.code.trim().toUpperCase();
    const phone = values.phone.trim();
    const { data: order } = await api.post('/orders/lookup', { code, phone });
    rememberGuestOrder(code, phone);
    // Đã có sẵn đơn nên ghi vào cache để trang đơn hàng hiện ngay, không tải lại
    queryClient.setQueryData(['orders', 'guest', code, phone], order);
    navigate(`/don-hang/${code}`);
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <IconBag size={26} />
        </span>
        <h1 className="text-3xl font-bold text-slate-900">Tra cứu đơn hàng</h1>
        <p className="text-slate-600">
          Dành cho đơn đặt khi chưa đăng nhập. Nhập mã đơn và số điện thoại nhận hàng đã dùng khi
          đặt.
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit(validate, submit)}
        aria-label="Tra cứu đơn hàng"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        noValidate
      >
        <FormField
          label="Mã đơn hàng"
          placeholder="Ví dụ: TS261028-AB3K"
          autoComplete="off"
          {...form.bind('code')}
        />
        <FormField
          label="Số điện thoại nhận hàng"
          type="tel"
          placeholder="0912345678"
          {...form.bind('phone')}
        />
        {form.serverError && <Alert>{form.serverError}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={form.submitting}>
          Tra cứu
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        {user ? (
          <>
            Đơn đặt khi đã đăng nhập nằm ở{' '}
            <Link to="/don-hang" className="font-semibold text-brand-600 hover:underline">
              Đơn hàng của tôi
            </Link>
            .
          </>
        ) : (
          <>
            Đơn đặt khi đã đăng nhập thì{' '}
            <Link
              to="/dang-nhap"
              state={{ from: { pathname: '/don-hang' } }}
              className="font-semibold text-brand-600 hover:underline"
            >
              đăng nhập
            </Link>{' '}
            để xem.
          </>
        )}
      </p>
    </div>
  );
}
