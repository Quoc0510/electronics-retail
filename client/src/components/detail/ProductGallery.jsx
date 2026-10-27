/**
 * @feature [F04] Chi tiết sản phẩm - Bộ ảnh: ảnh lớn phóng to theo vị trí chuột, dải ảnh nhỏ để chọn (US-13 AC1).
 * Trên màn hình cảm ứng (không có chuột) ảnh hiển thị bình thường, không phóng.
 */
import { useState } from 'react';
import { IconZoomIn, discountPercent } from '@techstore/shared';
import { assetUrl } from '../../lib/api.js';

const ZOOM_SCALE = 2;

export default function ProductGallery({ images, name, price, salePrice }) {
  const [selected, setSelected] = useState(0);
  // Điểm (theo phần trăm) mà ảnh phóng quanh đó; null = không phóng
  const [zoomOrigin, setZoomOrigin] = useState(null);
  const current = images[selected] ?? images[0];
  const percent = discountPercent(price, salePrice);

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setZoomOrigin({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    });
  };

  if (images.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-3xl border border-slate-200 bg-slate-100 text-slate-400">
        Chưa có ảnh
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onMouseMove={handleMove}
        onMouseLeave={() => setZoomOrigin(null)}
        className="group relative aspect-square cursor-zoom-in overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card"
      >
        <img
          src={assetUrl(current.url)}
          alt={name}
          className="h-full w-full object-contain transition-transform duration-200 ease-out"
          style={{
            transformOrigin: zoomOrigin ? `${zoomOrigin.x}% ${zoomOrigin.y}%` : 'center',
            transform: zoomOrigin ? `scale(${ZOOM_SCALE})` : 'scale(1)',
          }}
        />
        {percent > 0 && (
          <span className="absolute left-4 top-4 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-3 py-1.5 text-sm font-bold text-white shadow-md">
            -{percent}%
          </span>
        )}
        <span className="pointer-events-none absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-full bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition group-hover:opacity-0 sm:[@media(hover:hover)]:flex">
          <IconZoomIn size={14} />
          Rê chuột để phóng to
        </span>
      </div>

      {images.length > 1 && (
        <ul className="flex flex-wrap gap-3">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                aria-label={`Xem ảnh ${index + 1}`}
                aria-current={index === selected}
                onClick={() => setSelected(index)}
                className={`block h-20 w-20 overflow-hidden rounded-xl border-2 transition ${
                  index === selected
                    ? 'border-brand-600 shadow-glow'
                    : 'border-slate-200 opacity-70 hover:border-brand-300 hover:opacity-100'
                }`}
              >
                <img src={assetUrl(image.url)} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
