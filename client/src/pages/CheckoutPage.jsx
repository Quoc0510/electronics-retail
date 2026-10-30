/**
 * @feature [F06][F09][F13] Đặt hàng - Trang /dat-hang: chọn hoặc nhập địa chỉ giao hàng, xem lại sản phẩm, phí vận chuyển
 * và tổng tiền, rồi xác nhận đặt hàng thanh toán khi nhận hàng (US-16 AC1, AC2).
 *  - [F13] Không cần đăng nhập (BR-11): khách nhập địa chỉ trực tiếp, gửi giỏ lưu trên trình duyệt kèm requestId (chống đặt
 *    trùng). Đăng nhập chỉ để dùng sổ địa chỉ và tích điểm thành viên (BR-15); trang nói rõ số điểm đơn này sẽ được.
 *  - Có địa chỉ đã lưu thì chọn địa chỉ mặc định sẵn; chưa có thì mở sẵn form nhập địa chỉ mới.
 *  - Nút xác nhận bị khóa trong lúc đang gửi nên bấm đúp không gửi hai lần (AC6; backend cũng chặn đặt trùng).
 *  - Hết hàng, sản phẩm bị ẩn hoặc không đủ số lượng: hiện danh sách sản phẩm có vấn đề kèm đường về giỏ hàng (AC4).
 *  - Đặt thành công: giỏ được làm trống ngay và chuyển tới trang đơn hàng (AC3).
 *  - [F09] Có ô nhập mã giảm giá (US-25): hiện ngay số tiền giảm, phí ship và điểm thành viên tính trên tiền hàng sau giảm
 *    (BR-14, BR-05, BR-15). Mã đang lỗi thì không gửi kèm đơn.
 * Phí vận chuyển và số tiền giảm ở đây là ước tính theo BR-05, BR-14; số cuối cùng do backend tính và trả về trên trang đơn hàng.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  FormField,
  IconBag,
  IconCash,
  IconCheckCircle,
  IconTruck,
  amountToNextPoint,
  calculatePoints,
  formatVnd,
  getErrorMessage,
  useFormState,
} from '@techstore/shared';
import { api, assetUrl } from '../lib/api.js';
import CouponBox from '../components/checkout/CouponBox.jsx'; // [F09]
import { useCouponPreview } from '../hooks/useCouponPreview.js'; // [F09]
import { useMe } from '../hooks/useMe.js'; // [F13]
import { clearGuestItems } from '../lib/guestCart.js'; // [F13]
import { newRequestId, rememberGuestOrder } from '../lib/guestOrder.js'; // [F13]
import { EMPTY_ADDRESS, toShippingPayload, validateAddress } from '../lib/addressValidation.js';
import { shippingFee } from '../lib/shipping.js';
import { useAuth } from '../context/AuthContext.jsx';
import { EMPTY_CART, useCart } from '../hooks/useCart.js';

const NOTE_MAX = 500;
const NEW_ADDRESS = 'new';

const initialValues = { ...EMPTY_ADDRESS, note: '' };

const validate = (values, choice) => {
  const errors = choice === NEW_ADDRESS ? validateAddress(values) : {};
  if (values.note.length > NOTE_MAX) errors.note = `Ghi chú tối đa ${NOTE_MAX} ký tự`;
  return errors;
};

const formatSavedAddress = (address) =>
  [address.street, address.ward, address.district, address.province].filter(Boolean).join(', ');

function CheckoutSkeleton() {
  return (
    <div
      role="status"
      aria-label="Đang tải trang đặt hàng"
      className="grid gap-6 lg:grid-cols-[1fr_24rem]"
    >
      <div className="skeleton h-96 rounded-2xl" />
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  );
}

function Section({ step, title, children }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm text-white">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function CheckoutPage() {
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cart, isPending: cartPending, isMerging, isError: cartError, error, refetch } = useCart();
  const form = useFormState(initialValues);

  // Sản phẩm có vấn đề do backend báo khi đặt không thành công (hết hàng, đã ẩn, không đủ số lượng)
  const [problems, setProblems] = useState([]);
  // Địa chỉ đang chọn: id địa chỉ đã lưu hoặc "new"; null nghĩa là chưa chọn, dùng địa chỉ mặc định
  const [selected, setSelected] = useState(null);
  // [F09] Mã giảm giá khách đã bấm áp dụng (chuỗi in hoa) hoặc null
  const [couponCode, setCouponCode] = useState(null);
  // [F13] Mã của lần đặt này (khách không đăng nhập): bấm đúp hay thử lại sau khi mất mạng không tạo hai đơn
  const [requestId] = useState(newRequestId);

  useEffect(() => {
    document.title = 'Đặt hàng - TechStore';
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, []);

  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/me/addresses').then((res) => res.data),
    enabled: Boolean(user), // khách không đăng nhập không có sổ địa chỉ
  });
  const saved = addresses.data ?? [];

  // Không tải được sổ địa chỉ thì vẫn đặt được bằng cách nhập địa chỉ mới
  const defaultChoice = saved.find((a) => a.isDefault)?.id ?? saved[0]?.id ?? NEW_ADDRESS;
  const choice = selected ?? defaultChoice;

  // [F09] Số tiền giảm xem trước; phí ship (BR-05) và điểm (BR-15) đều tính trên tiền hàng SAU giảm (BR-14)
  const coupon = useCouponPreview(couponCode, cart.items, user?.id ?? null);
  const payable = cart.subtotal - coupon.discount;
  const fee = shippingFee(payable);
  const total = payable + fee;
  // BR-15: điểm đơn này được khi hoàn thành (chỉ thành viên), tính theo tổng đã mua; khách coi như bắt đầu từ 0
  const { totalSpent } = useMe();
  const points = calculatePoints(user ? totalSpent : 0, payable);

  const submit = async (values) => {
    setProblems([]);
    const body =
      choice === NEW_ADDRESS ? { shipping: toShippingPayload(values) } : { addressId: choice };
    if (values.note.trim()) body.note = values.note.trim();
    if (coupon.quote) body.couponCode = coupon.quote.code; // [F09] mã đang lỗi thì không gửi

    try {
      let order;
      if (user) {
        ({ data: order } = await api.post('/orders', body));
        // Giỏ đã được backend xóa; làm trống cache để mọi nơi (biểu tượng giỏ, trang giỏ) cập nhật ngay
        queryClient.setQueryData(['cart', user.id], EMPTY_CART);
      } else {
        // [F13] Khách không đăng nhập: gửi giỏ lưu trên trình duyệt; đặt xong thì dọn giỏ và nhớ số điện thoại để xem đơn
        ({ data: order } = await api.post('/orders/guest', {
          ...body,
          items: cart.items.map(({ productId, quantity }) => ({ productId, quantity })),
          requestId,
        }));
        rememberGuestOrder(order.code, order.phone);
        clearGuestItems();
      }
      navigate(`/don-hang/${order.code}`, { state: { justPlaced: true }, replace: true });
    } catch (err) {
      setProblems(err.response?.data?.error?.details?.items ?? []);
      // [F09] Mã vừa bị từ chối (hết lượt, hết hạn...): kiểm tra lại để ô mã nói đúng lý do
      queryClient.invalidateQueries({ queryKey: ['coupon-preview'] });
      // Giỏ có thể đã thay đổi (tồn kho giảm, sản phẩm bị ẩn): tải lại để trang giỏ hiện trạng thái mới
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      throw err; // để useFormState hiện thông báo lỗi chung
    }
  };

  if (initializing || cartPending || isMerging || (user && addresses.isPending)) {
    return <CheckoutSkeleton />;
  }

  if (cartError) {
    return (
      <div className="space-y-3">
        <Alert>{getErrorMessage(error)}</Alert>
        <Button variant="secondary" onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
          <IconBag size={30} />
        </span>
        <h1 className="text-xl font-bold text-slate-900">Giỏ hàng của bạn đang trống</h1>
        <p className="text-slate-600">Hãy chọn sản phẩm trước khi đặt hàng.</p>
        <Link
          to="/san-pham"
          className="rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110"
        >
          Tiếp tục mua sắm
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">Đặt hàng</h1>

      <form
        onSubmit={form.handleSubmit((values) => validate(values, choice), submit)}
        aria-label="Thông tin đặt hàng"
        className="grid items-start gap-6 lg:grid-cols-[1fr_24rem]"
        noValidate
      >
        <div className="space-y-6">
          <Section step={1} title={user ? 'Địa chỉ giao hàng' : 'Thông tin giao hàng'}>
            {!user && (
              <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
                Bạn đang đặt hàng không cần tài khoản. Hãy nhớ mã đơn và số điện thoại bên dưới để
                tra cứu đơn sau này.
              </p>
            )}
            {addresses.isError && (
              <p role="status" className="text-sm text-slate-600">
                Không tải được sổ địa chỉ của bạn, hãy nhập địa chỉ giao hàng bên dưới.
              </p>
            )}

            {saved.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="sr-only">Chọn địa chỉ giao hàng</legend>
                {saved.map((address) => (
                  <label
                    key={address.id}
                    className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm transition ${
                      choice === address.id
                        ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                        : 'border-slate-200 hover:border-brand-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={choice === address.id}
                      onChange={() => setSelected(address.id)}
                      className="mt-1"
                    />
                    <span className="space-y-0.5">
                      <span className="block font-semibold text-slate-900">
                        {address.recipientName} · {address.phone}
                        {address.isDefault && (
                          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                            Mặc định
                          </span>
                        )}
                      </span>
                      <span className="block text-slate-600">{formatSavedAddress(address)}</span>
                    </span>
                  </label>
                ))}
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-semibold transition ${
                    choice === NEW_ADDRESS
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                      : 'border-slate-200 text-slate-700 hover:border-brand-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    checked={choice === NEW_ADDRESS}
                    onChange={() => setSelected(NEW_ADDRESS)}
                  />
                  Giao tới địa chỉ khác
                </label>
              </fieldset>
            )}

            {choice === NEW_ADDRESS && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Tên người nhận" {...form.bind('recipientName')} />
                <FormField label="Số điện thoại người nhận" type="tel" {...form.bind('phone')} />
                <FormField label="Tỉnh/Thành phố" {...form.bind('province')} />
                <FormField label="Quận/Huyện (nếu có)" {...form.bind('district')} />
                <FormField label="Phường/Xã" {...form.bind('ward')} />
                <FormField label="Số nhà, tên đường" {...form.bind('street')} />
              </div>
            )}
          </Section>

          <Section step={2} title="Phương thức thanh toán">
            <label className="flex items-center gap-3 rounded-xl border border-brand-500 bg-brand-50 p-4 text-sm ring-1 ring-brand-200">
              <input type="radio" name="payment" checked readOnly />
              <IconCash size={22} className="text-brand-600" />
              <span>
                <span className="block font-semibold text-slate-900">
                  Thanh toán khi nhận hàng (COD)
                </span>
                <span className="block text-slate-600">
                  Kiểm tra hàng rồi mới trả tiền cho nhân viên giao hàng.
                </span>
              </span>
            </label>
          </Section>

          <Section step={3} title="Ghi chú cho người giao hàng (không bắt buộc)">
            <FormField
              label="Ghi chú"
              multiline
              rows={3}
              placeholder="Ví dụ: giao giờ hành chính, gọi trước khi giao"
              {...form.bind('note')}
            />
          </Section>

          <Section step={4} title="Mã giảm giá (không bắt buộc)">
            <CouponBox
              appliedCode={couponCode}
              quote={coupon.quote}
              checking={coupon.checking}
              error={coupon.error}
              onApply={setCouponCode}
              onRemove={() => setCouponCode(null)}
            />
          </Section>
        </div>

        <aside
          aria-label="Đơn hàng của bạn"
          className="sticky top-36 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
        >
          <h2 className="text-lg font-bold text-slate-900">Đơn hàng của bạn</h2>

          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {cart.items.map((item) => (
              <li key={item.id} className="flex gap-3 text-sm">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                  {item.product.thumbnail ? (
                    <img
                      src={assetUrl(item.product.thumbnail)}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <IconBag size={18} className="text-slate-400" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium text-slate-900">
                    {item.product.name}
                  </span>
                  <span className="text-slate-500">
                    {formatVnd(item.unitPrice)} × {item.quantity}
                  </span>
                </span>
                <span className="font-semibold text-slate-900">{formatVnd(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-600">Tạm tính</dt>
              <dd className="font-semibold text-slate-900">{formatVnd(cart.subtotal)}</dd>
            </div>
            {coupon.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-slate-600">Mã giảm giá ({coupon.quote.code})</dt>
                <dd className="font-semibold text-emerald-700">-{formatVnd(coupon.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 text-slate-600">
                <IconTruck size={15} /> Phí vận chuyển
              </dt>
              <dd className="font-semibold text-slate-900">
                {fee === 0 ? 'Miễn phí' : formatVnd(fee)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
              <dt className="font-bold text-slate-900">Tổng thanh toán</dt>
              <dd className="font-display text-xl font-bold text-rose-600">{formatVnd(total)}</dd>
            </div>
          </dl>

          {!cart.canCheckout && (
            <p role="status" className="text-sm font-medium text-rose-600">
              Giỏ hàng có sản phẩm cần xử lý (đã ẩn, hết hàng hoặc vượt tồn kho).{' '}
              <Link to="/gio-hang" className="underline">
                Quay lại giỏ hàng để chỉnh sửa
              </Link>
            </p>
          )}

          {/* [F13] BR-15: thành viên được tích điểm, khách không đăng nhập thì được mời đăng nhập */}
          {(points > 0 || user) &&
            (user ? (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
                {points > 0
                  ? `Bạn sẽ nhận ${points} điểm thành viên khi đơn hoàn thành.`
                  : `Mua thêm ${formatVnd(amountToNextPoint(totalSpent + payable))} nữa (tính cả đơn này) để được thêm 1 điểm thành viên.`}
              </p>
            ) : (
              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                Đơn này sẽ được {points} điểm nếu bạn là thành viên. Muốn tích điểm?{' '}
                <Link
                  to="/dang-nhap"
                  state={{ from: { pathname: '/dat-hang' } }}
                  className="font-semibold text-brand-600 hover:underline"
                >
                  đăng nhập
                </Link>{' '}
                trước khi đặt (giỏ hàng được giữ nguyên).
              </p>
            ))}

          {form.serverError && <Alert>{form.serverError}</Alert>}
          {problems.length > 0 && (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
            >
              <p className="font-semibold">Các sản phẩm sau cần bạn điều chỉnh:</p>
              <ul className="list-disc space-y-1 pl-5">
                {problems.map((problem) => (
                  <li key={problem.productId}>
                    {problem.reason === 'UNAVAILABLE'
                      ? `${problem.name}: không còn được bán`
                      : problem.reason === 'OUT_OF_STOCK'
                        ? `${problem.name}: đã hết hàng`
                        : `${problem.name}: chỉ còn ${problem.available} (bạn đặt ${problem.requested})`}
                  </li>
                ))}
              </ul>
              <Link to="/gio-hang" className="font-semibold underline">
                Quay lại giỏ hàng
              </Link>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={form.submitting}
            disabled={!cart.canCheckout}
          >
            <IconCheckCircle size={20} />
            Xác nhận đặt hàng
          </Button>
          <p className="text-center text-xs text-slate-500">
            Bằng việc đặt hàng, bạn đồng ý với{' '}
            <Link to="/chinh-sach/doi-tra" className="font-semibold text-brand-600 hover:underline">
              chính sách đổi trả
            </Link>{' '}
            của cửa hàng.
          </p>
        </aside>
      </form>
    </div>
  );
}
