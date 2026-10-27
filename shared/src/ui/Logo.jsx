/**
 * @feature [F04] Logo TechStore: ô vuông bo góc chuyển màu chàm - tím chứa tia chớp, kèm tên cửa hàng.
 * tone="light": chữ trắng (dùng trên nền tối); tone="dark": chữ tối (dùng trên nền sáng).
 */
import { IconZap } from './icons.jsx';

export default function Logo({ tone = 'light', size = 'md' }) {
  const box = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const text = size === 'lg' ? 'text-2xl' : 'text-xl';

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`${box} flex items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow`}
      >
        <IconZap size={size === 'lg' ? 22 : 18} />
      </span>
      <span
        className={`font-display ${text} font-bold tracking-tight ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}
      >
        Tech<span className="text-accent-400">Store</span>
      </span>
    </span>
  );
}
