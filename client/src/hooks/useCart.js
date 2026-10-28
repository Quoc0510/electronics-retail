/**
 * @feature [F05] Giỏ hàng - Truy vấn và thao tác giỏ hàng, dùng chung cho khách đã đăng nhập và khách chưa đăng nhập.
 *
 * Đã đăng nhập: giỏ nằm trong CSDL (BR-11). Mọi thao tác của API trả về toàn bộ giỏ đã tính lại nên kết quả được ghi
 * thẳng vào cache React Query; khóa cache gắn với id người dùng nên đổi tài khoản không bao giờ thấy giỏ của người trước.
 *
 * Chưa đăng nhập: giỏ lưu trên trình duyệt (lib/guestCart.js) chỉ gồm { productId, quantity }. Giá, tồn kho và trạng thái
 * luôn do máy chủ tính qua POST /cart/preview (không ghi CSDL). Mỗi thao tác hỏi máy chủ trước rồi mới lưu, nên quy tắc
 * tồn kho (BR-03) áp dụng như giỏ tài khoản. Trong giỏ khách, id của dòng chính là id sản phẩm (xem backend previewCart).
 * Khi khách đăng nhập, CartSync gộp giỏ này vào giỏ tài khoản.
 *
 * Hook trả về cùng một dạng cho hai trường hợp nên trang giỏ hàng, nút thêm và biểu tượng giỏ không cần phân biệt.
 */
import { useSyncExternalStore } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserFacingError } from '@techstore/shared';
import { api } from '../lib/api.js';
import {
  EMPTY_GUEST_ITEMS,
  getGuestItems,
  getMerging,
  guestQuantity,
  guestTotalQuantity,
  saveGuestItems,
  subscribeGuestCart,
  withQuantity,
  withoutProduct,
} from '../lib/guestCart.js';
import { useAuth } from '../context/AuthContext.jsx';

export const EMPTY_CART = { items: [], totalQuantity: 0, subtotal: 0, canCheckout: false };

const guestKey = (items) => ['cart', 'guest', JSON.stringify(items)];

const fetchPreview = (items) => api.post('/cart/preview', { items }).then((res) => res.data);

// Cùng nội dung thông báo với backend để khách và thành viên thấy lời báo giống nhau
const notEnough = (stock, inCart) =>
  new UserFacingError(
    inCart > 0
      ? `Chỉ còn ${stock} sản phẩm trong kho, bạn đã có ${inCart} sản phẩm này trong giỏ`
      : `Chỉ còn ${stock} sản phẩm trong kho`,
  );

/**
 * Hỏi máy chủ về giỏ sẽ có sau thay đổi, kiểm tra riêng dòng bị thay đổi rồi mới lưu vào trình duyệt.
 * @param {Array} next danh sách { productId, quantity } sau thay đổi
 * @param {number} productId sản phẩm vừa thêm/sửa
 * @param {number} inCart số lượng đã có trước đó (để báo "bạn đã có n")
 */
const commitGuestChange = async (next, productId, inCart) => {
  const cart = await fetchPreview(next);
  const line = cart.items.find((item) => item.productId === productId);
  if (!line || line.status === 'UNAVAILABLE') {
    throw new UserFacingError('Sản phẩm này không còn được bán');
  }
  if (line.stock <= 0) throw new UserFacingError('Sản phẩm đã hết hàng');
  if (line.quantity > line.stock) throw notEnough(line.stock, inCart);
  saveGuestItems(next);
  return cart;
};

const guestAdd = ({ productId, quantity = 1 }) => {
  const current = getGuestItems();
  const inCart = guestQuantity(current, productId);
  return commitGuestChange(withQuantity(current, productId, inCart + quantity), productId, inCart);
};

const guestUpdate = ({ itemId: productId, quantity }) => {
  const current = getGuestItems();
  return commitGuestChange(withQuantity(current, productId, quantity), productId, 0);
};

const guestRemove = async (productId) => {
  const next = withoutProduct(getGuestItems(), productId);
  const cart = next.length > 0 ? await fetchPreview(next) : EMPTY_CART;
  saveGuestItems(next);
  return cart;
};

export function useCart() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const guestItems = useSyncExternalStore(
    subscribeGuestCart,
    getGuestItems,
    () => EMPTY_GUEST_ITEMS,
  );

  // Đang gộp giỏ tạm vào tài khoản: giỏ trong tài khoản chưa phải là giỏ cuối cùng
  const isMerging = useSyncExternalStore(subscribeGuestCart, getMerging, () => false);

  const serverKey = ['cart', user?.id ?? null];

  const serverQuery = useQuery({
    queryKey: serverKey,
    queryFn: () => api.get('/cart').then((res) => res.data),
    enabled: Boolean(user),
  });

  const guestQuery = useQuery({
    queryKey: guestKey(guestItems),
    queryFn: async () => {
      const cart = await fetchPreview(guestItems);
      // Sản phẩm đã bị xóa hẳn không còn trong kết quả: dọn khỏi bộ nhớ để lần sau khỏi hỏi lại
      if (cart.items.length < guestItems.length) {
        const known = new Set(cart.items.map((item) => item.productId));
        saveGuestItems(guestItems.filter((entry) => known.has(entry.productId)));
      }
      return cart;
    },
    enabled: !user && guestItems.length > 0,
    // Giữ giỏ cũ trên màn hình trong lúc tải giỏ mới, không nhấp nháy
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Giỏ khách đã được lưu rồi mới ghi kết quả vào cache, nên khóa lấy lại từ bộ nhớ là khóa mới
  const saveCart = (cart) =>
    queryClient.setQueryData(user ? serverKey : guestKey(getGuestItems()), cart);

  const addItem = useMutation({
    mutationFn: (variables) =>
      user
        ? api
            .post('/cart/items', {
              productId: variables.productId,
              quantity: variables.quantity ?? 1,
            })
            .then((res) => res.data)
        : guestAdd(variables),
    onSuccess: saveCart,
  });

  const updateItem = useMutation({
    mutationFn: (variables) =>
      user
        ? api
            .patch(`/cart/items/${variables.itemId}`, { quantity: variables.quantity })
            .then((res) => res.data)
        : guestUpdate(variables),
    onSuccess: saveCart,
  });

  const removeItem = useMutation({
    mutationFn: (itemId) =>
      user ? api.delete(`/cart/items/${itemId}`).then((res) => res.data) : guestRemove(itemId),
    onSuccess: saveCart,
  });

  const active = user ? serverQuery : guestQuery;
  const hasGuestItems = guestItems.length > 0;
  const cart = user ? serverQuery.data : hasGuestItems ? guestQuery.data : EMPTY_CART;

  return {
    isLoggedIn: Boolean(user),
    isMerging,
    cart: cart ?? EMPTY_CART,
    isPending: user ? serverQuery.isPending : hasGuestItems && guestQuery.isPending,
    isError: user || hasGuestItems ? active.isError : false,
    error: active.error,
    refetch: active.refetch,
    // Tổng số lượng cho biểu tượng giỏ trên đầu trang (US-14 AC4); của khách tính ngay từ bộ nhớ, không cần chờ mạng
    totalQuantity: user ? (serverQuery.data?.totalQuantity ?? 0) : guestTotalQuantity(guestItems),
    addItem,
    updateItem,
    removeItem,
  };
}
