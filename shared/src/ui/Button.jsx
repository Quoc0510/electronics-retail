/**
 * @feature [F01][F04] Nút bấm dùng chung cho Client và Admin.
 * loading = true khóa nút và hiện vòng xoay để người dùng không bấm đúp gửi form hai lần (liên quan US-16 AC6).
 * variant: primary (chuyển màu chàm - tím), secondary (viền), danger (đỏ), ghost (không viền, cho thao tác phụ).
 * size: sm | md | lg.
 */
const VARIANTS = {
  primary:
    'bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-sm hover:shadow-glow hover:brightness-110 active:scale-[0.98]',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin-slow rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
