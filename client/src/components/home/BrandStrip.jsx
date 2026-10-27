/**
 * @feature [F12] Trang chủ - Dải thương hiệu nổi bật: mỗi thương hiệu là một ô liên kết tới danh sách đã lọc theo hãng.
 * Có logo thì hiện logo, chưa có (logoUrl rỗng) thì hiện chữ cái đầu và tên hãng; kèm số sản phẩm.
 */
import { Link } from 'react-router-dom';
import { assetUrl } from '../../lib/api.js';

export default function BrandStrip({ brands }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {brands.map((brand) => (
        <li key={brand.id}>
          <Link
            to={`/san-pham?brand=${brand.slug}`}
            className="group flex h-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover"
          >
            {brand.logoUrl ? (
              <img
                src={assetUrl(brand.logoUrl)}
                alt=""
                loading="lazy"
                className="h-10 w-10 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 font-display text-lg font-bold text-white"
              >
                {brand.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                {brand.name}
              </span>
              <span className="block text-xs text-slate-500">{brand.productCount} sản phẩm</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
