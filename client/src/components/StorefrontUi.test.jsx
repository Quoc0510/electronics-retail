/**
 * @feature [F04] Kiểm thử các thành phần giao diện của cửa hàng sau đợt thiết kế lại:
 * slider trang chủ, menu tài khoản, thanh danh mục, bộ lọc, ngăn kéo lọc, bộ ảnh sản phẩm, thanh giá dính, khung chờ.
 */
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { tokenStorage } from '../lib/api.js';
import { CompareProvider } from '../context/CompareContext.jsx';
import { customer, mockServer, renderApp, session, storefrontApi } from '../test/utils.jsx';
import HeroSlider from './home/HeroSlider.jsx';
import ActiveFilters from './list/ActiveFilters.jsx';
import FilterDrawer from './list/FilterDrawer.jsx';
import FilterPanel from './list/FilterPanel.jsx';
import ProductGallery from './detail/ProductGallery.jsx';
import StickyPriceBar from './detail/StickyPriceBar.jsx';

const inRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

// ---------------------------------------------------------------------------
// Slider trang chủ (US-10)
// ---------------------------------------------------------------------------
describe('HeroSlider', () => {
  afterEach(() => vi.useRealTimers());

  const slideTitle = (name) => screen.getByRole('heading', { name, level: 2 });

  it('bắt đầu ở slide 1; nút Sau/Trước và các chấm chuyển slide (xoay vòng)', async () => {
    inRouter(<HeroSlider />);
    expect(slideTitle(/Flagship mới nhất/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '1 trên 3' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Slide sau' }));
    expect(slideTitle(/Ưu đãi hấp dẫn/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Đến slide 3' }));
    expect(slideTitle(/Laptop mạnh mẽ/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đến slide 3' })).toHaveAttribute(
      'aria-current',
      'true',
    );

    // Từ slide cuối bấm Sau thì quay về slide đầu; từ slide đầu bấm Trước thì sang slide cuối
    await userEvent.click(screen.getByRole('button', { name: 'Slide sau' }));
    expect(slideTitle(/Flagship mới nhất/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Slide trước' }));
    expect(slideTitle(/Laptop mạnh mẽ/)).toBeInTheDocument();
  });

  it('chỉ liên kết của slide đang hiện nằm trong cây truy cập (không focus nhầm slide ẩn)', async () => {
    inRouter(<HeroSlider />);
    expect(screen.getByRole('link', { name: /Xem điện thoại/ })).toHaveAttribute(
      'href',
      '/san-pham?category=dien-thoai',
    );
    expect(screen.queryByRole('link', { name: /Xem khuyến mãi/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Slide sau' }));
    expect(screen.getByRole('link', { name: /Xem khuyến mãi/ })).toHaveAttribute(
      'href',
      '/san-pham?onSale=true',
    );
  });

  it('tự chuyển slide sau 6 giây và tạm dừng khi rê chuột vào banner', () => {
    vi.useFakeTimers();
    inRouter(<HeroSlider />);
    const banner = screen.getByRole('region', { name: 'Banner nổi bật' });

    act(() => vi.advanceTimersByTime(6000));
    expect(slideTitle(/Ưu đãi hấp dẫn/)).toBeInTheDocument();

    // Đang rê chuột: dù chờ lâu vẫn đứng yên
    fireEvent.mouseEnter(banner);
    act(() => vi.advanceTimersByTime(30000));
    expect(slideTitle(/Ưu đãi hấp dẫn/)).toBeInTheDocument();

    // Rời chuột: chạy tiếp
    fireEvent.mouseLeave(banner);
    act(() => vi.advanceTimersByTime(6000));
    expect(slideTitle(/Laptop mạnh mẽ/)).toBeInTheDocument();
  });

  it('tạm dừng khi đặt focus vào banner (bàn phím) và chạy lại khi rời focus', () => {
    vi.useFakeTimers();
    inRouter(<HeroSlider />);
    const button = screen.getByRole('button', { name: 'Đến slide 2' });

    act(() => button.focus());
    act(() => vi.advanceTimersByTime(20000));
    expect(slideTitle(/Flagship mới nhất/)).toBeInTheDocument();

    act(() => button.blur());
    act(() => vi.advanceTimersByTime(6000));
    expect(slideTitle(/Ưu đãi hấp dẫn/)).toBeInTheDocument();
  });

  it('bấm tay thì đồng hồ tự chuyển được đặt lại từ đầu', () => {
    vi.useFakeTimers();
    inRouter(<HeroSlider />);

    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole('button', { name: 'Slide sau' }));
    // Mới qua 1 giây kể từ lúc bấm nên chưa được tự chuyển tiếp
    act(() => vi.advanceTimersByTime(1000));
    expect(slideTitle(/Ưu đãi hấp dẫn/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(slideTitle(/Laptop mạnh mẽ/)).toBeInTheDocument();
  });

  it('người dùng bật "giảm chuyển động" thì không tự chạy', () => {
    vi.useFakeTimers();
    const original = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    try {
      inRouter(<HeroSlider />);
      act(() => vi.advanceTimersByTime(60000));
      expect(slideTitle(/Flagship mới nhất/)).toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Menu tài khoản và thanh danh mục (nằm trong Layout)
// ---------------------------------------------------------------------------
describe('Menu tài khoản trên thanh đầu trang', () => {
  const loggedIn = () => {
    tokenStorage.setTokens(session);
    mockServer({ ...storefrontApi, 'GET /users/me': [200, customer] });
    renderApp('/');
    return screen.findByRole('button', { name: /Xin chào, Khách A/ });
  };

  it('chưa đăng nhập: hiện Đăng nhập và Đăng ký', async () => {
    mockServer(storefrontApi);
    renderApp('/');

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute(
      'href',
      '/dang-nhap',
    );
    expect(within(header).getByRole('link', { name: 'Đăng ký' })).toHaveAttribute(
      'href',
      '/dang-ky',
    );
  });

  it('đã đăng nhập: bấm mở menu, bấm lại thì đóng; có email và liên kết tài khoản', async () => {
    const trigger = await loggedIn();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toHaveTextContent('khach@example.com');
    expect(within(menu).getByRole('menuitem', { name: 'Tài khoản của tôi' })).toHaveAttribute(
      'href',
      '/tai-khoan',
    );

    await userEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('nhấn Esc hoặc bấm ra ngoài thì đóng menu', async () => {
    const trigger = await loggedIn();

    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await userEvent.click(trigger);
    await userEvent.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});

describe('Thanh danh mục', () => {
  const categories = [
    { id: 1, name: 'Laptop', slug: 'laptop', productCount: 2 },
    { id: 2, name: 'Điện thoại', slug: 'dien-thoai', productCount: 3 },
  ];
  const open = async (route) => {
    mockServer({
      ...storefrontApi,
      'GET /categories': [200, categories],
    });
    renderApp(route);
    const nav = screen.getByRole('navigation', { name: 'Danh mục sản phẩm' });
    await within(nav).findByRole('link', { name: 'Laptop' });
    return nav;
  };

  it('tô sáng danh mục đang xem theo URL', async () => {
    const nav = await open('/san-pham?category=laptop');

    expect(within(nav).getByRole('link', { name: 'Laptop' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Tất cả' })).not.toHaveAttribute('aria-current');
  });

  it('mục Khuyến mãi sáng khi đang lọc khuyến mãi; Tất cả sáng khi không lọc gì', async () => {
    const sale = await open('/san-pham?onSale=true');
    expect(within(sale).getByRole('link', { name: 'Khuyến mãi' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sale).getByRole('link', { name: 'Tất cả' })).not.toHaveAttribute('aria-current');
  });

  it('không mục nào sáng ngoài trang danh sách (ví dụ ở trang chủ)', async () => {
    const nav = await open('/');

    expect(within(nav).queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
  });
});

describe('Chân trang', () => {
  it('có lối tắt mua sắm và cam kết dịch vụ', async () => {
    mockServer(storefrontApi);
    renderApp('/');

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Sản phẩm khuyến mãi' })).toHaveAttribute(
      'href',
      '/san-pham?onSale=true',
    );
    expect(footer).toHaveTextContent('5.000.000');
  });
});

// ---------------------------------------------------------------------------
// Bộ lọc (US-11)
// ---------------------------------------------------------------------------
describe('FilterPanel', () => {
  const categories = [{ id: 1, name: 'Laptop', slug: 'laptop', productCount: 4 }];
  const brands = [{ id: 1, name: 'Dell', slug: 'dell', productCount: 2 }];
  const emptyFilters = {
    search: '',
    category: '',
    brand: '',
    minPrice: '',
    maxPrice: '',
    onSale: false,
  };
  const setup = (filters = {}) => {
    const onChange = vi.fn();
    render(
      <FilterPanel
        filters={{ ...emptyFilters, ...filters }}
        categories={categories}
        brands={brands}
        onChange={onChange}
      />,
    );
    return onChange;
  };

  it('chọn danh mục/thương hiệu báo thay đổi; bấm lại mục đang chọn thì bỏ chọn', async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole('button', { name: /^Laptop/ }));
    expect(onChange).toHaveBeenLastCalledWith({ category: 'laptop' });
    await userEvent.click(screen.getByRole('button', { name: /^Dell/ }));
    expect(onChange).toHaveBeenLastCalledWith({ brand: 'dell' });

    const again = setup({ category: 'laptop', brand: 'dell' });
    await userEvent.click(screen.getAllByRole('button', { name: /^Laptop/ }).at(-1));
    expect(again).toHaveBeenLastCalledWith({ category: '' });
  });

  it('đánh dấu aria-pressed đúng mục đang lọc', () => {
    setup({ category: 'laptop' });

    expect(screen.getByRole('button', { name: /^Laptop/, pressed: true })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tất cả danh mục', pressed: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tất cả thương hiệu', pressed: true }),
    ).toBeInTheDocument();
  });

  it('mức giá chọn nhanh: chọn đặt cả min và max; bấm lại thì bỏ', async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Dưới 5 triệu' }));
    expect(onChange).toHaveBeenLastCalledWith({ minPrice: '', maxPrice: '5000000' });
    await userEvent.click(screen.getByRole('button', { name: 'Trên 30 triệu' }));
    expect(onChange).toHaveBeenLastCalledWith({ minPrice: '30000000', maxPrice: '' });

    const again = setup({ minPrice: '5000000', maxPrice: '10000000' });
    const active = screen.getAllByRole('button', { name: '5 - 10 triệu' }).at(-1);
    expect(active).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(active);
    expect(again).toHaveBeenLastCalledWith({ minPrice: '', maxPrice: '' });
  });

  it('ô nhập giá tự chọn hiện giá trị hiện tại và áp dụng khi hợp lệ', async () => {
    const onChange = setup({ minPrice: '1000000' });
    expect(screen.getByLabelText('Giá từ (đồng)')).toHaveValue('1000000');

    await userEvent.type(screen.getByLabelText('Giá đến (đồng)'), '2000000');
    await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

    expect(onChange).toHaveBeenLastCalledWith({ minPrice: '1000000', maxPrice: '2000000' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hộp chọn khuyến mãi gửi onSale=true khi tích và rỗng khi bỏ tích', async () => {
    const onChange = setup();
    await userEvent.click(screen.getByLabelText('Chỉ sản phẩm đang khuyến mãi'));
    expect(onChange).toHaveBeenLastCalledWith({ onSale: 'true' });

    const again = setup({ onSale: true });
    const checkbox = screen.getAllByLabelText('Chỉ sản phẩm đang khuyến mãi').at(-1);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(again).toHaveBeenLastCalledWith({ onSale: '' });
  });
});

describe('ActiveFilters', () => {
  const base = { search: '', category: '', brand: '', minPrice: '', maxPrice: '', onSale: false };
  const setup = (filters) => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <ActiveFilters
        filters={{ ...base, ...filters }}
        categoryName="Laptop"
        brandName="Dell"
        onChange={onChange}
        onClear={onClear}
      />,
    );
    return { onChange, onClear };
  };

  it('không có bộ lọc nào thì không hiện gì', () => {
    setup({});
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('mỗi bộ lọc là một chip; bấm chip bỏ đúng bộ lọc đó', async () => {
    const { onChange } = setup({
      search: 'xps',
      category: 'laptop',
      brand: 'dell',
      minPrice: '5000000',
      maxPrice: '10000000',
      onSale: true,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Từ khóa: "xps"' }));
    expect(onChange).toHaveBeenLastCalledWith({ search: '' });
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Laptop' }));
    expect(onChange).toHaveBeenLastCalledWith({ category: '' });
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Dell' }));
    expect(onChange).toHaveBeenLastCalledWith({ brand: '' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Bỏ lọc 5.000.000 ₫ - 10.000.000 ₫' }),
    );
    expect(onChange).toHaveBeenLastCalledWith({ minPrice: '', maxPrice: '' });
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Đang khuyến mãi' }));
    expect(onChange).toHaveBeenLastCalledWith({ onSale: '' });
  });

  it('mô tả khoảng giá một phía bằng "Từ" / "Đến"', () => {
    setup({ minPrice: '5000000' });
    expect(screen.getByRole('button', { name: 'Bỏ lọc Từ 5.000.000 ₫' })).toBeInTheDocument();
  });

  it('nút Xóa tất cả bộ lọc gọi onClear', async () => {
    const { onClear } = setup({ onSale: true });
    await userEvent.click(screen.getByRole('button', { name: 'Xóa tất cả bộ lọc' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('FilterDrawer', () => {
  // Bọc để có nút mở thật, kiểm tra được việc trả focus về nút mở
  function Harness({ total = 5 }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Mở bộ lọc
        </button>
        <FilterDrawer open={open} onClose={() => setOpen(false)} total={total}>
          <p>Nội dung bộ lọc</p>
        </FilterDrawer>
      </>
    );
  }

  it('đóng thì không hiện; mở ra là hộp thoại có nhãn, focus vào nút đóng, khóa cuộn trang', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc' }));

    const dialog = screen.getByRole('dialog', { name: 'Bộ lọc sản phẩm' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Nội dung bộ lọc')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đóng bộ lọc' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('nút đóng, nhấn Esc hoặc nút "Xem n sản phẩm" đều đóng; trả focus và mở khóa cuộn', async () => {
    render(<Harness total={7} />);
    const opener = screen.getByRole('button', { name: 'Mở bộ lọc' });

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Đóng bộ lọc' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(document.body.style.overflow).toBe('');

    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Xem 7 sản phẩm' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('không có kết quả thì nút cuối ngăn kéo chỉ ghi "Đóng"', async () => {
    render(<Harness total={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Mở bộ lọc' }));

    expect(screen.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Chi tiết sản phẩm (US-13)
// ---------------------------------------------------------------------------
describe('ProductGallery', () => {
  const images = [
    { id: 1, url: '/uploads/a.png' },
    { id: 2, url: '/uploads/b.png' },
  ];

  it('rê chuột thì phóng to quanh vị trí chuột; rời chuột thì về bình thường', () => {
    render(<ProductGallery images={images} name="iPhone 15" price={20000000} salePrice={null} />);
    const img = screen.getByRole('img', { name: 'iPhone 15' });
    const frame = img.parentElement;
    frame.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 200 });

    expect(img.style.transform).toBe('scale(1)');
    fireEvent.mouseMove(frame, { clientX: 50, clientY: 150 });
    expect(img.style.transform).toBe('scale(2)');
    expect(img.style.transformOrigin).toBe('25% 75%');

    fireEvent.mouseLeave(frame);
    expect(img.style.transform).toBe('scale(1)');
  });

  it('hiện nhãn giảm giá khi có khuyến mãi, không hiện khi không có', () => {
    const { rerender } = render(
      <ProductGallery images={images} name="iPhone 15" price={20000000} salePrice={18000000} />,
    );
    expect(screen.getByText('-10%')).toBeInTheDocument();

    rerender(<ProductGallery images={images} name="iPhone 15" price={20000000} salePrice={null} />);
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });

  it('ảnh nhỏ đang chọn có aria-current; chọn ảnh khác thì ảnh lớn đổi', async () => {
    render(<ProductGallery images={images} name="iPhone 15" price={1} salePrice={null} />);

    expect(screen.getByRole('button', { name: 'Xem ảnh 1' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Xem ảnh 2' }));
    expect(screen.getAllByRole('img', { name: 'iPhone 15' })[0]).toHaveAttribute(
      'src',
      '/uploads/b.png',
    );
    expect(screen.getByRole('button', { name: 'Xem ảnh 1' })).toHaveAttribute(
      'aria-current',
      'false',
    );
  });
});

describe('StickyPriceBar', () => {
  const product = {
    name: 'iPhone 15',
    price: 20000000,
    salePrice: 18000000,
    images: [{ id: 1, url: '/uploads/a.png' }],
  };
  const original = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });

  // Giả lập IntersectionObserver để chủ động báo "khối giá còn thấy / đã cuộn khuất"
  const mockObserver = () => {
    const state = { callback: null, disconnected: false };
    globalThis.IntersectionObserver = class {
      constructor(callback) {
        state.callback = callback;
      }
      observe() {}
      disconnect() {
        state.disconnected = true;
      }
    };
    return state;
  };

  const renderBar = () => {
    const anchorRef = { current: document.createElement('div') };
    return render(
      <MemoryRouter>
        <CompareProvider>
          <StickyPriceBar anchorRef={anchorRef} product={product} />
        </CompareProvider>
      </MemoryRouter>,
    );
  };

  it('khối giá còn trong tầm nhìn thì ẩn; cuộn khuất lên phía trên thì hiện tên và giá', () => {
    const state = mockObserver();
    renderBar();
    expect(screen.queryByRole('region', { name: 'Tóm tắt sản phẩm' })).not.toBeInTheDocument();

    act(() => state.callback([{ isIntersecting: false, boundingClientRect: { top: -200 } }]));
    const bar = screen.getByRole('region', { name: 'Tóm tắt sản phẩm' });
    expect(bar).toHaveTextContent('iPhone 15');
    expect(bar).toHaveTextContent('18.000.000 ₫');

    act(() => state.callback([{ isIntersecting: true, boundingClientRect: { top: 100 } }]));
    expect(screen.queryByRole('region', { name: 'Tóm tắt sản phẩm' })).not.toBeInTheDocument();
  });

  it('khối giá còn nằm phía dưới (chưa cuộn tới) thì không hiện thanh', () => {
    const state = mockObserver();
    renderBar();

    act(() => state.callback([{ isIntersecting: false, boundingClientRect: { top: 900 } }]));
    expect(screen.queryByRole('region', { name: 'Tóm tắt sản phẩm' })).not.toBeInTheDocument();
  });

  it('gỡ observer khi rời trang', () => {
    const state = mockObserver();
    const { unmount } = renderBar();

    unmount();
    expect(state.disconnected).toBe(true);
  });

  it('môi trường không có IntersectionObserver thì không hiện thanh và không lỗi', () => {
    globalThis.IntersectionObserver = undefined;
    renderBar();

    expect(screen.queryByRole('region', { name: 'Tóm tắt sản phẩm' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Khung chờ khi đang tải
// ---------------------------------------------------------------------------
describe('Khung chờ (skeleton)', () => {
  it('danh sách sản phẩm hiện khung chờ có nhãn trong lúc tải, rồi biến mất khi có dữ liệu', async () => {
    mockServer({
      'GET /categories': [200, []],
      'GET /brands': [200, []],
      'GET /products': [
        200,
        {
          items: [
            {
              id: 1,
              name: 'iPhone 15',
              slug: 'iphone-15',
              price: 1,
              salePrice: null,
              inStock: true,
              thumbnail: null,
              category: { name: 'Điện thoại', slug: 'dien-thoai' },
              brand: { name: 'Apple', slug: 'apple' },
            },
          ],
          page: 1,
          pageSize: 12,
          total: 1,
        },
      ],
    });
    renderApp('/san-pham');

    expect(screen.getByRole('status', { name: 'Đang tải sản phẩm' })).toBeInTheDocument();
    expect(await screen.findByText('iPhone 15')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Đang tải sản phẩm' })).not.toBeInTheDocument(),
    );
  });

  it('trang chi tiết hiện khung chờ trong lúc tải', async () => {
    mockServer({
      'GET /products/iphone-15': [
        200,
        {
          id: 1,
          sku: 'X',
          name: 'iPhone 15',
          slug: 'iphone-15',
          description: null,
          specs: {},
          price: 1,
          salePrice: null,
          inStock: true,
          images: [],
          category: { name: 'Điện thoại', slug: 'dien-thoai' },
          brand: { name: 'Apple', slug: 'apple' },
        },
      ],
      'GET /products': [200, { items: [], page: 1, pageSize: 5, total: 0 }],
    });
    renderApp('/san-pham/iphone-15');

    expect(screen.getByRole('status', { name: 'Đang tải sản phẩm' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'iPhone 15', level: 1 })).toBeInTheDocument();
  });
});
