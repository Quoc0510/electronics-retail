/**
 * @feature [F16] Phí vận chuyển Giao Hàng Nhanh - Các hook gọi API /shipping: cấu hình (có bật GHN không, ngưỡng miễn phí),
 * danh mục tỉnh và phường/xã, ước tính phí theo địa chỉ và giỏ hàng (US-37).
 * Mọi lỗi mạng đều lùi về hành vi cũ (phí cố định, ô địa chỉ nhập tay) nên trang đặt hàng không bao giờ bị kẹt vì GHN.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { DEFAULT_SHIPPING_CONFIG } from '../lib/shipping.js';

const FOREVER = {
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false,
  refetchOnWindowFocus: false,
};

/** Cấu hình tính phí; chưa tải xong hoặc lỗi thì dùng mặc định (phí cố định). */
export function useShippingConfig() {
  const query = useQuery({
    queryKey: ['shipping-config'],
    queryFn: () => api.get('/shipping/config').then((res) => res.data),
    ...FOREVER,
  });
  return query.data ?? DEFAULT_SHIPPING_CONFIG;
}

/** Danh sách tỉnh/thành của GHN: [{ id, name }]; `items` rỗng nghĩa là chưa có (đang tải hoặc lỗi) -> nhập tay. */
export function useProvinces(enabled) {
  const query = useQuery({
    queryKey: ['shipping-provinces'],
    queryFn: () => api.get('/shipping/provinces').then((res) => res.data.items),
    enabled,
    ...FOREVER,
  });
  return { items: query.data ?? [], loading: enabled && query.isPending };
}

/** Phường/xã của một tỉnh (theo mã tỉnh của GHN). */
export function useWards(provinceId) {
  const query = useQuery({
    queryKey: ['shipping-wards', provinceId],
    queryFn: () => api.get(`/shipping/provinces/${provinceId}/wards`).then((res) => res.data.items),
    enabled: Boolean(provinceId),
    ...FOREVER,
  });
  return { items: query.data ?? [], loading: Boolean(provinceId) && query.isPending };
}

/**
 * Phí vận chuyển GỐC (chưa xét miễn phí) cho giỏ hàng tới một địa chỉ.
 * Kết quả: { fee, source: 'GHN'|'FALLBACK'|'FIXED' } khi có; `error` là câu báo lỗi nếu GHN không giao tới địa chỉ.
 */
export function useShippingQuote({ items, province, ward, enabled }) {
  const lines = items.map(({ productId, quantity }) => ({ productId, quantity }));
  const query = useQuery({
    queryKey: ['shipping-quote', lines, province, ward],
    queryFn: () =>
      api.post('/shipping/quote', { items: lines, province, ward }).then((res) => res.data),
    enabled: enabled && Boolean(province && ward && lines.length > 0),
    staleTime: 60_000,
    retry: false,
  });
  return {
    quote: query.isError ? null : (query.data ?? null),
    loading: query.isFetching,
    // Lỗi cũ không được hiện khi đã đổi địa chỉ: query mới có key mới nên isError tự đặt lại
    error: query.isError ? query.error : null,
  };
}
