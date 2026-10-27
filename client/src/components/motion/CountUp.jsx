/**
 * @feature [F12] Hiệu ứng - Con số chạy từ 0 tới giá trị thật khi cuộn tới (dùng cho khối số liệu).
 * Không có IntersectionObserver hoặc người dùng bật "giảm chuyển động" thì hiện luôn giá trị cuối, không chạy.
 * Giá trị cuối luôn có sẵn trong DOM (chữ ẩn sr-only) để trình đọc màn hình không phải đọc các số trung gian.
 */
import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 1200;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export default function CountUp({ value, suffix = '', className = '' }) {
  const ref = useRef(null);
  const instant = typeof IntersectionObserver === 'undefined' || prefersReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (instant || !element) return undefined;

    let frame;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / DURATION_MS, 1);
        // Chạy nhanh lúc đầu rồi chậm dần (easeOutCubic)
        setCurrent(Math.round(value * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [instant, value]);

  const shown = instant ? value : current;
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">
        {value.toLocaleString('vi-VN')}
        {suffix}
      </span>
      <span aria-hidden="true">
        {shown.toLocaleString('vi-VN')}
        {suffix}
      </span>
    </span>
  );
}
