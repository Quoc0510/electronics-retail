/**
 * @feature [F04] Kiểm thử giao diện duyệt và tìm sản phẩm của Client: trang chủ, danh sách, chi tiết, ô tìm kiếm (US-10 → US-13).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError, mockServer, renderApp } from '../test/utils.jsx';

const categories = [
  {
    id: 1,
    name: 'Điện thoại',
    slug: 'dien-thoai',
    description: null,
    imageUrl: null,
    productCount: 3,
  },
  { id: 2, name: 'Laptop', slug: 'laptop', description: null, imageUrl: null, productCount: 1 },
];
const brands = [
  { id: 1, name: 'Apple', slug: 'apple', logoUrl: null, productCount: 3 },
  { id: 2, name: 'Dell', slug: 'dell', logoUrl: null, productCount: 1 },
];

const product = (overrides = {}) => ({
  id: 1,
  name: 'iPhone 15',
  slug: 'iphone-15',
  price: 20000000,
  salePrice: null,
  inStock: true,
  thumbnail: null,
  category: { name: 'Điện thoại', slug: 'dien-thoai' },
  brand: { name: 'Apple', slug: 'apple' },
  ...overrides,
});

const page = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 12,
  total: items.length,
  ...extra,
});

// Máy chủ giả cho các trang duyệt sản phẩm; paramsLog ghi lại tham số của mỗi lần gọi GET /products
const setup = ({ items = [product()], total = items.length, productsHandler } = {}) => {
  const paramsLog = [];
  const calls = mockServer({
    'GET /categories': [200, categories],
    'GET /brands': [200, brands],
    'GET /products': (config) => {
      paramsLog.push(config.params);
      if (productsHandler) return productsHandler(config);
      // Khối "Đang khuyến mãi" ở trang chủ gọi với onSale=true nên chỉ trả sản phẩm có giá khuyến mãi
      const shown = config.params.onSale ? items.filter((item) => item.salePrice) : items;
      return [
        200,
        page(shown, {
          total: config.params.onSale ? shown.length : total,
          page: config.params.page ?? 1,
        }),
      ];
    },
  });
  return { calls, paramsLog };
};

// ---------------------------------------------------------------------------
// Trang chủ (US-10)
// ---------------------------------------------------------------------------
describe('Trang chủ (US-10)', () => {
  it('hiện giới thiệu, danh mục kèm số sản phẩm và sản phẩm mới', async () => {
    const { paramsLog } = setup({
      items: [product(), product({ id: 2, name: 'Dell XPS 13', slug: 'dell-xps-13' })],
    });
    renderApp('/');

    expect(
      screen.getByRole('heading', { name: 'Thiết bị điện tử chính hãng' }),
    ).toBeInTheDocument();
    // Ô danh mục nằm trong khối "Danh mục" (thanh danh mục trên đầu trang cũng có liên kết cùng tên)
    const tiles = await screen.findByRole('region', { name: 'Danh mục' });
    const categoryLink = within(tiles).getByRole('link', { name: /Điện thoại/ });
    expect(categoryLink).toHaveAttribute('href', '/san-pham?category=dien-thoai');
    expect(categoryLink).toHaveTextContent('3');
    expect(await screen.findByText('Dell XPS 13')).toBeInTheDocument();
    // Lấy 8 sản phẩm mới nhất
    expect(paramsLog).toContainEqual({ sort: 'newest', pageSize: 8 });
  });

  it('chưa có sản phẩm thì hiện thông báo thân thiện (AC2)', async () => {
    setup({ items: [] });
    renderApp('/');

    expect(await screen.findByText(/Cửa hàng chưa có sản phẩm nào/)).toBeInTheDocument();
  });

  it('lỗi mạng thì hiện thông báo và nút Thử lại tải được lại (AC3)', async () => {
    let attempts = 0;
    setup({
      productsHandler: (config) => {
        // Khối khuyến mãi luôn trả rỗng; khối sản phẩm mới lỗi ở lần gọi đầu, thành công ở lần thử lại
        if (config.params.onSale) return [200, page([])];
        attempts += 1;
        return attempts === 1
          ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')]
          : [200, page([product()])];
      },
    });
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('iPhone 15')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('danh mục lỗi không làm hỏng phần sản phẩm', async () => {
    mockServer({
      'GET /categories': [500, apiError('INTERNAL_ERROR', 'Lỗi')],
      'GET /products': (config) => [200, page(config.params.onSale ? [] : [product()])],
    });
    renderApp('/');

    expect(await screen.findByText('iPhone 15')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Danh mục' })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Thẻ sản phẩm
// ---------------------------------------------------------------------------
describe('Thẻ sản phẩm', () => {
  it('liên kết tới trang chi tiết, hiện thương hiệu và giá', async () => {
    setup();
    renderApp('/san-pham');

    const card = await screen.findByRole('link', { name: /iPhone 15/ });
    expect(card).toHaveAttribute('href', '/san-pham/iphone-15');
    expect(card).toHaveTextContent('Apple');
    expect(card).toHaveTextContent('20.000.000 ₫');
    expect(card).toHaveTextContent('Chưa có ảnh');
  });

  it('có khuyến mãi: giá khuyến mãi, giá gốc gạch ngang và phần trăm giảm', async () => {
    setup({ items: [product({ salePrice: 18000000, thumbnail: '/uploads/products/a.png' })] });
    renderApp('/san-pham');

    expect(await screen.findByText('18.000.000 ₫')).toHaveClass('text-rose-600');
    expect(screen.getByText('20.000.000 ₫')).toHaveClass('line-through');
    expect(screen.getByText('-10%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'iPhone 15' })).toHaveAttribute(
      'src',
      '/uploads/products/a.png',
    );
  });

  it('hết hàng thì có nhãn Hết hàng', async () => {
    setup({ items: [product({ inStock: false })] });
    renderApp('/san-pham');

    expect(await screen.findByText('Hết hàng')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Danh sách (US-11, US-12)
// ---------------------------------------------------------------------------
describe('Trang danh sách (US-11, US-12)', () => {
  it('mặc định gọi API với 12 sản phẩm mỗi trang, mới nhất trước, không bộ lọc', async () => {
    const { paramsLog } = setup({ items: [product()], total: 30 });
    renderApp('/san-pham');

    expect(await screen.findByText('Tìm thấy 30 sản phẩm')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tất cả sản phẩm', level: 1 })).toBeInTheDocument();
    expect(paramsLog[0]).toEqual({ pageSize: 12, sort: 'newest', page: 1 });
    expect(screen.queryByRole('button', { name: 'Xóa tất cả bộ lọc' })).not.toBeInTheDocument();
  });

  it('đọc toàn bộ bộ lọc từ URL và gửi lên API; các ô hiện đúng giá trị (AC4)', async () => {
    const { paramsLog } = setup({ total: 40 });
    renderApp(
      '/san-pham?category=dien-thoai&brand=apple&minPrice=1000000&maxPrice=5000000&sort=price_asc&page=2&search=iphone',
    );

    await screen.findByText('iPhone 15');
    expect(paramsLog[0]).toEqual({
      pageSize: 12,
      sort: 'price_asc',
      page: 2,
      search: 'iphone',
      category: 'dien-thoai',
      brand: 'apple',
      minPrice: '1000000',
      maxPrice: '5000000',
    });
    expect(screen.getByRole('button', { name: /^Điện thoại/, pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Apple/, pressed: true })).toBeInTheDocument();
    expect(screen.getByLabelText('Sắp xếp')).toHaveValue('price_asc');
    expect(screen.getByLabelText('Giá từ (đồng)')).toHaveValue('1000000');
    expect(screen.getByLabelText('Giá đến (đồng)')).toHaveValue('5000000');
    expect(
      screen.getByRole('heading', { name: 'Kết quả tìm kiếm cho "iphone"', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa tất cả bộ lọc' })).toBeInTheDocument();
  });

  it('tiêu đề lấy tên danh mục khi lọc theo danh mục', async () => {
    setup();
    renderApp('/san-pham?category=laptop');

    expect(await screen.findByRole('heading', { name: 'Laptop', level: 1 })).toBeInTheDocument();
  });

  it('tham số URL sai (page=abc, sort=lung-tung) về giá trị mặc định thay vì làm hỏng trang', async () => {
    const { paramsLog } = setup();
    renderApp('/san-pham?page=abc&sort=lung-tung');

    await screen.findByText('iPhone 15');
    expect(paramsLog[0]).toEqual({ pageSize: 12, sort: 'newest', page: 1 });
  });

  describe('đổi bộ lọc', () => {
    it('chọn danh mục: cập nhật API và về trang 1', async () => {
      const { paramsLog } = setup({ total: 40 });
      renderApp('/san-pham?page=3');
      await screen.findByText('iPhone 15');

      await userEvent.click(screen.getByRole('button', { name: /^Laptop/ }));

      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ category: 'laptop', page: 1 }));
    });

    it('chọn thương hiệu', async () => {
      const { paramsLog } = setup();
      renderApp('/san-pham');
      await screen.findByText('iPhone 15');

      await userEvent.click(screen.getByRole('button', { name: /^Dell/ }));

      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ brand: 'dell' }));
    });

    it('đổi sắp xếp; chọn lại Mới nhất thì bỏ tham số sort khỏi URL', async () => {
      const { paramsLog } = setup();
      renderApp('/san-pham');
      await screen.findByText('iPhone 15');

      await userEvent.selectOptions(screen.getByLabelText('Sắp xếp'), 'Giá giảm dần');
      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ sort: 'price_desc' }));

      await userEvent.selectOptions(screen.getByLabelText('Sắp xếp'), 'Mới nhất');
      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ sort: 'newest' }));
    });

    it('lọc theo khoảng giá', async () => {
      const { paramsLog } = setup();
      renderApp('/san-pham');
      await screen.findByText('iPhone 15');

      await userEvent.type(screen.getByLabelText('Giá từ (đồng)'), '1000000');
      await userEvent.type(screen.getByLabelText('Giá đến (đồng)'), '5000000');
      await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));

      await waitFor(() =>
        expect(paramsLog.at(-1)).toMatchObject({ minPrice: '1000000', maxPrice: '5000000' }),
      );
    });

    it('khoảng giá sai (từ lớn hơn đến, hoặc có chữ) bị báo lỗi và không gọi API', async () => {
      const { paramsLog } = setup();
      renderApp('/san-pham');
      await screen.findByText('iPhone 15');
      const callsBefore = paramsLog.length;

      await userEvent.type(screen.getByLabelText('Giá từ (đồng)'), '5000000');
      await userEvent.type(screen.getByLabelText('Giá đến (đồng)'), '1000000');
      await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Giá tối thiểu không được lớn hơn giá tối đa',
      );

      await userEvent.clear(screen.getByLabelText('Giá đến (đồng)'));
      await userEvent.type(screen.getByLabelText('Giá đến (đồng)'), '1.000.000');
      await userEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Giá chỉ gồm chữ số');

      expect(paramsLog).toHaveLength(callsBefore);
    });

    it('Xóa bộ lọc đưa về danh sách đầy đủ', async () => {
      const { paramsLog } = setup();
      renderApp('/san-pham?category=laptop&search=dell');
      await screen.findByText('iPhone 15');

      await userEvent.click(screen.getAllByRole('button', { name: 'Xóa tất cả bộ lọc' })[0]);

      await waitFor(() =>
        expect(paramsLog.at(-1)).toEqual({ pageSize: 12, sort: 'newest', page: 1 }),
      );
      expect(
        screen.getByRole('button', { name: 'Tất cả danh mục', pressed: true }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Tìm sản phẩm')).toHaveValue('');
    });
  });

  describe('phân trang (AC3)', () => {
    it('hiện các trang bằng liên kết, giữ nguyên các bộ lọc khác', async () => {
      setup({ total: 30 });
      renderApp('/san-pham?category=dien-thoai');
      await screen.findByText('iPhone 15');

      const nav = screen.getByRole('navigation', { name: 'Phân trang' });
      expect(within(nav).getByRole('link', { name: 'Trang 2' })).toHaveAttribute(
        'href',
        '/san-pham?category=dien-thoai&page=2',
      );
      expect(within(nav).getByRole('link', { name: 'Trang 1' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(nav).getByText('Trang trước')).toHaveAttribute('aria-disabled', 'true');
      expect(within(nav).getByRole('link', { name: 'Trang sau' })).toHaveAttribute(
        'href',
        '/san-pham?category=dien-thoai&page=2',
      );
    });

    it('bấm sang trang sau gọi API với page tương ứng và đánh dấu trang hiện tại', async () => {
      const { paramsLog } = setup({ total: 30 });
      renderApp('/san-pham');
      await screen.findByText('iPhone 15');

      await userEvent.click(screen.getByRole('link', { name: 'Trang sau' }));

      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ page: 2 }));
      expect(screen.getByRole('link', { name: 'Trang 2' })).toHaveAttribute('aria-current', 'page');
    });

    it('ở trang cuối thì Trang sau bị khóa; trang 1 có liên kết không kèm ?page', async () => {
      setup({ total: 30 });
      renderApp('/san-pham?page=3');
      await screen.findByText('iPhone 15');

      expect(screen.getByText('Trang sau')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('link', { name: 'Trang 1' })).toHaveAttribute('href', '/san-pham');
    });

    it('rút gọn bằng dấu … khi có nhiều trang', async () => {
      setup({ total: 12 * 20 });
      renderApp('/san-pham?page=10');
      await screen.findByText('iPhone 15');

      const nav = screen.getByRole('navigation', { name: 'Phân trang' });
      expect(within(nav).getAllByText('…')).toHaveLength(2);
      expect(within(nav).getByRole('link', { name: 'Trang 20' })).toBeInTheDocument();
      expect(within(nav).queryByRole('link', { name: 'Trang 5' })).not.toBeInTheDocument();
    });

    it('chỉ một trang thì không hiện phân trang', async () => {
      setup({ total: 5 });
      renderApp('/san-pham');
      await screen.findByText('iPhone 15');

      expect(screen.queryByRole('navigation', { name: 'Phân trang' })).not.toBeInTheDocument();
    });

    it('trang vượt quá số trang thì dẫn về trang đầu', async () => {
      setup({ productsHandler: () => [200, page([], { total: 30, page: 99 })] });
      renderApp('/san-pham?page=99');

      expect(await screen.findByText(/Trang này không có sản phẩm/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Về trang đầu' })).toHaveAttribute(
        'href',
        '/san-pham',
      );
    });
  });

  describe('không có kết quả và lỗi', () => {
    it('đang lọc mà không có kết quả: gợi ý bỏ bớt bộ lọc và nút xóa hoạt động (US-12 AC2)', async () => {
      const { paramsLog } = setup({ items: [], total: 0 });
      renderApp('/san-pham?search=zzz');

      expect(await screen.findByText('Không tìm thấy sản phẩm nào.')).toBeInTheDocument();
      expect(screen.getByText(/bỏ bớt bộ lọc/)).toBeInTheDocument();

      // Có hai nút cùng tên: dải chip phía trên và nút trong thông báo rỗng; bấm nút trong thông báo
      await userEvent.click(screen.getAllByRole('button', { name: 'Xóa tất cả bộ lọc' }).at(-1));
      await waitFor(() =>
        expect(paramsLog.at(-1)).toEqual({ pageSize: 12, sort: 'newest', page: 1 }),
      );
    });

    it('không có bộ lọc mà danh sách rỗng thì không gợi ý bỏ bộ lọc', async () => {
      setup({ items: [], total: 0 });
      renderApp('/san-pham');

      expect(await screen.findByText('Không tìm thấy sản phẩm nào.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Xóa tất cả bộ lọc' })).not.toBeInTheDocument();
    });

    it('lỗi tải danh sách: hiện thông báo và có nút Thử lại', async () => {
      setup({ productsHandler: () => [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] });
      renderApp('/san-pham');

      expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
      expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Ô tìm kiếm (US-12)
// ---------------------------------------------------------------------------
describe('Ô tìm kiếm trên thanh đầu trang (US-12)', () => {
  it('gõ từ khóa rồi bấm Tìm: chuyển tới trang danh sách với từ khóa đó', async () => {
    const { paramsLog } = setup();
    renderApp('/');

    await userEvent.type(screen.getByLabelText('Tìm sản phẩm'), '  iphone 15  ');
    await userEvent.click(screen.getByRole('button', { name: 'Tìm' }));

    expect(
      await screen.findByRole('heading', { name: 'Kết quả tìm kiếm cho "iphone 15"', level: 1 }),
    ).toBeInTheDocument();
    expect(paramsLog.at(-1)).toMatchObject({ search: 'iphone 15' });
  });

  it('nhấn Enter cũng tìm được', async () => {
    const { paramsLog } = setup();
    renderApp('/');

    await userEvent.type(screen.getByLabelText('Tìm sản phẩm'), 'dell{Enter}');

    await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ search: 'dell' }));
  });

  it('từ khóa rỗng: xem toàn bộ sản phẩm, không có tham số search (AC3)', async () => {
    const { paramsLog } = setup();
    renderApp('/san-pham?search=dell');
    await screen.findByText('iPhone 15');

    await userEvent.clear(screen.getByLabelText('Tìm sản phẩm'));
    await userEvent.click(screen.getByRole('button', { name: 'Tìm' }));

    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ pageSize: 12, sort: 'newest', page: 1 }),
    );
  });

  it('từ khóa có ký tự đặc biệt được mã hóa đúng trên URL và gửi nguyên vẹn', async () => {
    const { paramsLog } = setup();
    renderApp('/');

    await userEvent.type(screen.getByLabelText('Tìm sản phẩm'), 'cáp & sạc 100%');
    await userEvent.click(screen.getByRole('button', { name: 'Tìm' }));

    await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ search: 'cáp & sạc 100%' }));
  });

  it('ô tìm kiếm hiện từ khóa theo URL ở trang danh sách, và trống ở trang khác', async () => {
    setup();
    renderApp('/san-pham?search=iphone');

    expect(screen.getByLabelText('Tìm sản phẩm')).toHaveValue('iphone');
  });
});

// ---------------------------------------------------------------------------
// Chi tiết (US-13)
// ---------------------------------------------------------------------------
describe('Trang chi tiết sản phẩm (US-13)', () => {
  const detail = (overrides = {}) => ({
    id: 1,
    sku: 'IP15-128',
    name: 'iPhone 15',
    slug: 'iphone-15',
    description: 'Mô tả dòng 1\nMô tả dòng 2',
    specs: { 'Màn hình': '6.1 inch OLED', Chip: 'A16 Bionic' },
    price: 20000000,
    salePrice: 18000000,
    inStock: true,
    images: [
      { id: 11, url: '/uploads/products/a.png' },
      { id: 12, url: 'https://example.com/b.png' },
    ],
    category: { name: 'Điện thoại', slug: 'dien-thoai' },
    brand: { name: 'Apple', slug: 'apple' },
    ...overrides,
  });

  const open = async (product = detail()) => {
    const calls = mockServer({ [`GET /products/${product.slug}`]: [200, product] });
    renderApp(`/san-pham/${product.slug}`);
    await screen.findByRole('heading', { name: product.name, level: 1 });
    return calls;
  };

  it('hiện đủ thông tin: tên, thương hiệu, mã, giá khuyến mãi, còn hàng, mô tả, thông số (AC1, AC2)', async () => {
    await open();

    expect(screen.getByRole('link', { name: 'Apple' })).toHaveAttribute(
      'href',
      '/san-pham?brand=apple',
    );
    expect(screen.getByText('Mã sản phẩm: IP15-128')).toBeInTheDocument();
    expect(screen.getByText('18.000.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('20.000.000 ₫')).toHaveClass('line-through');
    // Nhãn -10% xuất hiện ở khối giá và trên ảnh
    expect(screen.getAllByText('-10%')).toHaveLength(2);
    expect(screen.getByText(/Bạn tiết kiệm/)).toHaveTextContent('2.000.000 ₫');
    expect(screen.getByText('Còn hàng')).toBeInTheDocument();
    expect(screen.getByText(/Mô tả dòng 1/)).toBeInTheDocument();
    const specs = screen.getByRole('table');
    expect(within(specs).getByRole('rowheader', { name: 'Màn hình' })).toBeInTheDocument();
    expect(within(specs).getByText('A16 Bionic')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Điện thoại' })).toHaveAttribute(
      'href',
      '/san-pham?category=dien-thoai',
    );
  });

  it('đặt tiêu đề tab trình duyệt theo tên sản phẩm', async () => {
    await open();

    await waitFor(() => expect(document.title).toBe('iPhone 15 - TechStore'));
  });

  it('không khuyến mãi: chỉ hiện giá gốc, không có nhãn giảm giá', async () => {
    await open(detail({ salePrice: null }));

    expect(screen.getByText('20.000.000 ₫')).not.toHaveClass('line-through');
    expect(screen.queryByText(/^-\d+%$/)).not.toBeInTheDocument();
  });

  it('hết hàng thì hiện Hết hàng (AC2)', async () => {
    await open(detail({ inStock: false }));

    expect(screen.getByText('Hết hàng')).toBeInTheDocument();
    expect(screen.queryByText('Còn hàng')).not.toBeInTheDocument();
  });

  it('chọn ảnh nhỏ thì ảnh lớn đổi theo', async () => {
    await open();
    const main = () => screen.getAllByRole('img', { name: 'iPhone 15' })[0];
    expect(main()).toHaveAttribute('src', '/uploads/products/a.png');

    await userEvent.click(screen.getByRole('button', { name: 'Xem ảnh 2' }));

    expect(main()).toHaveAttribute('src', 'https://example.com/b.png');
    expect(screen.getByRole('button', { name: 'Xem ảnh 2' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  it('chỉ một ảnh thì không có dải ảnh nhỏ; không ảnh thì hiện ô Chưa có ảnh', async () => {
    await open(detail({ images: [{ id: 11, url: '/uploads/products/a.png' }] }));
    expect(screen.queryByRole('button', { name: /Xem ảnh/ })).not.toBeInTheDocument();
  });

  it('không có ảnh thì hiện ô Chưa có ảnh', async () => {
    await open(detail({ images: [] }));

    expect(screen.getByText('Chưa có ảnh')).toBeInTheDocument();
  });

  it('không có thông số thì không hiện bảng', async () => {
    await open(detail({ specs: {} }));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('sản phẩm không tồn tại (404): hiện trang không tìm thấy và không thử lại vô ích (AC3)', async () => {
    const calls = mockServer({
      'GET /products/khong-co': [404, apiError('NOT_FOUND', 'Không tìm thấy sản phẩm')],
    });
    renderApp('/san-pham/khong-co');

    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy sản phẩm' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem các sản phẩm khác' })).toHaveAttribute(
      'href',
      '/san-pham',
    );
    expect(calls.filter((c) => c.key === 'GET /products/khong-co')).toHaveLength(1);
  });

  it('lỗi khác (500): hiện thông báo kèm nút Thử lại', async () => {
    mockServer({ 'GET /products/iphone-15': [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] });
    renderApp('/san-pham/iphone-15');

    // Trang tự thử lại 1 lần sau khoảng 1 giây trước khi báo lỗi nên cần chờ lâu hơn mặc định
    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Lỗi máy chủ',
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});
