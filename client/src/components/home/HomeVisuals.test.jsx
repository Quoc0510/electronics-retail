/**
 * @feature [F04][F12] Trang chủ - Kiểm thử phần hình ảnh thật: ảnh danh mục, banner nhỏ, logo thương hiệu.
 * Ảnh là trang trí (alt rỗng) nên nội dung chữ phải vẫn đủ; ảnh lỗi thì ẩn đi thay vì hiện biểu tượng ảnh vỡ.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrandStrip from './BrandStrip.jsx';
import CategoryTiles from './CategoryTiles.jsx';
import PromoBanners from './PromoBanners.jsx';

const renderInRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('CategoryTiles', () => {
  const categories = [
    {
      id: 1,
      name: 'Laptop',
      slug: 'laptop',
      imageUrl: '/uploads/seed/category-laptop.webp',
      productCount: 12,
    },
    { id: 2, name: 'Phụ kiện', slug: 'phu-kien', imageUrl: null, productCount: 18 },
  ];

  it('danh mục có ảnh thì hiện ảnh thật, chưa có ảnh thì giữ biểu tượng', () => {
    const { container } = renderInRouter(<CategoryTiles categories={categories} />);

    const photos = container.querySelectorAll('img');
    expect(photos).toHaveLength(1);
    expect(photos[0].getAttribute('src')).toContain('/uploads/seed/category-laptop.webp');
    // Cả hai ô vẫn là liên kết tới danh mục, kèm tên và số sản phẩm
    expect(screen.getByRole('link', { name: /Laptop/ })).toHaveAttribute(
      'href',
      '/san-pham?category=laptop',
    );
    expect(screen.getByRole('link', { name: /Phụ kiện/ })).toHaveAttribute(
      'href',
      '/san-pham?category=phu-kien',
    );
    expect(screen.getByText('12 sản phẩm')).toBeInTheDocument();
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0); // biểu tượng của ô chưa có ảnh
  });
});

describe('PromoBanners', () => {
  const categories = [
    { id: 1, name: 'Laptop', slug: 'laptop' },
    { id: 2, name: 'Phụ kiện', slug: 'phu-kien' },
  ];

  it('hai banner cùng bố cục: chữ và liên kết bên trái, ảnh sản phẩm thật bên phải', () => {
    const { container } = renderInRouter(<PromoBanners categories={categories} />);

    expect(screen.getByRole('link', { name: /Laptop cho mọi nhu cầu/ })).toHaveAttribute(
      'href',
      '/san-pham?category=laptop',
    );
    expect(screen.getByRole('link', { name: /Phụ kiện thông minh/ })).toHaveAttribute(
      'href',
      '/san-pham?category=phu-kien',
    );
    const photos = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(photos.filter((src) => src.includes('promo-laptop'))).toHaveLength(2);
    expect(photos.filter((src) => src.includes('promo-phukien'))).toHaveLength(3);
    // Ảnh chỉ để trang trí: không làm trình đọc màn hình đọc lên
    expect(container.querySelectorAll('img[alt=""]')).toHaveLength(photos.length);
  });

  it('ảnh không tải được thì ẩn đi, chữ vẫn còn', () => {
    const { container } = renderInRouter(<PromoBanners categories={categories} />);
    const first = container.querySelector('img');

    fireEvent.error(first);

    expect(first.style.display).toBe('none');
    expect(screen.getByText('Phụ kiện thông minh')).toBeInTheDocument();
  });

  it('không có danh mục tương ứng thì không hiện banner', () => {
    const { container } = renderInRouter(
      <PromoBanners categories={[{ id: 9, name: 'Khác', slug: 'khac' }]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('BrandStrip', () => {
  it('có logo thì hiện logo thật, chưa có thì hiện chữ cái đầu', () => {
    const brands = [
      {
        id: 1,
        name: 'Apple',
        slug: 'apple',
        logoUrl: '/uploads/seed/brand-apple.svg',
        productCount: 12,
      },
      { id: 2, name: 'Sony', slug: 'sony', logoUrl: null, productCount: 0 },
    ];
    const { container } = renderInRouter(<BrandStrip brands={brands} />);

    const logos = container.querySelectorAll('img');
    expect(logos).toHaveLength(1);
    expect(logos[0].getAttribute('src')).toContain('/uploads/seed/brand-apple.svg');
    expect(screen.getByText('S')).toBeInTheDocument(); // chữ cái đầu của hãng chưa có logo
    expect(screen.getByText('12 sản phẩm')).toBeInTheDocument();
  });
});
