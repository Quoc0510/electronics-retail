/**
 * @feature [F12] Hiệu ứng - Khối nội dung hiện dần (trượt nhẹ lên) khi cuộn tới, dùng ở trang chủ và trang giới thiệu.
 * Môi trường không có IntersectionObserver (trình duyệt rất cũ, kiểm thử) thì hiện ngay, nội dung không bao giờ bị ẩn mãi.
 * Người dùng bật "giảm chuyển động" thì theme.css đã tắt hiệu ứng nên khối hiện tức thì.
 */
import { useEffect, useRef, useState } from 'react';

export default function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (shown || !element) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
      className={`transition duration-700 ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  );
}
