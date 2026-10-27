/**
 * @feature [F12] Trang thông tin - Giới thiệu TechStore: câu chuyện, giá trị cốt lõi, số liệu thật của cửa hàng
 * (đếm từ API danh mục và thương hiệu, không viết cứng) và lời kêu gọi mua sắm.
 * Nội dung nói rõ đây là dự án học tập, không bịa số liệu kinh doanh.
 */
import { Link } from 'react-router-dom';
import {
  IconArrowRight,
  IconAward,
  IconCheckCircle,
  IconShield,
  IconUsers,
} from '@techstore/shared';
import InfoLayout from '../../components/info/InfoLayout.jsx';
import CountUp from '../../components/motion/CountUp.jsx';
import Reveal from '../../components/motion/Reveal.jsx';
import { useBrands, useCategories } from '../../hooks/useCatalog.js';

const VALUES = [
  {
    Icon: IconShield,
    title: 'Chính hãng, minh bạch',
    text: 'Mọi sản phẩm đều chính hãng, giá hiển thị là giá thật, giá khuyến mãi luôn kèm giá gốc để bạn tự so sánh.',
  },
  {
    Icon: IconCheckCircle,
    title: 'Hậu mãi tận tâm',
    text: 'Bảo hành 12 tháng theo chuẩn nhà sản xuất, đổi mới trong 7 ngày nếu lỗi do nhà sản xuất.',
  },
  {
    Icon: IconAward,
    title: 'Trải nghiệm dễ chịu',
    text: 'Tìm kiếm, lọc, so sánh sản phẩm nhanh gọn; giao diện rõ ràng, dùng tốt trên cả điện thoại lẫn máy tính.',
  },
  {
    Icon: IconUsers,
    title: 'Lắng nghe khách hàng',
    text: 'Mọi góp ý đều được xem xét để cải tiến từng phiên bản của cửa hàng.',
  },
];

export default function AboutPage() {
  const categories = useCategories();
  const brands = useBrands();

  // Số liệu thật: tổng số sản phẩm cộng từ số sản phẩm của từng danh mục
  const stats = [
    {
      label: 'Sản phẩm',
      value: categories.data?.reduce((sum, category) => sum + category.productCount, 0),
    },
    { label: 'Danh mục', value: categories.data?.length },
    { label: 'Thương hiệu', value: brands.data?.length },
    { label: 'Tháng bảo hành', value: 12 },
  ];

  return (
    <InfoLayout
      title="Về TechStore"
      description="Cửa hàng thiết bị điện tử trực tuyến: điện thoại, laptop, máy tính bảng, đồng hồ thông minh và phụ kiện chính hãng."
      crumbs={[{ label: 'Giới thiệu' }]}
    >
      <Reveal>
        <section
          aria-labelledby="story-heading"
          className="surface-dark relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-brand-800 to-brand-600 p-8 text-white shadow-glow md:p-10"
        >
          <div className="bg-tech-grid absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative max-w-2xl space-y-3">
            <h2 id="story-heading" className="font-display text-2xl font-bold md:text-3xl">
              Công nghệ đến gần mọi người
            </h2>
            <p className="leading-relaxed text-white/85">
              TechStore được xây dựng với mục tiêu giúp việc chọn mua thiết bị điện tử trở nên đơn
              giản: thông tin rõ ràng, giá minh bạch và quy trình mua hàng gọn nhẹ. Đây là sản phẩm
              của đồ án môn học Công nghệ phần mềm, được phát triển theo từng tính năng và kiểm thử
              cẩn thận.
            </p>
          </div>
        </section>
      </Reveal>

      <section aria-label="Số liệu cửa hàng">
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat) => (
            <li
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-card"
            >
              <p className="font-display text-4xl font-bold text-brand-600">
                {stat.value === undefined ? (
                  <span className="skeleton inline-block h-9 w-14 rounded align-middle" />
                ) : (
                  <CountUp value={stat.value} />
                )}
              </p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="values-heading" className="space-y-4">
        <h2 id="values-heading" className="text-2xl font-bold text-slate-900">
          Giá trị cốt lõi
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {VALUES.map(({ Icon, title, text }, index) => (
            <li key={title}>
              <Reveal delay={index * 80} className="h-full">
                <div className="flex h-full gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-md">
                    <Icon size={24} />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/san-pham"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:gap-3 hover:shadow-glow"
        >
          Khám phá sản phẩm <IconArrowRight size={16} />
        </Link>
        <Link
          to="/lien-he"
          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
        >
          Liên hệ chúng tôi
        </Link>
      </div>
    </InfoLayout>
  );
}
