/**
 * @feature [F12] Trang chủ - Hai banner quảng bá danh mục (Laptop, Phụ kiện). Banner chỉ hiện khi danh mục tương ứng
 * có thật và đang bán (tra theo slug trong danh sách danh mục), không bao giờ dẫn tới danh mục không tồn tại.
 * Thông điệp là thông điệp chung, không ghi con số giảm giá cụ thể để không sai khi dữ liệu thay đổi.
 * Hai banner cùng một bố cục để cân đối: nền chuyển màu, chữ bên trái, ảnh sản phẩm thật (đã tách nền, ở client/public/banners,
 * nguồn ghi ở docs/IMAGE_CREDITS.md) xếp bên phải. Ảnh lỗi thì ẩn đi, banner vẫn đọc được.
 */
import { Link } from 'react-router-dom';
import { IconArrowRight } from '@techstore/shared';

// className của từng ảnh: bề rộng theo % của khung ảnh bên phải (cao tự theo tỉ lệ) và phần chồng lên ảnh trước
const BANNERS = [
  {
    slug: 'laptop',
    eyebrow: 'Làm việc & học tập',
    title: 'Laptop cho mọi nhu cầu',
    text: 'Từ mỏng nhẹ văn phòng đến gaming hiệu năng cao.',
    background: 'from-ink-900 via-brand-800 to-brand-600',
    photos: [
      { src: '/banners/promo-laptop-b.webp', className: 'z-10 w-[56%]' },
      { src: '/banners/promo-laptop-a.webp', className: '-ml-[16%] w-[62%]' },
    ],
  },
  {
    slug: 'phu-kien',
    eyebrow: 'Hoàn thiện góc làm việc',
    title: 'Phụ kiện thông minh',
    text: 'Tai nghe, sạc dự phòng, cáp sạc chính hãng.',
    background: 'from-fuchsia-700 via-rose-600 to-orange-500',
    photos: [
      { src: '/banners/promo-phukien-a.webp', className: 'w-[26%]' },
      { src: '/banners/promo-phukien-b.webp', className: 'z-10 -ml-[4%] w-[34%]' },
      { src: '/banners/promo-phukien-c.webp', className: '-ml-[8%] w-[44%]' },
    ],
  },
];

const hideBrokenImage = (event) => {
  event.currentTarget.style.display = 'none';
};

export default function PromoBanners({ categories }) {
  const available = BANNERS.filter((banner) =>
    categories.some((category) => category.slug === banner.slug),
  );
  if (available.length === 0) return null;

  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {available.map(({ slug, eyebrow, title, text, background, photos }) => (
        <li key={slug}>
          <Link
            to={`/san-pham?category=${slug}`}
            className={`surface-dark group relative flex min-h-48 items-center overflow-hidden rounded-3xl bg-gradient-to-br ${background} p-6 text-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-glow sm:min-h-56 sm:p-8`}
          >
            <div className="bg-tech-grid absolute inset-0 opacity-50" aria-hidden="true" />
            <div
              className="absolute -right-10 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-white/15 blur-3xl"
              aria-hidden="true"
            />
            {/* Ảnh sản phẩm nằm trong khung 42% bề rộng, sát mép dưới bên phải; chữ chiếm tối đa 55% nên không bao giờ bị ảnh đè */}
            <div
              className="pointer-events-none absolute bottom-3 right-4 flex w-[42%] items-end justify-end sm:right-6"
              aria-hidden="true"
            >
              {photos.map((photo) => (
                <img
                  key={photo.src}
                  src={photo.src}
                  alt=""
                  loading="lazy"
                  onError={hideBrokenImage}
                  className={`relative h-auto drop-shadow-2xl transition duration-500 group-hover:scale-105 ${photo.className}`}
                />
              ))}
            </div>
            <div className="relative max-w-[55%] space-y-2">
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
