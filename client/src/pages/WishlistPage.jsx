/**
 * @feature [F08] Yêu thích - Trang /yeu-thich (yêu cầu đăng nhập): danh sách sản phẩm đã lưu (US-22 AC2).
 * Dùng lại thẻ sản phẩm nên vẫn thêm vào giỏ, so sánh và bỏ yêu thích ngay tại đây (bỏ xong thẻ biến mất khỏi trang).
 * Đủ trạng thái: đang tải, lỗi kèm Thử lại, chưa lưu sản phẩm nào.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, IconHeart, getErrorMessage } from '@techstore/shared';
import { useWishlist } from '../hooks/useWishlist.js';
import ProductCard from '../components/ProductCard.jsx';

export default function WishlistPage() {
  const { items, isPending, isError, error, refetch, toggleError } = useWishlist();

  useEffect(() => {
    document.title = 'Sản phẩm yêu thích - TechStore';
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, []);

  return (
    <div className="space-y-6 pb-16">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900">Sản phẩm yêu thích</h1>
        {!isPending && !isError && <p className="text-slate-600">{items.length} sản phẩm đã lưu</p>}
      </div>

      {toggleError && <Alert>{getErrorMessage(toggleError)}</Alert>}

      {isPending && (
        <p role="status" className="text-slate-500">
          Đang tải...
        </p>
      )}

      {isError && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {!isPending && !isError && items.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500">
            <IconHeart size={30} />
          </span>
          <p className="text-slate-600">
            Bạn chưa lưu sản phẩm nào. Bấm biểu tượng trái tim trên sản phẩm để lưu lại xem sau.
          </p>
          <Link
            to="/san-pham"
            className="rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            Xem sản phẩm
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
          {items.map((item) => (
            <li key={item.id} className="flex">
              <ProductCard product={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
