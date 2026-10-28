/**
 * @feature [F05] Giỏ hàng cho khách - Gộp giỏ tạm (lưu trên trình duyệt) vào giỏ tài khoản ngay khi đăng nhập hoặc đăng ký.
 * Không hiển thị gì. Gửi POST /cart/merge: máy chủ thêm tối đa số lượng còn được phép (không báo lỗi khi thiếu hàng) và
 * trả ghi chú, được lưu lại để trang giỏ hàng báo cho người dùng. Gộp thành công thì xóa giỏ tạm; gộp lỗi (mất mạng)
 * thì giữ nguyên để thử lại ở lần tải trang sau, khách không mất giỏ.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { saveCartNotice } from '../../lib/cartNotice.js';
import {
  EMPTY_GUEST_ITEMS,
  clearGuestItems,
  getGuestItems,
  subscribeGuestCart,
} from '../../lib/guestCart.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function CartSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const guestItems = useSyncExternalStore(
    subscribeGuestCart,
    getGuestItems,
    () => EMPTY_GUEST_ITEMS,
  );
  // Chặn gửi hai lần cùng lúc (ví dụ StrictMode chạy effect hai lần ở môi trường phát triển)
  const merging = useRef(false);

  useEffect(() => {
    if (!user || guestItems.length === 0 || merging.current) return;
    merging.current = true;

    api
      .post('/cart/merge', { items: guestItems })
      .then(async ({ data }) => {
        const key = ['cart', user.id];
        // Hủy lượt tải giỏ đang bay (nếu có) để kết quả cũ không đè lên giỏ vừa gộp
        await queryClient.cancelQueries({ queryKey: key });
        queryClient.setQueryData(key, data.cart);
        clearGuestItems();
        if (data.notes.length > 0) saveCartNotice(data.notes);
      })
      .catch(() => {
        // Giữ giỏ tạm, lần tải trang sau sẽ thử gộp lại
      })
      .finally(() => {
        merging.current = false;
      });
  }, [user, guestItems, queryClient]);

  return null;
}
