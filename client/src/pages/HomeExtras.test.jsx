/**
 * @feature [F12] Kiểm thử các khối mới của trang chủ: thương hiệu nổi bật, banner danh mục, dải số liệu,
 * sản phẩm đã xem, cùng hiệu ứng hiện dần (Reveal) và con số chạy (CountUp).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  RECENT_MAX,
  RECENT_STORAGE_KEY,
  clearRecent,
  getRecent,
  pushRecent,
} from '../lib/recentlyViewed.js';
import CountUp from '../components/motion/CountUp.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { apiError, mockServer, renderApp, storefrontApi } from '../test/utils.jsx';

const categories = [
  { id: 1, name: 'Điện thoại', slug: 'dien-thoai', productCount: 12 },
  { id: 2, name: 'Laptop', slug: 'laptop', productCount: 5 },
];
const brands = [
  { id: 1, name: 'Apple', slug: 'apple', logoUrl: null, productCount: 9 },
  { id: 2, name: 'Dell', slug: 'dell', logoUrl: '/uploads/dell.png', productCount: 8 },
];

const openHome = (overrides = {}) => {
  mockServer({
    ...storefrontApi,
    'GET /categories': [200, categories],
    'GET /brands': [200, brands],
    ...overrides,
  });
  renderApp('/');
};

describe('Thương hiệu nổi bật', () => {
  it('mỗi thương hiệu là liên kết lọc theo hãng, kèm số sản phẩm; chưa có logo thì hiện chữ cái đầu', async () => {
    openHome();

    const section = await screen.findByRole('region', { name: 'Thương hiệu nổi bật' });
    const apple = within(section).getByRole('link', { name: /Apple/ });
    expect(apple).toHaveAttribute('href', '/san-pham?brand=apple');
    expect(apple).toHaveTextContent('9 sản phẩm');
    expect(apple).toHaveTextContent('A'); // chữ cái đầu thay logo

    const dell = within(section).getByRole('link', { name: /Dell/ });
    expect(dell.querySelector('img')).toHaveAttribute('src', '/uploads/dell.png');
  });

  it('API thương hiệu lỗi thì ẩn khối, trang chủ vẫn dùng được', async () => {
    openHome({ 'GET /brands': [500, apiError('INTERNAL_ERROR', 'Lỗi')] });

    expect(await screen.findByRole('region', { name: 'Danh mục' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Thương hiệu nổi bật' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Số liệu về TechStore' })).not.toBeInTheDocument();
  });
});

describe('Banner danh mục', () => {
  it('chỉ hiện banner của danh mục có thật (có Laptop, không có Phụ kiện)', async () => {
    openHome();

    const laptop = await screen.findByRole('link', { name: /Laptop cho mọi nhu cầu/ });
    expect(laptop).toHaveAttribute('href', '/san-pham?category=laptop');
    expect(screen.queryByRole('link', { name: /Phụ kiện thông minh/ })).not.toBeInTheDocument();
  });

  it('có cả hai danh mục thì hiện cả hai banner', async () => {
    openHome({
      'GET /categories': [
        200,
        [...categories, { id: 3, name: 'Phụ kiện', slug: 'phu-kien', productCount: 3 }],
      ],
    });

    expect(await screen.findByRole('link', { name: /Phụ kiện thông minh/ })).toHaveAttribute(
      'href',
      '/san-pham?category=phu-kien',
    );
    expect(screen.getByRole('link', { name: /Laptop cho mọi nhu cầu/ })).toBeInTheDocument();
  });

  it('không có danh mục nào khớp thì không hiện banner', async () => {
    openHome({
      'GET /categories': [200, [{ id: 9, name: 'Khác', slug: 'khac', productCount: 1 }]],
    });

    await screen.findByRole('region', { name: 'Danh mục' });
    expect(screen.queryByRole('link', { name: /Laptop cho mọi nhu cầu/ })).not.toBeInTheDocument();
  });
});

describe('Dải số liệu', () => {
  it('đếm thật từ dữ liệu: tổng sản phẩm, số danh mục, số thương hiệu, bảo hành 12 tháng', async () => {
    openHome();

    const band = await screen.findByRole('region', { name: 'Số liệu về TechStore' });
    const item = (label) => within(band).getByText(label).closest('li');
    expect(item('Sản phẩm chính hãng')).toHaveTextContent('17');
    expect(item('Danh mục')).toHaveTextContent('2');
    expect(item('Thương hiệu')).toHaveTextContent('2');
    expect(item('Tháng bảo hành')).toHaveTextContent('12');
  });
});

describe('Sản phẩm đã xem', () => {
  const item = (n) => ({
    slug: `sp-${n}`,
    name: `Sản phẩm ${n}`,
    thumbnail: n % 2 ? `/uploads/${n}.png` : null,
    brand: 'Apple',
  });

  it('chưa xem gì thì không hiện khối', async () => {
    openHome();
    await screen.findByRole('region', { name: 'Danh mục' });

    expect(screen.queryByRole('region', { name: 'Bạn đã xem' })).not.toBeInTheDocument();
  });

  it('hiện các sản phẩm đã xem (liên kết, tên, hãng, không có giá); Xóa lịch sử làm trống', async () => {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify([item(1), item(2)]));
    openHome();

    const section = await screen.findByRole('region', { name: 'Bạn đã xem' });
    const first = within(section).getByRole('link', { name: /Sản phẩm 1/ });
    expect(first).toHaveAttribute('href', '/san-pham/sp-1');
    expect(first).not.toHaveTextContent('₫');
    expect(within(section).getByText('Chưa có ảnh')).toBeInTheDocument(); // sản phẩm 2 không có ảnh

    await userEvent.click(within(section).getByRole('button', { name: 'Xóa lịch sử' }));

    expect(screen.queryByRole('region', { name: 'Bạn đã xem' })).not.toBeInTheDocument();
    expect(localStorage.getItem(RECENT_STORAGE_KEY)).toBeNull();
  });

  it('mở trang chi tiết thì ghi nhận vào lịch sử đã xem', async () => {
    mockServer({
      ...storefrontApi,
      'GET /products/iphone-15': [
        200,
        {
          id: 1,
          sku: 'X',
          name: 'iPhone 15',
          slug: 'iphone-15',
          description: null,
          specs: {},
          price: 20000000,
          salePrice: null,
          inStock: true,
          images: [{ id: 1, url: '/uploads/a.png' }],
          category: { name: 'Điện thoại', slug: 'dien-thoai' },
          brand: { name: 'Apple', slug: 'apple' },
        },
      ],
    });
    renderApp('/san-pham/iphone-15');
    await screen.findByRole('heading', { name: 'iPhone 15', level: 1 });

    expect(getRecent()).toEqual([
      { slug: 'iphone-15', name: 'iPhone 15', thumbnail: '/uploads/a.png', brand: 'Apple' },
    ]);
  });
});

describe('recentlyViewed (lưu trữ)', () => {
  const product = (n) => ({ slug: `p-${n}`, name: `P ${n}`, images: [], brand: { name: 'B' } });

  it('mới nhất đứng đầu, bỏ bản trùng và chỉ giữ tối đa số lượng cho phép', () => {
    for (let n = 1; n <= RECENT_MAX + 3; n += 1) pushRecent(product(n));
    expect(getRecent()).toHaveLength(RECENT_MAX);
    expect(getRecent()[0].slug).toBe(`p-${RECENT_MAX + 3}`);

    pushRecent(product(RECENT_MAX)); // xem lại một sản phẩm cũ -> lên đầu, không nhân đôi
    const slugs = getRecent().map((entry) => entry.slug);
    expect(slugs[0]).toBe(`p-${RECENT_MAX}`);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('dữ liệu hỏng hoặc sai dạng bị bỏ qua; clearRecent xóa sạch', () => {
    localStorage.setItem(RECENT_STORAGE_KEY, '{hong');
    expect(getRecent()).toEqual([]);

    localStorage.setItem(
      RECENT_STORAGE_KEY,
      JSON.stringify([null, { slug: 1 }, { slug: 'a', name: 'A' }]),
    );
    expect(getRecent()).toHaveLength(1);

    clearRecent();
    expect(getRecent()).toEqual([]);
  });

  it('không lưu được (localStorage ném lỗi) thì không làm hỏng trang', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => pushRecent(product(1))).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe('Reveal', () => {
  const original = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });

  it('khối ẩn mờ cho tới khi cuộn tới, rồi hiện và ngừng theo dõi', () => {
    let callback;
    const disconnect = vi.fn();
    globalThis.IntersectionObserver = class {
      constructor(cb) {
        callback = cb;
      }
      observe() {}
      disconnect() {
        disconnect();
      }
    };
    render(<Reveal>Nội dung</Reveal>);
    const box = screen.getByText('Nội dung');
    expect(box).toHaveClass('opacity-0');

    act(() => callback([{ isIntersecting: false }]));
    expect(box).toHaveClass('opacity-0');

    act(() => callback([{ isIntersecting: true }]));
    expect(box).toHaveClass('opacity-100');
    expect(disconnect).toHaveBeenCalled();
  });

  it('không có IntersectionObserver thì hiện ngay (nội dung không bao giờ bị ẩn mãi)', () => {
    globalThis.IntersectionObserver = undefined;
    render(<Reveal>Nội dung</Reveal>);

    expect(screen.getByText('Nội dung')).toHaveClass('opacity-100');
  });
});

describe('CountUp', () => {
  const originalObserver = globalThis.IntersectionObserver;
  const originalRaf = globalThis.requestAnimationFrame;
  afterEach(() => {
    globalThis.IntersectionObserver = originalObserver;
    globalThis.requestAnimationFrame = originalRaf;
    window.matchMedia = undefined;
    vi.restoreAllMocks();
  });

  it('không có IntersectionObserver thì hiện ngay giá trị cuối, kèm hậu tố', () => {
    globalThis.IntersectionObserver = undefined;
    const { container } = render(<CountUp value={1234} suffix="+" />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('1.234+');
  });

  it('người dùng bật "giảm chuyển động" thì không chạy, hiện ngay giá trị cuối', () => {
    globalThis.IntersectionObserver = class {
      observe() {}
      disconnect() {}
    };
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const { container } = render(<CountUp value={50} />);

    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent('50');
  });

  it('khi cuộn tới thì chạy từ 0 lên giá trị thật (easeOut), chữ cho trình đọc luôn là giá trị cuối', () => {
    let observerCallback;
    globalThis.IntersectionObserver = class {
      constructor(cb) {
        observerCallback = cb;
      }
      observe() {}
      disconnect() {}
    };
    const frames = [];
    globalThis.requestAnimationFrame = (cb) => frames.push(cb);
    vi.spyOn(performance, 'now').mockReturnValue(1000);

    const { container } = render(<CountUp value={100} />);
    const visible = () => container.querySelector('[aria-hidden="true"]');
    expect(visible()).toHaveTextContent('0');
    expect(container.querySelector('.sr-only')).toHaveTextContent('100');

    act(() => observerCallback([{ isIntersecting: true }]));
    act(() => frames.shift()(1600)); // nửa thời gian: 1 - 0.5^3 = 87.5%
    expect(visible()).toHaveTextContent('88');

    act(() => frames.shift()(2200)); // đủ thời gian
    expect(visible()).toHaveTextContent('100');
    expect(frames).toHaveLength(0); // dừng gọi thêm khung hình
  });
});
