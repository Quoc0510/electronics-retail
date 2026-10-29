/**
 * @feature [F05] Giỏ hàng - Nút "Thêm vào giỏ" dùng ở thẻ sản phẩm (variant "icon"), trang chi tiết và thanh giá dính ("full").
 *  - Chưa đăng nhập vẫn thêm được: giỏ lưu trên trình duyệt và được gộp vào tài khoản khi đăng nhập (xem useCart, CartSync).
 *  - Hết hàng: nút bị khóa và ghi rõ "Hết hàng".
 *  - Thành công: nút đổi thành "Đã thêm" trong 2 giây, biểu tượng giỏ trên đầu trang cập nhật số lượng (AC4).
 *  - Vượt tồn kho hoặc lỗi khác: hiện đúng thông báo của máy chủ, ví dụ "Chỉ còn 3 sản phẩm trong kho" (AC3).
 */
import { useEffect, useRef, useState } from 'react';
import { IconBag, IconCheck, getErrorMessage } from '@techstore/shared';
import { useCart } from '../../hooks/useCart.js';

const FEEDBACK_MS = 2000;
const ERROR_MS = 5000;

export default function AddToCartButton({
  product,
  quantity = 1,
  variant = 'full',
  className = '',
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);

  // Dọn đồng hồ khi nút bị gỡ khỏi trang để không cập nhật state của component đã biến mất
  useEffect(() => () => clearTimeout(timer.current), []);

  const outOfStock = product.inStock === false;
  const busy = addItem.isPending;

  const flash = (setter, value, ms) => {
    clearTimeout(timer.current);
    setter(value);
    timer.current = setTimeout(() => setter(typeof value === 'boolean' ? false : ''), ms);
  };

  const handleClick = () => {
    setError('');
    addItem.mutate(
      { productId: product.id, quantity },
      {
        onSuccess: () => flash(setAdded, true, FEEDBACK_MS),
        onError: (err) => flash(setError, getErrorMessage(err), ERROR_MS),
      },
    );
  };

  if (variant === 'icon') {
    const label = outOfStock ? `${product.name} đã hết hàng` : `Thêm ${product.name} vào giỏ`;
    return (
      // className do nơi dùng đặt vị trí (absolute trên thẻ sản phẩm). Không thêm `relative` ở đây: hai lớp vị trí cùng lúc
      // thì `relative` thắng và nút bị đẩy lệch ra khỏi góc thẻ
      <div className={className}>
        <button
          type="button"
          aria-label={label}
          title={outOfStock ? 'Hết hàng' : 'Thêm vào giỏ'}
          disabled={outOfStock || busy}
          onClick={handleClick}
          className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md transition disabled:cursor-not-allowed disabled:opacity-50 ${
            added
              ? 'bg-emerald-600 text-white'
              : 'bg-gradient-to-br from-brand-500 to-violet-600 text-white hover:brightness-110 hover:shadow-glow'
          }`}
        >
          {added ? <IconCheck size={18} /> : <IconBag size={18} />}
        </button>
        {error && (
          <p
            role="alert"
            className="absolute bottom-full right-0 mb-2 w-52 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white shadow-lg"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <button
        type="button"
        disabled={outOfStock || busy}
        onClick={handleClick}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
          added
            ? 'bg-emerald-600'
            : 'bg-gradient-to-r from-brand-600 to-violet-600 hover:shadow-glow hover:brightness-110 active:scale-[0.98]'
        }`}
      >
        {added ? <IconCheck size={20} /> : <IconBag size={20} />}
        {outOfStock
          ? 'Hết hàng'
          : added
            ? 'Đã thêm vào giỏ'
            : busy
              ? 'Đang thêm...'
              : 'Thêm vào giỏ'}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
