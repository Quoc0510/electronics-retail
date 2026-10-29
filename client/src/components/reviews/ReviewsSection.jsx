/**
 * @feature [F08] Đánh giá - Khối đánh giá ở trang chi tiết sản phẩm (US-21).
 * Gồm điểm trung bình và phân bố theo sao, danh sách đánh giá đang hiện (phân trang), và khu vực viết đánh giá tùy người xem:
 *  - chưa đăng nhập: mời đăng nhập;
 *  - đã đăng nhập nhưng chưa nhận hàng: nói rõ điều kiện (BR-13);
 *  - đã nhận hàng, chưa đánh giá: form viết mới; đã đánh giá: xem và sửa đánh giá của mình.
 * Đánh giá của mình đang bị quản trị viên ẩn vẫn hiện cho chính mình kèm ghi chú, nhưng người khác không thấy.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Button, formatDateTime, getErrorMessage } from '@techstore/shared';
import { api } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ReviewForm from './ReviewForm.jsx';
import StarRating, { formatRating } from './StarRating.jsx';

const PAGE_SIZE = 5;

function Summary({ summary }) {
  const { average, count, breakdown } = summary;
  return (
    <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="text-center">
        <p className="text-4xl font-bold text-slate-900">
          {average === null ? '–' : formatRating(average)}
        </p>
        {average !== null && <StarRating value={average} size={18} />}
        <p className="mt-1 text-sm text-slate-500">{count} đánh giá</p>
      </div>
      <ul className="min-w-48 flex-1 space-y-1.5" aria-label="Số đánh giá theo từng mức sao">
        {[5, 4, 3, 2, 1].map((star) => (
          <li key={star} className="flex items-center gap-2 text-sm">
            <span className="w-10 shrink-0 text-slate-600">{star} sao</span>
            <span
              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-amber-400"
                style={{ width: count > 0 ? `${(breakdown[star] / count) * 100}%` : '0%' }}
              />
            </span>
            <span className="w-6 shrink-0 text-right tabular-nums text-slate-500">
              {breakdown[star]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MyReview({ review, onEdit }) {
  return (
    <div className="space-y-2 rounded-2xl border border-brand-100 bg-brand-50/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Đánh giá của bạn</h3>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          Sửa đánh giá
        </Button>
      </div>
      <StarRating value={review.rating} />
      {review.comment && <p className="whitespace-pre-line text-slate-700">{review.comment}</p>}
      {review.isHidden && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Đánh giá này đang bị quản trị viên ẩn nên người khác không nhìn thấy.
        </p>
      )}
    </div>
  );
}

function WriteArea({ slug }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  const [editing, setEditing] = useState(false);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['reviews', 'mine', slug, user?.id],
    queryFn: () => api.get(`/products/${slug}/reviews/mine`).then((res) => res.data),
    enabled: Boolean(user),
  });

  if (initializing) return null;

  if (!user) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
        <Link
          to="/dang-nhap"
          state={{ from: location }}
          className="font-semibold text-brand-600 hover:underline"
        >
          Đăng nhập
        </Link>{' '}
        để viết đánh giá sau khi nhận hàng.
      </p>
    );
  }

  if (isPending) return null;
  if (isError) return <Alert>{getErrorMessage(error)}</Alert>;

  if (data.review && !editing)
    return <MyReview review={data.review} onEdit={() => setEditing(true)} />;

  if (data.review || data.canReview) {
    return (
      <ReviewForm
        slug={slug}
        review={data.review}
        onDone={() => setEditing(false)}
        onCancel={data.review ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
      Chỉ khách đã nhận hàng (đơn hàng hoàn thành) mới đánh giá được sản phẩm này.
    </p>
  );
}

export default function ReviewsSection({ product }) {
  const [page, setPage] = useState(1);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['reviews', product.slug, page],
    queryFn: () =>
      api
        .get(`/products/${product.slug}/reviews`, { params: { page, pageSize: PAGE_SIZE } })
        .then((res) => res.data),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section id="danh-gia" aria-labelledby="reviews-heading" className="scroll-mt-40 space-y-5">
      <h2 id="reviews-heading" className="text-2xl font-bold text-slate-900">
        Đánh giá sản phẩm
      </h2>

      {isPending && (
        <p role="status" className="text-slate-500">
          Đang tải đánh giá...
        </p>
      )}
      {isError && !data && (
        <div className="space-y-3">
          <Alert>{getErrorMessage(error)}</Alert>
          <Button variant="secondary" loading={isFetching} onClick={() => refetch()}>
            Thử lại
          </Button>
        </div>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-4">
            <Summary summary={data.summary} />
            <WriteArea slug={product.slug} />
          </div>

          <div className="space-y-4">
            {data.items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                Chưa có đánh giá nào. Hãy là người đầu tiên đánh giá sản phẩm này.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.items.map((review) => (
                  <li
                    key={review.id}
                    className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold text-slate-900">{review.authorName}</span>
                      <StarRating value={review.rating} size={14} />
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Đã mua hàng
                      </span>
                    </div>
                    {review.comment && (
                      <p className="whitespace-pre-line text-slate-700">{review.comment}</p>
                    )}
                    <p className="text-xs text-slate-500">{formatDateTime(review.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}

            {totalPages > 1 && (
              <nav
                aria-label="Phân trang đánh giá"
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-slate-600">
                  Trang {data.page}/{totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              </nav>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
