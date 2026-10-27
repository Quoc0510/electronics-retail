/**
 * @feature [F04] Duyệt và tìm sản phẩm - Hiển thị giá: có khuyến mãi thì giá khuyến mãi màu đỏ,
 * giá gốc gạch ngang và (tùy chọn) nhãn phần trăm giảm (US-13 AC1, BR-02).
 * showPercent = false dùng ở thẻ sản phẩm, nơi nhãn phần trăm đã nằm trên ảnh.
 */
import { discountPercent, formatVnd } from '@techstore/shared';

export default function Price({ price, salePrice, large = false, showPercent = true }) {
  const percent = discountPercent(price, salePrice);

  if (!percent) {
    return (
      <span
        className={`font-display font-bold text-slate-900 ${large ? 'text-3xl md:text-4xl' : 'text-lg'}`}
      >
        {formatVnd(price)}
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <span
        className={`font-display font-bold text-rose-600 ${large ? 'text-3xl md:text-4xl' : 'text-lg'}`}
      >
        {formatVnd(salePrice)}
      </span>
      <span className={`text-slate-400 line-through ${large ? 'text-lg' : 'text-sm'}`}>
        {formatVnd(price)}
      </span>
      {showPercent && (
        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
          -{percent}%
        </span>
      )}
    </span>
  );
}
