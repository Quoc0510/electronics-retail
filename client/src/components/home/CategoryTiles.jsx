/**
 * @feature [F04] Trang chủ - Các ô danh mục lớn có ảnh (hoặc biểu tượng khi chưa có ảnh) và số sản phẩm (US-10).
 * Ảnh danh mục là ảnh thật (dữ liệu mẫu ghép từ ảnh các sản phẩm của danh mục); danh mục chưa có ảnh vẫn hiện biểu tượng như cũ.
 */
import { Link } from 'react-router-dom';
import { assetUrl } from '../../lib/api.js';
import { categoryIcon } from '../../lib/categoryIcons.js';

// Mỗi ô một màu nhấn khác nhau (xoay vòng) cho sinh động; đều đủ tương phản với chữ trắng
const TONES = [
  'from-brand-500 to-violet-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-rose-600',
  'from-fuchsia-500 to-purple-600',
];

export default function CategoryTiles({ categories }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {categories.map((category, index) => {
        const Icon = categoryIcon(category.slug);
        return (
          <li key={category.id}>
            <Link
              to={`/san-pham?category=${category.slug}`}
              className={`group flex h-full flex-col items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white text-center shadow-card transition duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover ${
                category.imageUrl ? 'p-3 pb-4' : 'p-5'
              }`}
            >
              {category.imageUrl ? (
                <img
                  src={assetUrl(category.imageUrl)}
                  alt=""
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-xl object-contain transition duration-500 group-hover:scale-105"
                />
              ) : (
                <span
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${TONES[index % TONES.length]} text-white shadow-md transition group-hover:scale-110`}
                >
                  <Icon size={26} />
                </span>
              )}
              <span className="font-display text-sm font-semibold text-slate-900">
                {category.name}
              </span>
              <span className="text-xs text-slate-500">{category.productCount} sản phẩm</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
