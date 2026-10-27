/**
 * @feature [F01][F04] Khung chung của mọi trang: thanh đầu trang tối cố định khi cuộn (logo, tìm kiếm, tài khoản),
 * thanh danh mục, nội dung và chân trang.
 * Trên điện thoại ô tìm kiếm xuống dòng riêng (order) để không bị chật.
 */
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { IconCompare, Logo, ThemeToggle } from '@techstore/shared';
import { useCompare } from '../context/CompareContext.jsx'; // [F12]
import CompareBar from './compare/CompareBar.jsx'; // [F12]
import AccountMenu from './layout/AccountMenu.jsx';
import BackToTop from './layout/BackToTop.jsx'; // [F12]
import CategoryBar from './layout/CategoryBar.jsx';
import Footer from './layout/Footer.jsx';
import UtilityBar from './layout/UtilityBar.jsx'; // [F12]
import SearchBox from './SearchBox.jsx';

function Header() {
  const { items } = useCompare();
  return (
    <header className="surface-dark sticky top-0 z-40 bg-ink-900/95 text-white shadow-lg backdrop-blur">
      <UtilityBar />
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-3 px-3 py-3 sm:gap-x-6 sm:px-4">
        <Link to="/" aria-label="TechStore - Trang chủ" className="shrink-0">
          <Logo />
        </Link>

        {/* Màn hình nhỏ: ô tìm kiếm xuống dòng cuối và chiếm hết chiều ngang */}
        <div className="order-last w-full md:order-none md:max-w-xl md:flex-1">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link
            to="/so-sanh"
            aria-label={`So sánh sản phẩm (${items.length})`}
            // Điện thoại hẹp: ẩn biểu tượng này để đầu trang không bị xuống dòng (đã có thanh so sánh ở đáy màn hình)
            className="relative hidden h-10 w-10 items-center justify-center rounded-full text-slate-200 transition hover:bg-white/10 hover:text-white sm:flex"
          >
            <IconCompare size={20} />
            {items.length > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[0.65rem] font-bold text-ink-950"
              >
                {items.length}
              </span>
            )}
          </Link>
          <ThemeToggle className="!h-9 !w-9 text-slate-200 hover:bg-white/10 hover:text-white sm:!h-10 sm:!w-10" />
          <AccountMenu />
        </div>
      </div>
      <CategoryBar />
    </header>
  );
}

// Chuyển trang thì cuộn về đầu (nếu không, bấm sang trang 2 sẽ giữ nguyên vị trí cuộn ở cuối trang)
function ScrollToTop() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [pathname, search]);
  return null;
}

export default function Layout() {
  const { items } = useCompare();
  return (
    // Chừa chỗ cuối trang cho thanh so sánh cố định để nó không che chân trang
    <div className={`flex min-h-screen flex-col ${items.length > 0 ? 'pb-[4.5rem]' : ''}`}>
      <ScrollToTop />
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <Footer />
      <CompareBar />
      <BackToTop />
    </div>
  );
}
