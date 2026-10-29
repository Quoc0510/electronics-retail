/**
 * @feature [F08] Yêu thích - Danh sách sản phẩm yêu thích của thành viên và thao tác thêm/bỏ (US-22).
 *
 * Danh sách nằm trong CSDL nên chỉ tải khi đã đăng nhập. Khóa cache gắn với id người dùng, đổi tài khoản không thấy
 * danh sách của người trước. Mọi thẻ sản phẩm trên trang dùng chung một truy vấn nên chỉ có một lần gọi API.
 * Khách chưa đăng nhập bấm yêu thích thì được chuyển tới trang đăng nhập rồi quay lại trang đang xem.
 */
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export function useWishlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const key = ['wishlist', user?.id ?? null];

  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get('/wishlist').then((res) => res.data),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const ids = useMemo(
    () => new Set((query.data?.items ?? []).map((item) => item.id)),
    [query.data],
  );

  const mutation = useMutation({
    mutationFn: ({ productId, inWishlist }) =>
      inWishlist ? api.delete(`/wishlist/${productId}`) : api.put(`/wishlist/${productId}`),
    onSuccess: (_res, { productId, inWishlist }) => {
      if (inWishlist) {
        // Bỏ yêu thích: cập nhật ngay, không chờ tải lại
        queryClient.setQueryData(key, (old) =>
          old
            ? {
                items: old.items.filter((item) => item.id !== productId),
                total: old.total - 1,
              }
            : old,
        );
      } else {
        // Thêm: cần thẻ sản phẩm đầy đủ nên tải lại danh sách
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  /** Thêm sản phẩm vào danh sách nếu chưa có, bỏ ra nếu đã có. Chưa đăng nhập thì chuyển tới trang đăng nhập. */
  const toggle = (productId) => {
    if (!user) {
      navigate('/dang-nhap', { state: { from: location } });
      return;
    }
    mutation.mutate({ productId, inWishlist: ids.has(productId) });
  };

  return {
    items: query.data?.items ?? [],
    isPending: Boolean(user) && query.isPending,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    has: (productId) => ids.has(productId),
    toggle,
    toggling: mutation.isPending ? mutation.variables.productId : null,
    toggleError: mutation.isError ? mutation.error : null,
    clearToggleError: mutation.reset,
  };
}
