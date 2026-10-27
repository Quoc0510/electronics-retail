/**
 * @feature [F04] Chi tiết sản phẩm - Thanh giá dính ở đáy màn hình, chỉ hiện khi khối giá chính đã cuộn khuất khỏi tầm nhìn.
 * Giúp người dùng luôn thấy tên và giá khi đọc phần mô tả/thông số dài (và là chỗ đặt nút mua khi có giỏ hàng ở F05).
 * Dùng IntersectionObserver; môi trường không có (ví dụ kiểm thử) thì không hiện thanh này.
 */
import { useEffect, useState } from 'react';
import { assetUrl } from '../../lib/api.js';
import { useCompare } from '../../context/CompareContext.jsx'; // [F12]
import Price from '../Price.jsx';

export default function StickyPriceBar({ anchorRef, product }) {
  const [visible, setVisible] = useState(false);
  // [F12] Thanh so sánh (cao 4.5rem) đang hiện ở đáy thì nâng thanh giá lên phía trên nó
  const { items } = useCompare();

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      // Chỉ hiện khi khối giá đã trôi lên phía trên màn hình (không hiện khi nó còn ở phía dưới chưa cuộn tới)
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchorRef]);

  if (!visible) return null;

  const image = assetUrl(product.images[0]?.url);

  return (
    <div
      role="region"
      aria-label="Tóm tắt sản phẩm"
      className={`fixed inset-x-0 z-30 border-t border-slate-200 bg-white/95 shadow-[0_-8px_30px_-12px_rgb(15_23_42/0.25)] backdrop-blur animate-fade-up ${
        items.length > 0 ? 'bottom-[4.5rem]' : 'bottom-0'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        {image && <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />}
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
          {product.name}
        </p>
        <Price price={product.price} salePrice={product.salePrice} showPercent={false} />
      </div>
    </div>
  );
}
