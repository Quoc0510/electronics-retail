/**
 * @feature [F04] Danh sách sản phẩm - Ngăn kéo bộ lọc trên điện thoại (US-11).
 * Chuẩn truy cập: role="dialog" + aria-modal, đưa focus vào nút đóng khi mở, trả focus về nút mở khi đóng,
 * đóng bằng Esc hoặc bấm nền tối, khóa cuộn trang phía sau khi đang mở.
 */
import { useEffect, useRef } from 'react';
import { Button, IconClose } from '@techstore/shared';

export default function FilterDrawer({ open, onClose, total, children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement; // nút "Bộ lọc" đã mở ngăn kéo, để trả focus khi đóng
    closeRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Bộ lọc sản phẩm"
        className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-white shadow-2xl animate-fade-in"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="font-display text-lg font-bold text-slate-900">Bộ lọc</p>
          <button
            ref={closeRef}
            type="button"
            aria-label="Đóng bộ lọc"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <IconClose size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <div className="border-t border-slate-200 p-4">
          <Button onClick={onClose} className="w-full" size="lg">
            {total > 0 ? `Xem ${total} sản phẩm` : 'Đóng'}
          </Button>
        </div>
      </div>
    </div>
  );
}
