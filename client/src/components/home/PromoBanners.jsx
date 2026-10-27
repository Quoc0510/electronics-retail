/**
 * @feature [F12] Trang chủ - Hai banner quảng bá danh mục (Laptop, Phụ kiện). Banner chỉ hiện khi danh mục tương ứng
 * có thật và đang bán (tra theo slug trong danh sách danh mục), không bao giờ dẫn tới danh mục không tồn tại.
 * Thông điệp là thông điệp chung, không ghi con số giảm giá cụ thể để không sai khi dữ liệu thay đổi.
 */
import { Link } from 'react-router-dom';
import { IconArrowRight, IconHeadphones, IconLaptop } from '@techstore/shared';

const BANNERS = [
  {
    slug: 'laptop',
    eyebrow: 'Làm việc & học tập',
    title: 'Laptop cho mọi nhu cầu',
    text: 'Từ mỏng nhẹ văn phòng đến gaming hiệu năng cao.',
    background: 'from-ink-900 via-brand-800 to-brand-600',
    Art: IconLaptop,
  },
  {
    slug: 'phu-kien',
    eyebrow: 'Hoàn thiện góc làm việc',
    title: 'Phụ kiện thông minh',
    text: 'Tai nghe, sạc dự phòng, cáp sạc chính hãng.',
    background: 'from-fuchsia-700 via-rose-600 to-orange-500',
    Art: IconHeadphones,
  },
];

export default function PromoBanners({ categories }) {
  const available = BANNERS.filter((banner) =>
    categories.some((category) => category.slug === banner.slug),
  );
  if (available.length === 0) return null;

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {available.map(({ slug, eyebrow, title, text, background, Art }) => (
        <li key={slug}>
          <Link
            to={`/san-pham?category=${slug}`}
            className={`surface-dark group relative flex min-h-44 items-center overflow-hidden rounded-3xl bg-gradient-to-br ${background} p-6 text-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-glow sm:p-8`}
          >
            <div className="bg-tech-grid absolute inset-0 opacity-50" aria-hidden="true" />
            <Art
              size={170}
              strokeWidth={1}
              aria-hidden="true"
              className="absolute -right-4 -bottom-6 text-white/20 transition duration-500 group-hover:scale-110 group-hover:text-white/30"
            />
            <div className="relative max-w-xs space-y-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/80">
                {eyebrow}
              </span>
              <h3 className="font-display text-2xl font-bold">{title}</h3>
              <p className="text-sm text-white/85">{text}</p>
              <span className="inline-flex items-center gap-1 pt-1 text-sm font-bold transition group-hover:gap-2">
                Khám phá ngay <IconArrowRight size={16} />
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
