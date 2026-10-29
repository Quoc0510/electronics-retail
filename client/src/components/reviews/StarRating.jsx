/**
 * @feature [F08] Đánh giá - Hiển thị điểm sao (có thể lẻ, ví dụ 4,3 sao) bằng hai lớp sao: lớp xám bên dưới,
 * lớp vàng bên trên cắt theo tỉ lệ điểm. Là một ảnh có nhãn đọc được ("4,3 trên 5 sao") cho trình đọc màn hình.
 */
import { IconStar } from '@techstore/shared';

// Số thập phân kiểu Việt Nam: 4,3 (không phải 4.3)
export const formatRating = (value) => String(value).replace('.', ',');

const stars = (size) =>
  [1, 2, 3, 4, 5].map((n) => (
    <IconStar key={n} size={size} className="shrink-0 fill-current" strokeWidth={1.5} />
  ));

export default function StarRating({ value, size = 16, className = '' }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span
      role="img"
      aria-label={`${formatRating(value)} trên 5 sao`}
      className={`relative inline-flex ${className}`}
    >
      <span className="flex text-slate-300" aria-hidden="true">
        {stars(size)}
      </span>
      <span
        className="absolute inset-y-0 left-0 flex overflow-hidden text-amber-400"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      >
        {stars(size)}
      </span>
    </span>
  );
}
