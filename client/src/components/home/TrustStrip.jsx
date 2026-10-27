/**
 * @feature [F04] Trang chủ - Dải cam kết dịch vụ. Nội dung khớp quy tắc nghiệp vụ thật của hệ thống:
 * BR-05 (miễn phí giao hàng từ 5.000.000 đ) và BR-08 (thanh toán khi nhận hàng - COD).
 */
import { IconCash, IconCheckCircle, IconShield, IconTruck } from '@techstore/shared';

const ITEMS = [
  { Icon: IconShield, title: 'Hàng chính hãng', text: 'Cam kết 100% chính hãng' },
  { Icon: IconTruck, title: 'Miễn phí giao hàng', text: 'Cho đơn từ 5.000.000 ₫' },
  { Icon: IconCash, title: 'Thanh toán khi nhận hàng', text: 'Kiểm tra hàng rồi mới trả tiền' },
  { Icon: IconCheckCircle, title: 'Bảo hành 12 tháng', text: 'Hỗ trợ đổi sửa tận nơi' },
];

export default function TrustStrip() {
  return (
    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-card lg:grid-cols-4">
      {ITEMS.map(({ Icon, title, text }) => (
        <li key={title} className="flex items-center gap-3 bg-white p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon size={22} />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
