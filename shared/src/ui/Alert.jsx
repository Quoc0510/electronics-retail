/**
 * @feature [F01][F04] Khung thông báo lỗi hoặc thành công, có biểu tượng.
 * role="alert" để trình đọc màn hình đọc ngay khi lỗi xuất hiện.
 */
import { IconAlert, IconCheckCircle } from './icons.jsx';

const STYLES = {
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
};

export default function Alert({ type = 'error', children }) {
  const Icon = type === 'error' ? IconAlert : IconCheckCircle;

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in ${STYLES[type]}`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
