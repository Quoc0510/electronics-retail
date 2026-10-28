/**
 * @feature [F05] Giỏ hàng - Trang /gio-hang: xem, sửa số lượng, xóa sản phẩm (US-15). Khách chưa đăng nhập dùng giỏ lưu trên
 *  trình duyệt (xem useCart); đăng nhập là điều kiện của bước đặt hàng (F06), không phải của giỏ.
 *  - Số lượng từ 1 đến tồn kho (AC1); tổng tiền cập nhật ngay vì máy chủ trả lại toàn bộ giỏ sau mỗi thao tác (AC2).
 *  - Giỏ trống có gợi ý quay lại mua sắm (AC3).
 *  - Sản phẩm bị ẩn, hết hàng hoặc tồn kho giảm dưới số lượng được đánh dấu rõ và không tính vào tổng tiền (AC4).
 *  - Phí vận chuyển ước tính theo BR-05, kèm gợi ý số tiền còn thiếu để được miễn phí.
 * Nút "Đặt hàng" bị khóa cho tới khi làm F06.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Alert,
  Button,
  IconAlert,
  IconBag,
  IconTrash,
  IconTruck,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { assetUrl } from '../lib/api.js';
import { useCart } from '../hooks/useCart.js';
import { clearCartNotice, getCartNotice, subscribeCartNotice } from '../lib/cartNotice.js';
import { FREE_SHIPPING_THRESHOLD, amountToFreeShipping, shippingFee } from '../lib/shipping.js';
import QuantityStepper from '../components/cart/QuantityStepper.jsx';
import Price from '../components/Price.jsx';

const MAX_QUANTITY = 99;

// Thông báo và màu cho từng trạng thái dòng (OK không cần thông báo)
const STATUS_NOTICE = {
  UNAVAILABLE: 'Sản phẩm này không còn được bán. Hãy xóa khỏi giỏ.',
  OUT_OF_STOCK: 'Sản phẩm đã hết hàng. Hãy xóa khỏi giỏ hoặc quay lại sau.',
};

function CartLine({ item, busy, onChangeQuantity, onRemove, error, resetKey }) {
  const image = assetUrl(item.product.thumbnail);
  const blocked = item.status === 'UNAVAILABLE' || item.status === 'OUT_OF_STOCK';
  const max = Math.min(item.stock, MAX_QUANTITY);

  return (
    <li
      className={`flex gap-4 rounded-2xl border bg-white p-4 shadow-card ${
        item.status === 'OK' ? 'border-slate-200' : 'border-rose-200'
      }`}
    >
      <Link
        to={`/san-pham/${item.product.slug}`}
        className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 sm:h-28 sm:w-28"
      >
        {image ? (
          <img src={image} alt={item.product.name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-slate-400">Chưa có ảnh</span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              {item.product.brand.name}
            </p>
            <Link
              to={`/san-pham/${item.product.slug}`}
              className="line-clamp-2 font-semibold text-slate-900 hover:text-brand-700"
            >
              {item.product.name}
            </Link>
          </div>
          <button
            type="button"
            aria-label={`Xóa ${item.product.name} khỏi giỏ`}
            disabled={busy}
            onClick={onRemove}
            className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
          >
            <IconTrash size={18} />
          </button>
        </div>

        {STATUS_NOTICE[item.status] && (
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-rose-600">
            <IconAlert size={16} className="shrink-0" />
            {STATUS_NOTICE[item.status]}
          </p>
        )}
        {item.status === 'EXCEEDS_STOCK' && (
          <p
            role="status"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-rose-600"
          >
            <span className="flex items-center gap-1.5">
              <IconAlert size={16} className="shrink-0" />
              Chỉ còn {item.stock} sản phẩm trong kho.
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChangeQuantity(item.stock)}
              className="font-semibold underline underline-offset-2 hover:text-rose-800 disabled:opacity-50"
            >
              Giảm xuống {item.stock}
            </button>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            <Price
              price={item.product.price}
              salePrice={item.product.salePrice}
              showPercent={false}
            />
            {!blocked && (
              <QuantityStepper
                // Tạo lại khi số lượng thật thay đổi, hoặc khi một thao tác bị từ chối (resetKey), để ô nhập luôn khớp với máy chủ
                key={`${item.id}-${item.quantity}-${resetKey}`}
                value={item.quantity}
                max={max}
                disabled={busy}
                label={item.product.name}
                onChange={onChangeQuantity}
              />
            )}
          </div>
          <p className="text-right">
            <span className="block text-xs text-slate-500">Thành tiền</span>
            <span className="font-display text-lg font-bold text-slate-900">
              {formatVnd(item.lineTotal)}
            </span>
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-medium text-rose-600">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

function Summary({ cart, isLoggedIn }) {
  const location = useLocation();
  const fee = shippingFee(cart.subtotal);
  const missing = amountToFreeShipping(cart.subtotal);
  const progress = Math.min(100, Math.round((cart.subtotal / FREE_SHIPPING_THRESHOLD) * 100));
  const hasIssues = cart.items.length > 0 && !cart.canCheckout;

  return (
    <aside
      aria-label="Tóm tắt đơn hàng"
      className="sticky top-36 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
    >
      <h2 className="text-lg font-bold text-slate-900">Tóm tắt đơn hàng</h2>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Tạm tính ({cart.totalQuantity} sản phẩm)</dt>
          <dd className="font-semibold text-slate-900">{formatVnd(cart.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Phí vận chuyển</dt>
          <dd className="font-semibold text-slate-900">
            {fee === 0 ? 'Miễn phí' : formatVnd(fee)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
          <dt className="font-bold text-slate-900">Tổng cộng</dt>
          <dd className="font-display text-xl font-bold text-rose-600">
            {formatVnd(cart.subtotal + fee)}
          </dd>
        </div>
      </dl>

      {cart.subtotal > 0 && (
        <div className="space-y-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
          <p className="flex items-center gap-2 font-medium">
            <IconTruck size={16} className="shrink-0" />
            {missing > 0
              ? `Mua thêm ${formatVnd(missing)} để được miễn phí vận chuyển`
              : 'Đơn hàng của bạn được miễn phí vận chuyển'}
          </p>
          <div
            role="progressbar"
            aria-label="Tiến độ miễn phí vận chuyển"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            className="h-2 overflow-hidden rounded-full bg-brand-100"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {hasIssues && (
        <p role="status" className="text-sm font-medium text-rose-600">
          Có sản phẩm cần xử lý (đã ẩn, hết hàng hoặc vượt tồn kho). Các sản phẩm này chưa được tính
          vào tổng tiền.
        </p>
      )}

      <Button size="lg" className="w-full" disabled>
        Đặt hàng
      </Button>
      <p className="text-center text-xs text-slate-500">
        Chức năng đặt hàng và thanh toán khi nhận hàng sắp ra mắt.
      </p>
      {!isLoggedIn && (
        <p className="rounded-xl bg-slate-100 p-3 text-center text-sm text-slate-700">
          Giỏ hàng của bạn đang được lưu trên trình duyệt. Hãy{' '}
          <Link
            to="/dang-nhap"
            state={{ from: location }}
            className="font-semibold text-brand-600 hover:underline"
          >
            đăng nhập
          </Link>{' '}
          để đặt hàng; giỏ sẽ được giữ nguyên.
        </p>
      )}
      <Link
        to="/san-pham"
        className="block text-center text-sm font-semibold text-brand-600 hover:underline"
      >
        Tiếp tục mua sắm
      </Link>
    </aside>
  );
}

function CartSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải giỏ hàng"
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <div className="space-y-4">
        {[0, 1].map((n) => (
          <div key={n} className="skeleton h-36 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}

export default function CartPage() {
  const { cart, isLoggedIn, isPending, isError, error, refetch, updateItem, removeItem } =
    useCart();
  // Ghi chú sau khi gộp giỏ tạm vào tài khoản (ví dụ món bị giảm số lượng vì thiếu hàng)
  const notes = useSyncExternalStore(subscribeCartNotice, getCartNotice, () => []);
  // Lỗi của thao tác gần nhất, gắn với đúng dòng để hiện ngay dưới dòng đó
  const [lineError, setLineError] = useState(null);
  // Tăng mỗi khi một thao tác bị từ chối: ô số lượng đã đổi tạm trên màn hình phải quay về số lượng thật
  const [resetKey, setResetKey] = useState(0);
  const fail = (item, err) => {
    setLineError({ id: item.id, message: getErrorMessage(err) });
    setResetKey((key) => key + 1);
  };

  useEffect(() => {
    document.title = 'Giỏ hàng - TechStore';
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, []);

  const busy = updateItem.isPending || removeItem.isPending;

  const handleChange = (item, quantity) => {
    setLineError(null);
    updateItem.mutate({ itemId: item.id, quantity }, { onError: (err) => fail(item, err) });
  };

  const handleRemove = (item) => {
    setLineError(null);
    removeItem.mutate(item.id, { onError: (err) => fail(item, err) });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Giỏ hàng</h1>

      {notes.length > 0 && (
        <div
          role="status"
          className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-semibold">Giỏ hàng của bạn đã được điều chỉnh khi đăng nhập:</p>
          <ul className="list-disc space-y-1 pl-5">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={clearCartNotice}
            className="font-semibold underline underline-offset-2 hover:text-amber-700"
          >
            Đã hiểu
          </button>
        </div>
      )}

      {isPending && <CartSkeleton />}

      {isError && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(error)}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {!isPending && !isError && cart.items.length === 0 && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <IconBag size={30} />
          </span>
          <h2 className="text-xl font-bold text-slate-900">Giỏ hàng của bạn đang trống</h2>
          <p className="text-slate-600">
            Hãy khám phá các sản phẩm và thêm món bạn thích vào giỏ nhé.
          </p>
          <Link
            to="/san-pham"
            className="rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      )}

      {!isPending && !isError && cart.items.length > 0 && (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <ul className="space-y-4">
            {cart.items.map((item) => (
              <CartLine
                key={item.id}
                item={item}
                busy={busy}
                error={lineError?.id === item.id ? lineError.message : ''}
                resetKey={resetKey}
                onChangeQuantity={(quantity) => handleChange(item, quantity)}
                onRemove={() => handleRemove(item)}
              />
            ))}
          </ul>
          <Summary cart={cart} isLoggedIn={isLoggedIn} />
        </div>
      )}
    </div>
  );
}
