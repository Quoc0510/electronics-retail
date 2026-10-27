/**
 * @feature [F12] Nút "Lên đầu trang": hiện khi đã cuộn xa, bấm để cuộn mượt về đầu.
 * Nằm sát góc phải; nâng lên khi thanh so sánh đang hiện ở đáy màn hình để không bị che.
 */
import { useEffect, useState } from 'react';
import { IconChevronUp } from '@techstore/shared';
import { useCompare } from '../../context/CompareContext.jsx';

const SHOW_AFTER_PX = 600;

export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const { items } = useCompare();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Lên đầu trang"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow transition hover:brightness-110 animate-fade-in ${
        items.length > 0 ? 'bottom-24' : 'bottom-6'
      }`}
    >
      <IconChevronUp size={22} />
    </button>
  );
}
