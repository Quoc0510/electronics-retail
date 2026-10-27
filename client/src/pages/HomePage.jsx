/**
 * @feature [F04][F12] Duyệt và tìm sản phẩm - Trang chủ: banner, cam kết, danh mục, banner đôi, khuyến mãi,
 * thương hiệu, sản phẩm mới, số liệu cửa hàng và sản phẩm đã xem (US-10).
 * Mỗi khối tải dữ liệu độc lập: một khối lỗi hoặc rỗng chỉ ẩn khối đó, không làm hỏng các khối còn lại.
 * Các khối hiện dần khi cuộn tới (Reveal).
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useBrands, useCategories } from '../hooks/useCatalog.js';
import BrandStrip from '../components/home/BrandStrip.jsx';
import CategoryTiles from '../components/home/CategoryTiles.jsx';
import HeroSlider from '../components/home/HeroSlider.jsx';
import PromoBanners from '../components/home/PromoBanners.jsx';
import RecentlyViewed from '../components/home/RecentlyViewed.jsx';
import StatsBand from '../components/home/StatsBand.jsx';
import TrustStrip from '../components/home/TrustStrip.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import ProductGrid from '../components/ProductGrid.jsx';
import SectionHeader from '../components/SectionHeader.jsx';

const NEW_PRODUCTS_COUNT = 8;
const SALE_PRODUCTS_COUNT = 4;

const fetchProducts = (params) => api.get('/products', { params }).then((res) => res.data);

export default function HomePage() {
  const categories = useCategories();
  const brands = useBrands();

  // Khối "Đang khuyến mãi": nếu chưa có sản phẩm giảm giá hoặc lỗi thì ẩn cả khối (quiet)
  const onSale = useQuery({
    queryKey: ['products', 'home-sale'],
    queryFn: () => fetchProducts({ onSale: 'true', sort: 'newest', pageSize: SALE_PRODUCTS_COUNT }),
  });

  // Sản phẩm mới nhất = danh sách sắp theo mới nhất, lấy trang đầu
  const newest = useQuery({
    queryKey: ['products', 'home-newest'],
    queryFn: () => fetchProducts({ sort: 'newest', pageSize: NEW_PRODUCTS_COUNT }),
  });

  return (
    <div className="space-y-14">
      {/* Tiêu đề chính của trang (h1) chỉ dành cho trình đọc màn hình và công cụ tìm kiếm; banner dùng h2 */}
      <h1 className="sr-only">Thiết bị điện tử chính hãng</h1>

      <HeroSlider />
      <TrustStrip />

      {/* Danh mục: lỗi hoặc rỗng thì ẩn cả khối, trang vẫn dùng được */}
      {categories.data?.length > 0 && (
        <Reveal>
          <section aria-labelledby="categories-heading">
            <SectionHeader
              id="categories-heading"
              title="Danh mục"
              subtitle="Chọn nhóm sản phẩm bạn quan tâm"
            />
            <CategoryTiles categories={categories.data} />
          </section>
        </Reveal>
      )}

      {categories.data && <PromoBanners categories={categories.data} />}

      {onSale.data?.items.length > 0 && (
        <Reveal>
          <section aria-labelledby="sale-heading">
            <SectionHeader
              id="sale-heading"
              title="Đang khuyến mãi"
              subtitle="Giá tốt, số lượng có hạn"
              to="/san-pham?onSale=true"
            />
            <ProductGrid query={onSale} skeletonCount={SALE_PRODUCTS_COUNT} quiet />
          </section>
        </Reveal>
      )}

      {brands.data?.length > 0 && (
        <Reveal>
          <section aria-labelledby="brands-heading">
            <SectionHeader
              id="brands-heading"
              title="Thương hiệu nổi bật"
              subtitle="Sản phẩm chính hãng từ các hãng uy tín"
            />
            <BrandStrip brands={brands.data} />
          </section>
        </Reveal>
      )}

      <section aria-labelledby="newest-heading">
        <SectionHeader
          id="newest-heading"
          title="Sản phẩm mới"
          subtitle="Vừa lên kệ tại TechStore"
          to="/san-pham"
        />
        <ProductGrid
          query={newest}
          emptyMessage="Cửa hàng chưa có sản phẩm nào. Bạn quay lại sau nhé!"
        />
      </section>

      {categories.data && brands.data && (
        <Reveal>
          <StatsBand categories={categories.data} brands={brands.data} />
        </Reveal>
      )}

      <RecentlyViewed />
    </div>
  );
}
