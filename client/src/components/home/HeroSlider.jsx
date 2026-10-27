/**
 * @feature [F04] Trang chủ - Banner lớn dạng slider (US-10).
 *  - Tự chuyển slide sau 6 giây; tạm dừng khi rê chuột/đặt focus vào banner hoặc khi người dùng bật "giảm chuyển động".
 *  - Điều khiển: nút trước/sau, chấm chọn slide; đầy đủ nhãn cho trình đọc màn hình.
 *  - Chỉ hiển thị slide đang chọn nên liên kết ở slide ẩn không bị focus nhầm bằng bàn phím.
 * Nội dung banner là thông điệp chung (không ghi con số giảm giá cụ thể để không sai khi dữ liệu thay đổi).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
  IconLaptop,
  IconPhone,
  IconTag,
} from '@techstore/shared';

const AUTOPLAY_MS = 6000;

const SLIDES = [
  {
    id: 'phone',
    eyebrow: 'Điện thoại chính hãng',
    title: 'Flagship mới nhất, trải nghiệm đỉnh cao',
    text: 'Chọn iPhone, Galaxy và nhiều dòng khác với giá tốt, bảo hành chính hãng 12 tháng.',
    cta: { label: 'Xem điện thoại', to: '/san-pham?category=dien-thoai' },
    background: 'from-brand-700 via-brand-600 to-violet-700',
    Art: IconPhone,
  },
  {
    id: 'sale',
    eyebrow: 'Đang khuyến mãi',
    title: 'Ưu đãi hấp dẫn, giá tốt mỗi ngày',
    text: 'Hàng trăm lựa chọn đang được giảm giá. Miễn phí giao hàng cho đơn từ 5.000.000 ₫.',
    cta: { label: 'Xem khuyến mãi', to: '/san-pham?onSale=true' },
    background: 'from-rose-600 via-fuchsia-600 to-brand-700',
    Art: IconTag,
  },
  {
    id: 'laptop',
    eyebrow: 'Làm việc & học tập',
    title: 'Laptop mạnh mẽ cho mọi nhu cầu',
    text: 'Từ mỏng nhẹ văn phòng đến gaming hiệu năng cao, thanh toán khi nhận hàng.',
    cta: { label: 'Xem laptop', to: '/san-pham?category=laptop' },
    background: 'from-ink-900 via-brand-800 to-accent-500',
    Art: IconLaptop,
  },
];

export default function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // Người dùng bật "giảm chuyển động" trong hệ điều hành thì không tự chạy
  const reducedMotion =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    if (paused || reducedMotion) return undefined;
    const timer = setTimeout(
      () => setIndex((current) => (current + 1) % SLIDES.length),
      AUTOPLAY_MS,
    );
    // Phụ thuộc index: mỗi lần đổi slide (kể cả bấm tay) đồng hồ được đặt lại từ đầu
    return () => clearTimeout(timer);
  }, [index, paused, reducedMotion]);

  const go = (target) => setIndex((target + SLIDES.length) % SLIDES.length);
  const slide = SLIDES[index];
  const { Art } = slide;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Banner nổi bật"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="surface-dark relative overflow-hidden rounded-3xl text-white shadow-glow"
    >
      <div
        key={slide.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} trên ${SLIDES.length}`}
        className={`relative bg-gradient-to-br ${slide.background} animate-fade-in`}
      >
        <div className="bg-tech-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative grid items-center gap-6 px-6 py-12 sm:px-20 md:grid-cols-[1.4fr_1fr] md:py-16 lg:py-20">
          <div className="space-y-5">
            <span className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
              {slide.eyebrow}
            </span>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              {slide.title}
            </h2>
            <p className="max-w-xl text-base text-white/85 sm:text-lg">{slide.text}</p>
            <Link
              to={slide.cta.to}
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-700 shadow-lg transition hover:gap-3 hover:shadow-xl"
            >
              {slide.cta.label}
              <IconArrowRight size={18} />
            </Link>
          </div>

          {/* Hình trang trí lớn chỉ hiện trên màn hình rộng */}
          <div className="relative hidden justify-center md:flex" aria-hidden="true">
            <div className="absolute inset-0 m-auto h-56 w-56 rounded-full bg-white/10 blur-2xl" />
            <Art size={220} strokeWidth={1} className="relative text-white/90 drop-shadow-2xl" />
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Slide trước"
        onClick={() => go(index - 1)}
        className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 backdrop-blur transition hover:bg-black/45 sm:flex"
      >
        <IconChevronLeft size={22} />
      </button>
      <button
        type="button"
        aria-label="Slide sau"
        onClick={() => go(index + 1)}
        className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 backdrop-blur transition hover:bg-black/45 sm:flex"
      >
        <IconChevronRight size={22} />
      </button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {SLIDES.map((item, position) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Đến slide ${position + 1}`}
            aria-current={position === index}
            onClick={() => go(position)}
            className={`h-2 rounded-full transition-all ${
              position === index ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>
    </section>
  );
}
