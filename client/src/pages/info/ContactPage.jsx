/**
 * @feature [F12] Trang thông tin - Liên hệ: địa chỉ, hotline, email, giờ làm việc và lối tắt tới hỏi đáp.
 * Số điện thoại và email là liên kết bấm được (tel:, mailto:). Form gửi tin nhắn cần backend nên để ở đợt sau;
 * hiện tại khách liên hệ bằng email hoặc hotline. Bản đồ là hình minh họa (không nhúng dịch vụ bên ngoài để không
 * theo dõi người dùng và không phụ thuộc mạng).
 */
import { Link } from 'react-router-dom';
import { IconClock, IconHelp, IconMail, IconMapPin, IconPhone } from '@techstore/shared';
import InfoLayout from '../../components/info/InfoLayout.jsx';
import { STORE } from '../../lib/storeInfo.js';

const CHANNELS = [
  { Icon: IconMapPin, label: 'Địa chỉ', value: STORE.address },
  { Icon: IconPhone, label: 'Hotline', value: STORE.hotline, href: STORE.hotlineHref },
  { Icon: IconMail, label: 'Email', value: STORE.email, href: `mailto:${STORE.email}` },
  { Icon: IconClock, label: 'Giờ làm việc', value: STORE.hours },
];

// Bản đồ minh họa: lưới đường phố đơn giản với một điểm đánh dấu
function MapIllustration() {
  return (
    <svg
      role="img"
      aria-label="Bản đồ minh họa vị trí cửa hàng"
      viewBox="0 0 400 240"
      className="h-full w-full"
    >
      <rect width="400" height="240" fill="var(--color-slate-100)" />
      <g stroke="var(--color-slate-300)" strokeWidth="10" strokeLinecap="round" fill="none">
        <path d="M-10 60 L410 90" />
        <path d="M-10 170 L410 150" />
        <path d="M110 -10 L90 250" />
        <path d="M270 -10 L300 250" />
      </g>
      <g stroke="var(--color-slate-200)" strokeWidth="5" fill="none">
        <path d="M-10 120 L410 125" />
        <path d="M190 -10 L195 250" />
      </g>
      <circle cx="195" cy="122" r="26" fill="var(--color-brand-500)" opacity="0.18" />
      <path
        d="M195 148 C195 148 178 128 178 114 a17 17 0 0 1 34 0 C212 128 195 148 195 148 z"
        fill="var(--color-brand-600)"
      />
      <circle cx="195" cy="114" r="6" fill="#fff" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <InfoLayout
      title="Liên hệ"
      description="Chúng tôi luôn sẵn sàng hỗ trợ bạn về sản phẩm, đơn hàng và bảo hành."
      crumbs={[{ label: 'Liên hệ' }]}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <ul className="space-y-3">
          {CHANNELS.map(({ Icon, label, value, href }) => (
            <li
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                {href ? (
                  <a
                    href={href}
                    className="font-semibold text-slate-900 hover:text-brand-700 hover:underline"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="font-semibold text-slate-900">{value}</p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-card">
          <div className="aspect-[5/3] w-full">
            <MapIllustration />
          </div>
        </div>
      </div>

      <section
        aria-labelledby="quick-help-heading"
        className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm">
          <IconHelp size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="quick-help-heading" className="font-bold text-slate-900">
            Cần câu trả lời nhanh?
          </h2>
          <p className="text-sm text-slate-600">
            Phần lớn thắc mắc về giao hàng, bảo hành, đổi trả đã có sẵn trong mục hỏi đáp.
          </p>
        </div>
        <Link
          to="/cau-hoi-thuong-gap"
          className="rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
        >
          Xem câu hỏi thường gặp
        </Link>
      </section>

      <p className="text-xs text-slate-500">
        Lưu ý: thông tin liên hệ ở trên là dữ liệu mẫu phục vụ đồ án môn học.
      </p>
    </InfoLayout>
  );
}
