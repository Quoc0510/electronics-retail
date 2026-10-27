/**
 * @feature [F12] Nút chuyển chế độ sáng/tối, dùng ở đầu trang Client và thanh bên Admin.
 * Nhãn đọc được nói rõ việc sẽ xảy ra khi bấm ("Chuyển sang chế độ tối"), biểu tượng chỉ mang tính trang trí.
 */
import { useTheme } from '../theme.js';
import { IconMoon, IconSun } from './icons.jsx';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${className}`}
    >
      {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
    </button>
  );
}
