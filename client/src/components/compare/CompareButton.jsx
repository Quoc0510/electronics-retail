/**
 * @feature [F12] So sánh sản phẩm - Nút thêm/bỏ một sản phẩm khỏi danh sách so sánh.
 * variant "icon": nút tròn nhỏ nằm trên ảnh thẻ sản phẩm; "pill": nút có chữ dùng ở trang chi tiết.
 * aria-pressed cho trình đọc màn hình biết sản phẩm đang được chọn hay chưa.
 */
import { IconCheck, IconCompare } from '@techstore/shared';
import { useCompare } from '../../context/CompareContext.jsx';

export default function CompareButton({ product, variant = 'icon', className = '' }) {
  const { has, toggle } = useCompare();
  const active = has(product.slug);

  if (variant === 'pill') {
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => toggle(product)}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
          active
            ? 'border-brand-600 bg-brand-600 text-white shadow-glow'
            : 'border-slate-300 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700'
        } ${className}`}
      >
        {active ? <IconCheck size={16} /> : <IconCompare size={16} />}
        {active ? 'Đã thêm để so sánh' : 'So sánh'}
      </button>
    );
  }

  const label = active ? `Bỏ ${product.name} khỏi so sánh` : `So sánh ${product.name}`;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={active ? 'Bỏ khỏi so sánh' : 'Thêm vào so sánh'}
      onClick={() => toggle(product)}
      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-md backdrop-blur transition ${
        active
          ? 'bg-brand-600 text-white'
          : 'bg-white/90 text-slate-700 hover:bg-brand-600 hover:text-white'
      } ${className}`}
    >
      {active ? <IconCheck size={16} /> : <IconCompare size={16} />}
    </button>
  );
}
