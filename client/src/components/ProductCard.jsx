/**
 * @feature [F04] Duyệt và tìm sản phẩm - Thẻ sản phẩm dùng ở trang chủ và trang danh sách (US-10, US-11).
 * Cả thẻ là một liên kết tới trang chi tiết. Nhãn giảm giá nằm trên ảnh; hết hàng thì phủ mờ ảnh kèm nhãn "Hết hàng".
 * Khi rê chuột: thẻ nổi lên, ảnh phóng nhẹ, hiện "Xem chi tiết".
 * Ảnh dùng object-contain trên nền trắng: ảnh thật tải lên từ Admin (thường nền trắng, nhiều tỉ lệ khác nhau) không bị cắt xén; ảnh minh họa SVG của seed là hình vuông nên vẫn lấp đầy ô.
 * [F12] Nút "So sánh" nằm cạnh liên kết (không lồng trong liên kết vì không được đặt nút bên trong thẻ <a>).
 */
import { Link } from 'react-router-dom';
import { IconArrowRight, discountPercent } from '@techstore/shared';
import { assetUrl } from '../lib/api.js';
import AddToCartButton from './cart/AddToCartButton.jsx'; // [F05]
import CompareButton from './compare/CompareButton.jsx';
import Price from './Price.jsx';

export default function ProductCard({ product }) {
  const image = assetUrl(product.thumbnail);
  const percent = discountPercent(product.price, product.salePrice);

  return (
    <div className="group relative h-full w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover">
      <Link to={`/san-pham/${product.slug}`} className="flex h-full w-full flex-col">
        <div className="relative aspect-square overflow-hidden bg-white">
          {image ? (
            <img
              src={image}
              alt={product.name}
              loading="lazy"
              className={`h-full w-full object-contain transition duration-500 group-hover:scale-105 ${
                product.inStock ? '' : 'opacity-60 grayscale'
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Chưa có ảnh
            </div>
          )}

          {percent > 0 && product.inStock && (
            <span className="absolute left-3 top-3 rounded-lg bg-gradient-to-r from-rose-600 to-orange-500 px-2 py-1 text-xs font-bold text-white shadow-sm">
              -{percent}%
            </span>
          )}
          {!product.inStock && (
            <span className="absolute left-3 top-3 rounded-lg bg-ink-900/90 px-2.5 py-1 text-xs font-semibold text-white">
              Hết hàng
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            {product.brand.name}
          </span>
          <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-900 transition group-hover:text-brand-700">
            {product.name}
          </h3>
          <div className="mt-auto pr-12 pt-2">
            <Price price={product.price} salePrice={product.salePrice} showPercent={false} />
          </div>
          <span className="flex items-center gap-1 text-xs font-medium text-brand-600 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            Xem chi tiết <IconArrowRight size={14} />
          </span>
        </div>
      </Link>
      <CompareButton product={product} className="absolute right-3 top-3 z-10" />
      {/* [F05] Thêm nhanh 1 sản phẩm vào giỏ */}
      <AddToCartButton
        product={product}
        variant="icon"
        className="absolute bottom-4 right-4 z-10"
      />
    </div>
  );
}
