/**
 * @feature [F04] Duyệt và tìm sản phẩm - Ô tìm kiếm trên thanh đầu trang (US-12).
 * Gửi từ khóa thì chuyển tới /san-pham?search=...; từ khóa rỗng thì xem toàn bộ sản phẩm (AC3).
 * Khi đang ở trang danh sách, ô luôn hiện từ khóa đang tìm theo URL (kể cả khi bấm "Xóa bộ lọc" hay nút Back).
 * Kiểu viên thuốc trên nền tối, nút tìm (biểu tượng kính lúp) nằm trong ô.
 */
import { useState } from 'react';
import { createSearchParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { IconSearch } from '@techstore/shared';

function SearchForm({ initialKeyword }) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState(initialKeyword);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    navigate({
      pathname: '/san-pham',
      search: trimmed ? `?${createSearchParams({ search: trimmed })}` : '',
    });
  };

  return (
    <form
      role="search"
      onSubmit={handleSubmit}
      className="group flex w-full items-center rounded-full border border-white/15 bg-white/10 pl-4 pr-1 transition focus-within:border-brand-400 focus-within:bg-white/15 focus-within:ring-4 focus-within:ring-brand-500/25"
    >
      <input
        type="search"
        aria-label="Tìm sản phẩm"
        placeholder="Bạn tìm điện thoại, laptop, phụ kiện..."
        value={keyword}
        maxLength={100}
        onChange={(event) => setKeyword(event.target.value)}
        className="w-full bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="submit"
        aria-label="Tìm"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white transition hover:brightness-110"
      >
        <IconSearch size={18} />
      </button>
    </form>
  );
}

export default function SearchBox() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const urlKeyword = pathname === '/san-pham' ? (params.get('search') ?? '') : '';

  // key = từ khóa trên URL: khi URL đổi thì form được tạo lại và ô nhập tự khớp với URL
  return <SearchForm key={urlKeyword} initialKeyword={urlKeyword} />;
}
