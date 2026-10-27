/**
 * @feature [F04] Duyệt và tìm sản phẩm - Lưới sản phẩm kèm các trạng thái: đang tải (khung chờ), lỗi, rỗng (US-10 AC2, AC3).
 * Dùng chung cho trang chủ và trang danh sách; thông báo "rỗng" do nơi dùng truyền vào.
 * quiet = true: dành cho khối phụ (ví dụ "Đang khuyến mãi"), khi rỗng hoặc lỗi thì ẩn cả khối thay vì báo lỗi.
 */
import { Alert, Button, getErrorMessage } from '@techstore/shared';
import ProductCard from './ProductCard.jsx';

const GRID = 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-5 xl:grid-cols-4';

// Khung chờ có hình dạng giống thẻ thật nên trang không "nhảy" khi dữ liệu về
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div role="status" aria-label="Đang tải sản phẩm">
      <span className="sr-only">Đang tải sản phẩm...</span>
      <ul className={GRID} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="skeleton aspect-square" />
            <div className="space-y-2 p-4">
              <div className="skeleton h-3 w-1/3 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
              <div className="skeleton mt-3 h-6 w-1/2 rounded" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProductGrid({ query, emptyMessage, skeletonCount = 8, quiet = false }) {
  const { data, isPending, isError, error, refetch, isFetching } = query;

  if (isPending) return <ProductGridSkeleton count={skeletonCount} />;

  if (quiet && (isError || data.items.length === 0)) return null;

  // US-10 AC3: lỗi mạng hiện thông báo rõ ràng kèm nút thử lại
  if (isError) {
    return (
      <div className="space-y-3 py-6">
        <Alert>{getErrorMessage(error)}</Alert>
        <Button variant="secondary" loading={isFetching} onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  if (data.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className={GRID}>
      {data.items.map((product, index) => (
        <li
          key={product.id}
          className="flex animate-fade-up"
          // Các thẻ hiện lần lượt, cách nhau 40ms (tối đa 8 thẻ đầu) tạo cảm giác mượt
          style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
        >
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
