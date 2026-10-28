/**
 * @feature [F04][F12] Chân trang: giới thiệu, lối tắt mua sắm, hỗ trợ (hỏi đáp, chính sách), liên hệ và cam kết dịch vụ.
 * Nội dung dịch vụ khớp quy tắc nghiệp vụ của hệ thống (BR-05 miễn phí giao từ 5.000.000 đ, BR-08 thanh toán khi nhận hàng).
 */
import { Link } from 'react-router-dom';
import { IconClock, IconMail, IconMapPin, IconPhone, Logo, ThemeToggle } from '@techstore/shared';
import { POLICIES } from '../../lib/policies.js';
import { STORE, TEAM } from '../../lib/storeInfo.js';

const linkClass = 'text-slate-400 transition hover:text-white';
const headingClass = 'mb-3 text-sm font-semibold uppercase tracking-wider text-white';

export default function Footer() {
  return (
    <footer className="surface-dark mt-16 bg-ink-950 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Logo />
          <p className="max-w-xs text-sm leading-relaxed text-slate-400">
            Cửa hàng thiết bị điện tử chính hãng: điện thoại, laptop, máy tính bảng, phụ kiện và
            đồng hồ thông minh.
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <IconMapPin size={16} className="mt-0.5 shrink-0 text-accent-400" />
              {STORE.address}
            </li>
            <li className="flex items-center gap-2">
              <IconPhone size={16} className="shrink-0 text-accent-400" />
              <a href={STORE.hotlineHref} className="hover:text-white">
                {STORE.hotline}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <IconMail size={16} className="shrink-0 text-accent-400" />
              <a href={`mailto:${STORE.email}`} className="hover:text-white">
                {STORE.email}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <IconClock size={16} className="shrink-0 text-accent-400" />
              {STORE.hours}
            </li>
          </ul>
        </div>

        <nav aria-label="Mua sắm">
          <h2 className={headingClass}>Mua sắm</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/san-pham" className={linkClass}>
                Tất cả sản phẩm
              </Link>
            </li>
            <li>
              <Link to="/san-pham?onSale=true" className={linkClass}>
                Sản phẩm khuyến mãi
              </Link>
            </li>
            <li>
              <Link to="/san-pham?sort=price_asc" className={linkClass}>
                Giá tốt nhất
              </Link>
            </li>
            <li>
              <Link to="/so-sanh" className={linkClass}>
                So sánh sản phẩm
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Hỗ trợ">
          <h2 className={headingClass}>Hỗ trợ</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/gioi-thieu" className={linkClass}>
                Giới thiệu
              </Link>
            </li>
            <li>
              <Link to="/lien-he" className={linkClass}>
                Liên hệ
              </Link>
            </li>
            <li>
              <Link to="/cau-hoi-thuong-gap" className={linkClass}>
                Câu hỏi thường gặp
              </Link>
            </li>
            {POLICIES.map((policy) => (
              <li key={policy.slug}>
                <Link to={`/chinh-sach/${policy.slug}`} className={linkClass}>
                  {policy.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className={headingClass}>Cam kết</h2>
          <ul className="space-y-2 text-sm text-slate-400">
            <li>Hàng chính hãng, bảo hành 12 tháng</li>
            <li>Miễn phí giao hàng từ 5.000.000&nbsp;₫</li>
            <li>Thanh toán khi nhận hàng (COD)</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl space-y-2 px-4 py-5 text-center text-xs text-slate-500">
          <p>© 2026 TechStore · Đồ án môn học Công nghệ phần mềm</p>
          {/* Trên điện thoại nút này không nằm ở đầu trang (hết chỗ) nên đặt thêm ở đây */}
          <div className="flex justify-center sm:hidden">
            <ThemeToggle className="border border-white/15 text-slate-300 hover:bg-white/10" />
          </div>
          <ul
            aria-label="Sinh viên thực hiện"
            className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-slate-400"
          >
            <li className="font-medium text-slate-300">Sinh viên thực hiện:</li>
            {TEAM.map((member) => (
              <li key={member.studentId}>
                {member.name} - MSSV: {member.studentId}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
