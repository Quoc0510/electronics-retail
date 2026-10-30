/**
 * @feature [F09] Mã giảm giá - Xem trước số tiền giảm của mã khách đang nhập ở trang đặt hàng (US-25 AC1, AC2).
 *
 * Gửi GIỎ HÀNG (productId, quantity) chứ không gửi số tiền: mã có thể chỉ áp dụng cho một số sản phẩm/danh mục/thương hiệu và
 * máy chủ mới biết danh mục, thương hiệu và giá hiện hành của từng món. Công khai (khách chưa đăng nhập cũng dùng được); khi đã
 * đăng nhập, Client tự gắn token để máy chủ kiểm tra điểm thành viên tối thiểu. Khóa cache gồm giỏ hàng và người dùng nên giỏ
 * đổi, đăng nhập hay đăng xuất đều tự kiểm tra lại. Đây chỉ là bản xem trước: số tiền giảm thật do máy chủ tính lại khi đặt
 * hàng, nên mã đang lỗi thì KHÔNG được gửi kèm đơn.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useCouponPreview(code, items, userId = null) {
  const lines = items.map(({ productId, quantity }) => ({ productId, quantity }));
  const query = useQuery({
    queryKey: ['coupon-preview', code, userId, JSON.stringify(lines)],
    queryFn: () => api.post('/coupons/preview', { code, items: lines }).then((res) => res.data),
    enabled: Boolean(code) && lines.length > 0,
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
