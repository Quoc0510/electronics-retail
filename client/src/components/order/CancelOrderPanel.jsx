/**
 * @feature [F07] Quản lý đơn hàng - Khung hủy đơn của khách (US-18): chọn lý do rồi xác nhận.
 * Chỉ dùng khi đơn đang chờ xác nhận (BR-06); đã được xác nhận thì khách liên hệ cửa hàng. Bắt buộc có lý do (AC3),
 * chọn "Lý do khác" thì phải tự nhập. Đây là thao tác khó hoàn tác nên có bước xác nhận riêng và nút "Giữ đơn hàng".
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, FormField, getErrorMessage } from '@techstore/shared';

export const CANCEL_REASONS = [
  'Muốn thay đổi địa chỉ giao hàng',
  'Muốn thay đổi sản phẩm hoặc số lượng',
  'Đặt nhầm sản phẩm',
  'Tìm được giá tốt hơn ở nơi khác',
];
const OTHER = 'Lý do khác';
const MIN_LENGTH = 3;
const MAX_LENGTH = 200;

export default function CancelOrderPanel({ onCancel }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(CANCEL_REASONS[0]);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reason = choice === OTHER ? custom.trim() : choice;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (reason.length < MIN_LENGTH) {
      setError(`Vui lòng nhập lý do hủy đơn (ít nhất ${MIN_LENGTH} ký tự)`);
      return;
    }
    if (reason.length > MAX_LENGTH) {
      setError(`Lý do hủy đơn tối đa ${MAX_LENGTH} ký tự`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onCancel(reason);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <section
        aria-label="Hủy đơn hàng"
        className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-card"
      >
        <p className="text-slate-600">
          Đơn hàng đang chờ xác nhận nên bạn có thể hủy. Sau khi cửa hàng xác nhận, bạn cần{' '}
          <Link to="/lien-he" className="font-semibold text-brand-600 hover:underline">
            liên hệ cửa hàng
          </Link>{' '}
          để hủy.
        </p>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Hủy đơn hàng
        </Button>
      </section>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Hủy đơn hàng"
      noValidate
      className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm"
    >
      <h2 className="text-lg font-bold text-rose-800">Hủy đơn hàng</h2>
      <p className="text-rose-800">
        Bạn có chắc muốn hủy đơn này? Sản phẩm sẽ được trả lại kho và không thể khôi phục đơn.
      </p>

      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold text-slate-800">Lý do hủy đơn</legend>
        {[...CANCEL_REASONS, OTHER].map((item) => (
          <label key={item} className="flex cursor-pointer items-center gap-2 text-slate-800">
            <input
              type="radio"
              name="cancel-reason"
              checked={choice === item}
              onChange={() => {
                setChoice(item);
                setError('');
              }}
            />
            {item}
          </label>
        ))}
      </fieldset>

      {choice === OTHER && (
        <FormField
          label="Nhập lý do"
          value={custom}
          onChange={(event) => {
            setCustom(event.target.value);
            setError('');
          }}
        />
      )}

      {error && <Alert>{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" loading={submitting}>
          Xác nhận hủy đơn
        </Button>
        <Button variant="secondary" disabled={submitting} onClick={() => setOpen(false)}>
          Giữ đơn hàng
        </Button>
      </div>
    </form>
  );
}
