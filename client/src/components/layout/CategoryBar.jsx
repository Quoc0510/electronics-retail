/**
 * @feature [F04] Thanh danh mục dưới thanh đầu trang: lối tắt tới từng danh mục, cuộn ngang được trên điện thoại (US-10, US-11).
 * Mục đang xem được tô sáng theo URL. Nếu API danh mục lỗi thì chỉ còn các lối tắt cố định, trang vẫn dùng được.
 */
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { IconGrid, IconTag } from '@techstore/shared';
import { useCategories } from '../../hooks/useCatalog.js';
import { categoryIcon } from '../../lib/categoryIcons.js';

const itemClass = (active) =>
  `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
    active ? 'bg-white text-brand-700' : 'text-slate-300 hover:bg-white/10 hover:text-white'
  }`;

export default function CategoryBar() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onList = pathname === '/san-pham';
  const activeCategory = onList ? params.get('category') : null;
  const onSale = onList && params.get('onSale') === 'true';

  const { data: categories = [] } = useCategories();

  return (
    <nav aria-label="Danh mục sản phẩm" className="border-t border-white/10">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li>
          <Link
            to="/san-pham"
            className={itemClass(onList && !activeCategory && !onSale)}
            aria-current={onList && !activeCategory && !onSale ? 'page' : undefined}
          >
            <IconGrid size={16} />
            Tất cả
          </Link>
        </li>
        <li>
          <Link
            to="/san-pham?onSale=true"
            className={itemClass(onSale)}
            aria-current={onSale ? 'page' : undefined}
          >
            <IconTag size={16} />
            Khuyến mãi
          </Link>
        </li>
        {categories.map((category) => {
          const Icon = categoryIcon(category.slug);
          const active = activeCategory === category.slug;
          return (
            <li key={category.id}>
              <Link
                to={`/san-pham?category=${category.slug}`}
                className={itemClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={16} />
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
