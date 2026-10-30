/**
 * @feature [F09] Mã giảm giá - Mã được tự động áp dụng cho giỏ hàng ở trang đặt hàng (US-25 AC10).
 *
 * Hỏi máy chủ mã tốt nhất trong các mã Admin bật "tự động áp dụng" và dùng được cho đúng giỏ hàng và đúng người này (kể cả điểm
 * thành viên, phạm vi, đơn tối thiểu). Chỉ lấy MÃ để điền sẵn: số tiền giảm và việc mã còn dùng được vẫn do xem trước và đặt
 * hàng kiểm tra như mã khách tự nhập. Khóa cache gồm người dùng và giỏ hàng nên giỏ đổi hoặc đăng nhập thì chọn lại.
 * Lỗi mạng hay máy chủ thì coi như không có mã tự động: đây chỉ là tiện ích, không được chặn việc đặt hàng.
 * Trả cả `quote` (mã và số tiền giảm) để trang vẫn GỢI Ý mã này sau khi khách bỏ mã, tránh mất mã không áp lại được.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useAutoCoupon(items, userId, enabled) {
  const lines = items.map(({ productId, quantity }) => ({ productId, quantity }));
  const query = useQuery({
    queryKey: ['coupon-auto', userId, JSON.stringify(lines)],
    queryFn: () => api.post('/coupons/auto', { items: lines }).then((res) => res.data.coupon),
    enabled: enabled && lines.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const quote = query.isError ? null : (query.data ?? null);
  return { code: quote?.code ?? null, quote };
}
