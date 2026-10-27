/**
 * @feature [F12] Trang chủ - Dải số liệu nền tối: tổng sản phẩm, danh mục, thương hiệu (đếm thật từ API) và thời hạn bảo hành.
 * Chỉ hiện khi đã có dữ liệu danh mục và thương hiệu; các con số chạy từ 0 khi cuộn tới (CountUp).
 */
import CountUp from '../motion/CountUp.jsx';

export default function StatsBand({ categories, brands }) {
  const totalProducts = categories.reduce((sum, category) => sum + category.productCount, 0);
  const stats = [
    { label: 'Sản phẩm chính hãng', value: totalProducts },
    { label: 'Danh mục', value: categories.length },
    { label: 'Thương hiệu', value: brands.length },
    { label: 'Tháng bảo hành', value: 12 },
  ];

  return (
    <section
      aria-label="Số liệu về TechStore"
      className="surface-dark relative overflow-hidden rounded-3xl bg-gradient-to-br from-ink-900 via-brand-900 to-ink-800 px-6 py-10 text-white shadow-glow"
    >
      <div className="bg-tech-grid absolute inset-0 opacity-50" aria-hidden="true" />
      <ul className="relative grid grid-cols-2 gap-6 text-center lg:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label}>
            <p className="bg-gradient-to-r from-accent-300 to-brand-300 bg-clip-text font-display text-4xl font-bold text-transparent md:text-5xl">
              <CountUp value={stat.value} />
            </p>
            <p className="mt-1 text-sm text-slate-300">{stat.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
