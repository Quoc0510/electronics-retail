/**
 * @feature [F04] Duyệt và tìm sản phẩm - Trang chi tiết sản phẩm (US-13).
 * Bố cục: bộ ảnh phóng to được, khối giá nổi bật kèm cam kết, mô tả và bảng thông số, sản phẩm liên quan,
 * thanh giá dính khi cuộn. Sản phẩm không tồn tại, đã ẩn hoặc thuộc danh mục/thương hiệu bị ẩn đều hiện trang
 * "không tìm thấy" (AC3). Nút "Thêm vào giỏ" sẽ được đặt cạnh khối giá khi làm F05.
 */
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  IconCash,
  IconCheckCircle,
  IconChevronRight,
  IconSearch,
  IconShield,
  IconTruck,
  formatVnd,
  getErrorMessage,
} from '@techstore/shared';
import { api } from '../lib/api.js';
import ProductGallery from '../components/detail/ProductGallery.jsx';
import CompareButton from '../components/compare/CompareButton.jsx'; // [F12]
import StickyPriceBar from '../components/detail/StickyPriceBar.jsx';
import { pushRecent } from '../lib/recentlyViewed.js'; // [F12]
import Price from '../components/Price.jsx';
import ProductCard from '../components/ProductCard.jsx';
import SectionHeader from '../components/SectionHeader.jsx';

const RELATED_COUNT = 4;

// Các cam kết ngắn dưới khối giá, khớp quy tắc nghiệp vụ thật (BR-05, BR-08)
const PERKS = [
  { Icon: IconShield, text: 'Hàng chính hãng 100%, bảo hành 12 tháng' },
  { Icon: IconTruck, text: 'Miễn phí giao hàng cho đơn từ 5.000.000 ₫' },
  { Icon: IconCash, text: 'Thanh toán khi nhận hàng (COD)' },
];

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Đang tải sản phẩm" className="grid gap-10 lg:grid-cols-2">
      <span className="sr-only">Đang tải sản phẩm...</span>
      <div className="skeleton aspect-square rounded-3xl" aria-hidden="true" />
      <div className="space-y-4" aria-hidden="true">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-10 w-3/4 rounded" />
        <div className="skeleton h-4 w-40 rounded" />
        <div className="skeleton h-32 w-full rounded-2xl" />
        <div className="skeleton h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-500">
        <IconSearch size={36} />
      </span>
      <h1 className="text-3xl font-bold text-slate-900">Không tìm thấy sản phẩm</h1>
      <p className="max-w-md text-slate-600">
        Sản phẩm không tồn tại hoặc đã ngừng bán. Bạn có thể xem các sản phẩm khác đang có tại cửa
        hàng.
      </p>
      <Link
        to="/san-pham"
        className="rounded-full bg-gradient-to-r from-brand-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:brightness-110"
      >
        Xem các sản phẩm khác
      </Link>
    </div>
  );
}

// Sản phẩm cùng danh mục (trừ chính nó). Lỗi hoặc không có thì ẩn khối, không ảnh hưởng trang chính
function RelatedProducts({ product }) {
  const { data } = useQuery({
    queryKey: ['products', 'related', product.category.slug],
    queryFn: () =>
      api
        .get('/products', {
          params: { category: product.category.slug, pageSize: RELATED_COUNT + 1 },
        })
        .then((res) => res.data),
  });

  const related = (data?.items ?? [])
    .filter((item) => item.id !== product.id)
    .slice(0, RELATED_COUNT);
  if (related.length === 0) return null;

  return (
    <section aria-labelledby="related-heading">
      <SectionHeader
        id="related-heading"
        title="Sản phẩm liên quan"
        to={`/san-pham?category=${product.category.slug}`}
        linkLabel={`Xem thêm ${product.category.name}`}
      />
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-5">
        {related.map((item) => (
          <li key={item.id} className="flex">
            <ProductCard product={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams();
  const priceRef = useRef(null);

  const {
    data: product,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['products', 'detail', slug],
    queryFn: () => api.get(`/products/${slug}`).then((res) => res.data),
    // Sản phẩm không có thật (404) thì thử lại cũng vô ích
    retry: (failureCount, err) => err.response?.status !== 404 && failureCount < 1,
  });

  // [F12] Ghi nhận vào danh sách "đã xem gần đây" của trang chủ
  useEffect(() => {
    if (product) pushRecent(product);
  }, [product]);

  // Tiêu đề tab trình duyệt theo tên sản phẩm
  useEffect(() => {
    if (product) document.title = `${product.name} - TechStore`;
    return () => {
      document.title = 'TechStore - Thiết bị điện tử chính hãng';
    };
  }, [product]);

  if (isPending) return <DetailSkeleton />;

  if (isError) {
    if (error.response?.status === 404) return <NotFound />;
    return (
      <div className="space-y-3 py-6">
        <Alert>{getErrorMessage(error)}</Alert>
        <Button variant="secondary" loading={isFetching} onClick={() => refetch()}>
          Thử lại
        </Button>
      </div>
    );
  }

  const specs = Object.entries(product.specs ?? {});
  const saving = product.salePrice ? product.price - product.salePrice : 0;

  return (
    <div className="space-y-12 pb-16">
      <nav
        aria-label="Đường dẫn"
        className="flex flex-wrap items-center gap-1 text-sm text-slate-500"
      >
        <Link to="/" className="hover:text-brand-600">
          Trang chủ
        </Link>
        <IconChevronRight size={14} />
        <Link to={`/san-pham?category=${product.category.slug}`} className="hover:text-brand-600">
          {product.category.name}
        </Link>
        <IconChevronRight size={14} />
        <span className="line-clamp-1 font-medium text-slate-700" aria-current="page">
          {product.name}
        </span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* key để bộ ảnh về ảnh đầu khi chuyển sang sản phẩm khác */}
        <div className="lg:sticky lg:top-40 lg:self-start">
          <ProductGallery
            key={product.id}
            images={product.images}
            name={product.name}
            price={product.price}
            salePrice={product.salePrice}
          />
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Link
              to={`/san-pham?brand=${product.brand.slug}`}
              className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-700 hover:bg-brand-100"
            >
              {product.brand.name}
            </Link>
            <h1 className="text-3xl font-bold leading-tight text-slate-900 md:text-4xl">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-slate-500">Mã sản phẩm: {product.sku}</span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  product.inStock
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {product.inStock && <IconCheckCircle size={14} />}
                {product.inStock ? 'Còn hàng' : 'Hết hàng'}
              </span>
            </div>
          </div>

          {/* Khối giá. priceRef để thanh giá dính biết khi nào khối này đã cuộn khuất */}
          <div
            ref={priceRef}
            className="space-y-4 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-card"
          >
            <Price price={product.price} salePrice={product.salePrice} large />
            {saving > 0 && (
              <p className="text-sm font-medium text-emerald-700">
                Bạn tiết kiệm {formatVnd(saving)}
              </p>
            )}
            {/* [F12] Chỗ đặt nút "Thêm vào giỏ" (F05) sẽ nằm cạnh nút so sánh này */}
            <CompareButton product={product} variant="pill" />
            <ul className="space-y-2 border-t border-brand-100 pt-4 text-sm text-slate-700">
              {PERKS.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5">
                  <Icon size={18} className="shrink-0 text-brand-600" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {product.description && (
            <section aria-labelledby="description-heading" className="space-y-2">
              <h2 id="description-heading" className="text-lg font-bold text-slate-900">
                Mô tả
              </h2>
              <p className="whitespace-pre-line leading-relaxed text-slate-700">
                {product.description}
              </p>
            </section>
          )}
          {specs.length > 0 && (
            <section aria-labelledby="specs-heading" className="space-y-3">
              <h2 id="specs-heading" className="text-lg font-bold text-slate-900">
                Thông số kỹ thuật
              </h2>
              <table className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-card">
                <tbody>
                  {specs.map(([name, value]) => (
                    <tr
                      key={name}
                      className="border-b border-slate-100 last:border-0 odd:bg-slate-50/70"
                    >
                      <th
                        scope="row"
                        className="w-2/5 px-5 py-3 text-left font-medium text-slate-500"
                      >
                        {name}
                      </th>
                      <td className="px-5 py-3 font-medium text-slate-900">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>

      <RelatedProducts product={product} />

      <StickyPriceBar anchorRef={priceRef} product={product} />
    </div>
  );
}
