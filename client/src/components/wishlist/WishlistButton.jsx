/**
 * @feature [F08] Yêu thích - Nút thêm/bỏ một sản phẩm khỏi danh sách yêu thích bằng một cú nhấp (US-22 AC1).
 * variant "icon": nút tròn nhỏ nằm trên ảnh thẻ sản phẩm; "pill": nút có chữ dùng ở trang chi tiết.
 * aria-pressed cho trình đọc màn hình biết sản phẩm đã được yêu thích hay chưa.
 * Lỗi từ máy chủ (ví dụ danh sách đã đủ 100 sản phẩm) hiện ngay cạnh nút trong 5 giây.
 */
import { useEffect } from 'react';
import { IconHeart, getErrorMessage } from '@techstore/shared';
import { useWishlist } from '../../hooks/useWishlist.js';

const ERROR_MS = 5000;

export default function WishlistButton({ product, variant = 'icon', className = '' }) {
  const { has, toggle, toggling, toggleError, clearToggleError } = useWishlist();
  const active = has(product.id);
  const busy = toggling === product.id;
  const heart = (size) => <IconHeart size={size} className={active ? 'fill-current' : ''} />;

  // Tự ẩn lỗi sau vài giây; dọn đồng hồ nếu nút biến mất trước đó
  useEffect(() => {
    if (!toggleError) return undefined;
    const timer = setTimeout(clearToggleError, ERROR_MS);
    return () => clearTimeout(timer);
  }, [toggleError, clearToggleError]);

  const error = toggleError && (
    <p
      role="alert"
      className={
        variant === 'pill'
          ? 'w-full text-sm text-rose-600'
          : 'absolute right-0 top-full z-20 mt-2 w-52 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white shadow-lg'
      }
    >
      {getErrorMessage(toggleError)}
    </p>
  );

  if (variant === 'pill') {
    return (
      <>
        <button
          type="button"
          aria-pressed={active}
          disabled={busy}
          onClick={() => toggle(product.id)}
          className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70 ${
            active
              ? 'border-rose-500 bg-rose-500 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600'
          } ${className}`}
        >
          {heart(16)}
          {active ? 'Đã yêu thích' : 'Yêu thích'}
        </button>
        {error}
      </>
    );
  }

  const label = active ? `Bỏ ${product.name} khỏi yêu thích` : `Yêu thích ${product.name}`;
  return (
    // className do nơi dùng đặt vị trí (absolute trên thẻ sản phẩm), đồng thời làm mốc định vị cho thông báo lỗi
    <div className={className}>
      <button
        type="button"
        aria-pressed={active}
        aria-label={label}
        title={active ? 'Bỏ khỏi yêu thích' : 'Thêm vào yêu thích'}
        disabled={busy}
        onClick={() => toggle(product.id)}
        className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur transition disabled:cursor-wait disabled:opacity-70 ${
          active
            ? 'bg-rose-500 text-white'
            : 'bg-white/90 text-slate-700 hover:bg-rose-500 hover:text-white'
        }`}
      >
        {heart(16)}
      </button>
      {error}
    </div>
  );
}
