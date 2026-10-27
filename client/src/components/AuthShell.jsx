/**
 * @feature [F01][F04] Khung chung cho trang đăng nhập và đăng ký: bảng giới thiệu chuyển màu bên trái (ẩn trên điện thoại)
 * và biểu mẫu bên phải. Giúp hai trang có cùng bố cục, trông như một sản phẩm hoàn chỉnh.
 */
import { IconCheckCircle, Logo } from '@techstore/shared';

const PERKS = [
  'Theo dõi đơn hàng mọi lúc',
  'Lưu sổ địa chỉ, đặt hàng nhanh hơn',
  'Ưu đãi dành riêng cho thành viên',
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card md:grid-cols-[1fr_1.1fr]">
      <aside className="surface-dark relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-ink-900 via-brand-800 to-brand-600 p-10 text-white md:flex">
        <div className="bg-tech-grid absolute inset-0 opacity-60" aria-hidden="true" />
        <div
          className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent-400/25 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-violet-500/30 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative">
          <Logo size="lg" />
        </div>
        <div className="relative space-y-5">
          <h2 className="font-display text-3xl font-bold leading-tight">
            Mua sắm thiết bị công nghệ chính hãng
          </h2>
          <ul className="space-y-3 text-sm text-white/85">
            {PERKS.map((perk) => (
              <li key={perk} className="flex items-center gap-2.5">
                <IconCheckCircle size={18} className="shrink-0 text-accent-300" />
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="p-8 sm:p-12">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="mt-6 text-center text-sm text-slate-600">{footer}</div>}
      </div>
    </div>
  );
}
