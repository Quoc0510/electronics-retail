/**
 * @feature [F08] Đánh giá - Form viết hoặc sửa đánh giá của mình (US-21 AC2): chọn 1-5 sao (bắt buộc) và bình luận tối đa 500 ký tự.
 * Số sao là nhóm nút radio nên dùng được bằng bàn phím (phím mũi tên) và trình đọc màn hình đọc "n sao".
 * Lỗi từ máy chủ (ví dụ chưa nhận hàng, đã đánh giá rồi) hiện ngay trong form.
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, IconStar, getErrorMessage } from '@techstore/shared';
import { api } from '../../lib/api.js';

export const COMMENT_MAX_LENGTH = 500;

const RATING_LABELS = ['Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tốt'];

function StarInput({ value, onChange, invalid }) {
  return (
    <fieldset aria-describedby={invalid ? 'review-rating-error' : undefined}>
      <legend className="mb-1.5 block text-sm font-medium text-slate-700">Số sao của bạn</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded p-0.5 text-slate-300 transition has-[:checked]:text-amber-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500"
          >
            <input
              type="radio"
              name="review-rating"
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <span className="sr-only">{n} sao</span>
            <IconStar
              size={28}
              strokeWidth={1.5}
              className={`${n <= value ? 'text-amber-400' : 'hover:text-amber-300'} fill-current`}
            />
          </label>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm font-medium text-slate-600">
            {RATING_LABELS[value - 1]}
          </span>
        )}
      </div>
    </fieldset>
  );
}

/**
 * @param {string} slug Sản phẩm được đánh giá
 * @param {object|null} review Đánh giá hiện có (sửa) hoặc null (viết mới)
 * @param {() => void} onDone Gọi sau khi lưu xong
 * @param {() => void} [onCancel] Chỉ có khi đang sửa: hủy và quay lại xem
 */
export default function ReviewForm({ slug, review, onDone, onCancel }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? '');
  const [ratingError, setRatingError] = useState('');

  const save = useMutation({
    mutationFn: (body) =>
      review
        ? api.patch(`/products/${slug}/reviews/mine`, body)
        : api.post(`/products/${slug}/reviews`, body),
    onSuccess: () => {
      // Làm mới danh sách, đánh giá của mình và điểm trên trang chi tiết/thẻ sản phẩm
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onDone();
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (rating < 1) {
      setRatingError('Vui lòng chọn số sao');
      return;
    }
    save.mutate({ rating, comment: comment.trim() });
  };

  const remaining = COMMENT_MAX_LENGTH - comment.length;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={review ? 'Sửa đánh giá' : 'Viết đánh giá'}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
    >
      <StarInput
        value={rating}
        invalid={Boolean(ratingError)}
        onChange={(value) => {
          setRating(value);
          setRatingError('');
        }}
      />
      {ratingError && (
        <p id="review-rating-error" className="text-sm text-rose-600">
          {ratingError}
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="review-comment" className="block text-sm font-medium text-slate-700">
          Bình luận (không bắt buộc)
        </label>
        <textarea
          id="review-comment"
          rows={4}
          maxLength={COMMENT_MAX_LENGTH}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm..."
          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        <p className={`text-right text-xs ${remaining < 50 ? 'text-rose-600' : 'text-slate-500'}`}>
          Còn {remaining} ký tự
        </p>
      </div>

      {save.isError && <Alert>{getErrorMessage(save.error)}</Alert>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={save.isPending}>
          {review ? 'Lưu thay đổi' : 'Gửi đánh giá'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={save.isPending}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  );
}
