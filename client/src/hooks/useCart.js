/**
 * @feature [F05] Giỏ hàng - Truy vấn và thao tác giỏ hàng của người dùng đang đăng nhập (US-14, US-15).
 * Mọi thao tác của API đều trả về toàn bộ giỏ đã tính lại, nên kết quả được ghi thẳng vào cache React Query:
 * biểu tượng giỏ, trang giỏ hàng và các nút "Thêm vào giỏ" luôn thấy cùng một dữ liệu mà không phải gọi lại.
 * Khóa cache gắn với id người dùng nên đổi tài khoản không bao giờ thấy giỏ của người trước.
 * Chưa đăng nhập thì không gọi API (BR-11) và giỏ coi như trống.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export const EMPTY_CART = { items: [], totalQuantity: 0, subtotal: 0, canCheckout: false };

export function useCart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['cart', user?.id ?? null];

  const query = useQuery({
    queryKey,
    queryFn: () => api.get('/cart').then((res) => res.data),
    enabled: Boolean(user),
  });

  const saveCart = (cart) => queryClient.setQueryData(queryKey, cart);

  const addItem = useMutation({
    mutationFn: ({ productId, quantity = 1 }) =>
      api.post('/cart/items', { productId, quantity }).then((res) => res.data),
    onSuccess: saveCart,
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, quantity }) =>
      api.patch(`/cart/items/${itemId}`, { quantity }).then((res) => res.data),
    onSuccess: saveCart,
  });

  const removeItem = useMutation({
    mutationFn: (itemId) => api.delete(`/cart/items/${itemId}`).then((res) => res.data),
    onSuccess: saveCart,
  });

  return {
    isLoggedIn: Boolean(user),
    cart: query.data ?? EMPTY_CART,
    isPending: Boolean(user) && query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    // Tổng số lượng cho biểu tượng giỏ trên đầu trang (US-14 AC4)
    totalQuantity: query.data?.totalQuantity ?? 0,
    addItem,
    updateItem,
    removeItem,
  };
}
