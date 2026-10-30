/**
 * @feature [F09] Mã giảm giá - Xem trước số tiền giảm của mã khách đang nhập ở trang đặt hàng (US-25 AC1, AC2).
 *
 * Gọi POST /coupons/preview (công khai, khách chưa đăng nhập cũng dùng được). Khóa cache gồm cả tiền hàng nên giỏ đổi
 * (hoặc mã từng hợp lệ nay hết hạn) thì kết quả tự được kiểm tra lại. Đây chỉ là bản xem trước: số tiền giảm thật do
 * máy chủ tính lại khi đặt hàng, nên mã đang lỗi thì KHÔNG được gửi kèm đơn.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useCouponPreview(code, subtotal) {
  const query = useQuery({
    queryKey: ['coupon-preview', code, subtotal],
    queryFn: () => api.post('/coupons/preview', { code, subtotal }).then((res) => res.data),
    enabled: Boolean(code) && subtotal > 0,
    retry: false,
    staleTime: 30_000,
  });

  // Kiểm tra lại mà lỗi thì react-query vẫn giữ kết quả thành công cũ trong `data`: phải bỏ nó đi, nếu không mã đã hết
  // hạn/hết lượt vẫn hiện "đã áp dụng" và bị gửi kèm đơn tiếp theo
  const quote = query.isError ? null : (query.data ?? null);

  return {
    quote,
    discount: quote?.discount ?? 0,
    checking: Boolean(code) && query.isFetching,
    error: query.error ?? null,
  };
}
