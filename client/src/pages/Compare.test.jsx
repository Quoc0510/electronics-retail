/**
 * @feature [F12] Kiểm thử so sánh sản phẩm: thêm/bỏ từ thẻ và trang chi tiết, giới hạn 4 sản phẩm cùng danh mục,
 * lưu qua lần tải lại, thanh so sánh nổi và trang /so-sanh (khác biệt, giá tốt nhất, lỗi từng cột).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { COMPARE_STORAGE_KEY } from '../context/CompareContext.jsx';
import { apiError, mockServer, renderApp, storefrontApi } from '../test/utils.jsx';

const phone = { name: 'Điện thoại', slug: 'dien-thoai' };
const laptop = { name: 'Laptop', slug: 'laptop' };

const listItem = (id, name, category = phone, overrides = {}) => ({
  id,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  price: 10000000,
  salePrice: null,
  inStock: true,
  thumbnail: null,
  category,
  brand: { name: 'Apple', slug: 'apple' },
  ...overrides,
});

const detail = (item, specs = {}, overrides = {}) => ({
  ...item,
  sku: `SKU-${item.id}`,
  description: null,
  specs,
  images: [],
  ...overrides,
});

const storedItem = (item) => ({
  slug: item.slug,
  name: item.name,
  thumbnail: null,
  category: item.category,
});

const seed = (...items) =>
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items.map(storedItem)));

const a = listItem(1, 'Phone A');
const b = listItem(2, 'Phone B', phone, { price: 8000000 });
const c = listItem(3, 'Phone C');
const d = listItem(4, 'Phone D');
const e = listItem(5, 'Phone E');
const lap = listItem(6, 'Laptop X', laptop);

const listHandlers = (items) => ({
  ...storefrontApi,
  'GET /categories': [200, []],
  'GET /brands': [200, []],
  'GET /products': [200, { items, page: 1, pageSize: 12, total: items.length }],
});

describe('Thêm và bỏ sản phẩm so sánh', () => {
  it('bấm nút trên thẻ thì thêm; thanh so sánh và biểu tượng đầu trang hiện số lượng; bấm lại thì bỏ', async () => {
    mockServer(listHandlers([a, b]));
    renderApp('/san-pham');

    const button = await screen.findByRole('button', { name: 'So sánh Phone A' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('region', { name: 'Sản phẩm đang so sánh' })).not.toBeInTheDocument();

    await userEvent.click(button);

    expect(
      screen.getByRole('button', { name: 'Bỏ Phone A khỏi so sánh', pressed: true }),
    ).toBeInTheDocument();
    const bar = screen.getByRole('region', { name: 'Sản phẩm đang so sánh' });
    expect(within(bar).getByText('Phone A')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'So sánh sản phẩm (1)' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY))).toEqual([
      { slug: 'phone-a', name: 'Phone A', thumbnail: null, category: phone },
    ]);

    await userEvent.click(
      screen.getByRole('button', { name: 'Bỏ Phone A khỏi so sánh', pressed: true }),
    );
    expect(screen.queryByRole('region', { name: 'Sản phẩm đang so sánh' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY))).toEqual([]);
  });

  it('nút trên thẻ không làm chuyển sang trang chi tiết', async () => {
    mockServer(listHandlers([a]));
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'So sánh Phone A' }));

    expect(screen.getByRole('heading', { name: 'Tất cả sản phẩm', level: 1 })).toBeInTheDocument();
  });

  it('chỉ có 1 sản phẩm thì chưa so sánh được; đủ 2 thì có liên kết sang trang so sánh', async () => {
    mockServer(listHandlers([a, b]));
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'So sánh Phone A' }));
    const bar = screen.getByRole('region', { name: 'Sản phẩm đang so sánh' });
    expect(within(bar).queryByRole('link', { name: /So sánh \(/ })).not.toBeInTheDocument();
    expect(
      within(bar)
        .getByText(/So sánh \(1\)/)
        .closest('[aria-disabled]'),
    ).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'So sánh Phone B' }));
    expect(within(bar).getByRole('link', { name: 'So sánh (2)' })).toHaveAttribute(
      'href',
      '/so-sanh',
    );
  });

  it('tối đa 4 sản phẩm: thêm cái thứ 5 bị từ chối kèm thông báo', async () => {
    mockServer(listHandlers([a, b, c, d, e]));
    renderApp('/san-pham');
    await screen.findByRole('button', { name: 'So sánh Phone A' });

    for (const name of ['Phone A', 'Phone B', 'Phone C', 'Phone D']) {
      await userEvent.click(screen.getByRole('button', { name: `So sánh ${name}` }));
    }
    await userEvent.click(screen.getByRole('button', { name: 'So sánh Phone E' }));

    expect(screen.getByRole('status')).toHaveTextContent('tối đa 4 sản phẩm');
    expect(screen.getByRole('link', { name: 'So sánh sản phẩm (4)' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'So sánh Phone E', pressed: false }),
    ).toBeInTheDocument();

    // Bỏ bớt một sản phẩm thì thông báo biến mất
    await userEvent.click(
      screen.getByRole('button', { name: 'Bỏ Phone D khỏi so sánh', pressed: true }),
    );
    expect(screen.queryByText(/tối đa 4 sản phẩm/)).not.toBeInTheDocument();
  });

  it('chỉ so sánh sản phẩm cùng danh mục', async () => {
    mockServer(listHandlers([a, lap]));
    renderApp('/san-pham');

    await userEvent.click(await screen.findByRole('button', { name: 'So sánh Phone A' }));
    await userEvent.click(screen.getByRole('button', { name: 'So sánh Laptop X' }));

    expect(screen.getByRole('status')).toHaveTextContent('cùng danh mục "Điện thoại"');
    expect(screen.getByRole('link', { name: 'So sánh sản phẩm (1)' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('danh sách được giữ khi tải lại trang; "Xóa tất cả" làm trống', async () => {
    seed(a, b);
    mockServer(listHandlers([a, b]));
    renderApp('/san-pham');

    const bar = await screen.findByRole('region', { name: 'Sản phẩm đang so sánh' });
    expect(within(bar).getByText('Phone A')).toBeInTheDocument();
    expect(within(bar).getByText('Phone B')).toBeInTheDocument();

    await userEvent.click(within(bar).getByRole('button', { name: 'Xóa tất cả' }));
    expect(screen.queryByRole('region', { name: 'Sản phẩm đang so sánh' })).not.toBeInTheDocument();
  });

  it('dữ liệu hỏng trong localStorage bị bỏ qua thay vì làm lỗi trang', async () => {
    localStorage.setItem(COMPARE_STORAGE_KEY, '{khong-phai-json');
    mockServer(listHandlers([a]));
    renderApp('/san-pham');

    expect(await screen.findByRole('button', { name: 'So sánh Phone A' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Sản phẩm đang so sánh' })).not.toBeInTheDocument();
  });

  it('phần tử sai dạng trong localStorage bị lọc bỏ, phần tử đúng được giữ', async () => {
    localStorage.setItem(
      COMPARE_STORAGE_KEY,
      JSON.stringify([{ slug: 5 }, null, storedItem(a), { name: 'Thiếu slug' }]),
    );
    mockServer(listHandlers([a]));
    renderApp('/san-pham');

    const bar = await screen.findByRole('region', { name: 'Sản phẩm đang so sánh' });
    expect(within(bar).getAllByRole('listitem')).toHaveLength(1);
  });

  it('trang chi tiết có nút So sánh dạng bật/tắt', async () => {
    mockServer({
      ...listHandlers([]),
      'GET /products/phone-a': [
        200,
        detail(a, { Chip: 'A1' }, { images: [{ id: 1, url: '/uploads/a.png' }] }),
      ],
    });
    renderApp('/san-pham/phone-a');

    await userEvent.click(await screen.findByRole('button', { name: 'So sánh', pressed: false }));

    expect(
      screen.getByRole('button', { name: 'Đã thêm để so sánh', pressed: true }),
    ).toBeInTheDocument();
    // Ảnh đầu tiên của chi tiết sản phẩm được dùng làm ảnh thu nhỏ trên thanh so sánh
    expect(JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY))[0].thumbnail).toBe(
      '/uploads/a.png',
    );
  });
});

describe('Trang so sánh', () => {
  const handlers = (extra = {}) => ({
    ...listHandlers([]),
    'GET /products/phone-a': [200, detail(a, { Chip: 'A1', RAM: '8GB', 'Màn hình': '6.1 inch' })],
    'GET /products/phone-b': [200, detail(b, { Chip: 'A1', RAM: '12GB', Pin: '4000mAh' })],
    ...extra,
  });

  it('chưa chọn sản phẩm nào thì hiện hướng dẫn và liên kết xem sản phẩm', async () => {
    mockServer(handlers());
    renderApp('/so-sanh');

    expect(
      screen.getByRole('heading', { name: 'Chưa có sản phẩm để so sánh' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem sản phẩm' })).toHaveAttribute('href', '/san-pham');
  });

  it('hiện bảng: giá, tình trạng, thương hiệu và gộp thông số của mọi sản phẩm (thiếu thì ghi "-")', async () => {
    seed(a, b);
    mockServer(handlers());
    renderApp('/so-sanh');

    expect(await screen.findByRole('heading', { name: 'So sánh sản phẩm' })).toBeInTheDocument();
    const table = await screen.findByRole('table');
    await within(table).findByRole('link', { name: 'Phone B' });

    expect(within(table).getByRole('row', { name: /^Giá bán/ })).toHaveTextContent('10.000.000 ₫');
    expect(within(table).getByRole('row', { name: /^Giá bán/ })).toHaveTextContent('8.000.000 ₫');
    expect(within(table).getByRole('row', { name: /^Tình trạng/ })).toHaveTextContent('Còn hàng');
    // Pin chỉ Phone B có, Màn hình chỉ Phone A có
    const battery = within(table).getByRole('row', { name: /^Pin/ });
    expect(
      within(battery)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['-', '4000mAh']);
    const screenRow = within(table).getByRole('row', { name: /^Màn hình/ });
    expect(
      within(screenRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['6.1 inch', '-']);
  });

  it('đánh dấu hàng khác nhau và chỉ hiện hàng đó khi bật "Chỉ hiện điểm khác biệt"', async () => {
    seed(a, b);
    mockServer(handlers());
    renderApp('/so-sanh');
    const table = await screen.findByRole('table');
    await within(table).findByRole('link', { name: 'Phone B' });

    expect(
      within(within(table).getByRole('row', { name: /^RAM/ })).getByText('Khác nhau'),
    ).toBeInTheDocument();
    expect(
      within(within(table).getByRole('row', { name: /^Chip/ })).queryByText('Khác nhau'),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Chỉ hiện điểm khác biệt'));

    expect(within(table).queryByRole('row', { name: /^Chip/ })).not.toBeInTheDocument();
    expect(within(table).getByRole('row', { name: /^RAM/ })).toBeInTheDocument();
  });

  it('chỉ hiện điểm khác biệt mà mọi thứ giống nhau thì báo giống nhau', async () => {
    const same = { Chip: 'A1' };
    seed(a, c);
    mockServer({
      ...handlers(),
      'GET /products/phone-a': [200, detail(a, same)],
      'GET /products/phone-c': [200, detail(c, same)],
    });
    renderApp('/so-sanh');
    const table = await screen.findByRole('table');
    await within(table).findByRole('link', { name: 'Phone C' });

    await userEvent.click(screen.getByLabelText('Chỉ hiện điểm khác biệt'));

    expect(screen.getByText('Các sản phẩm này giống nhau ở mọi thông số.')).toBeInTheDocument();
  });

  it('gắn nhãn "Giá tốt nhất" cho sản phẩm có giá bán hiện hành thấp nhất (tính cả khuyến mãi)', async () => {
    seed(a, b);
    mockServer(
      handlers({
        // Phone A giảm giá còn 7 triệu, thấp hơn 8 triệu của Phone B
        'GET /products/phone-a': [200, detail(a, {}, { salePrice: 7000000 })],
      }),
    );
    renderApp('/so-sanh');
    const table = await screen.findByRole('table');
    await within(table).findByRole('link', { name: 'Phone B' });

    // Footer cũng có liên kết "Giá tốt nhất" nên chỉ tìm nhãn trong bảng
    const badges = within(table).getAllByText('Giá tốt nhất');
    expect(badges).toHaveLength(1);
    expect(badges[0].closest('th')).toHaveTextContent('Phone A');
  });

  it('bấm dấu × trên một cột thì bỏ sản phẩm đó; còn 1 sản phẩm thì nhắc chọn thêm', async () => {
    seed(a, b);
    mockServer(handlers());
    renderApp('/so-sanh');
    const table = await screen.findByRole('table');
    await within(table).findByRole('link', { name: 'Phone B' });

    await userEvent.click(within(table).getByRole('button', { name: 'Bỏ Phone B khỏi so sánh' }));

    expect(screen.queryByRole('link', { name: 'Phone B' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('thêm ít nhất 1 sản phẩm nữa');
    expect(screen.getByRole('link', { name: 'Chọn thêm' })).toHaveAttribute(
      'href',
      '/san-pham?category=dien-thoai',
    );
    // Không còn nhãn "Giá tốt nhất" khi chỉ còn một sản phẩm
    expect(within(table).queryByText('Giá tốt nhất')).not.toBeInTheDocument();
  });

  it('một sản phẩm không còn bán (404) chỉ làm hỏng cột của nó, các cột khác vẫn hiện', async () => {
    seed(a, b);
    mockServer(
      handlers({
        'GET /products/phone-b': [404, apiError('NOT_FOUND', 'Không tìm thấy sản phẩm')],
      }),
    );
    renderApp('/so-sanh');

    expect(await screen.findByRole('alert')).toHaveTextContent('không còn được bán');
    expect(screen.getByRole('link', { name: 'Phone A' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ khỏi so sánh' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('lỗi máy chủ (500) báo không tải được thông tin', async () => {
    seed(a, b);
    mockServer(handlers({ 'GET /products/phone-b': [500, apiError('INTERNAL_ERROR', 'Lỗi')] }));
    renderApp('/so-sanh');

    expect(await screen.findByRole('alert', {}, { timeout: 4000 })).toHaveTextContent(
      'Không tải được thông tin',
    );
  });

  it('nút Xóa tất cả đưa về trạng thái trống', async () => {
    seed(a, b);
    mockServer(handlers());
    renderApp('/so-sanh');
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Xóa tất cả' }));

    expect(
      screen.getByRole('heading', { name: 'Chưa có sản phẩm để so sánh' }),
    ).toBeInTheDocument();
  });

  it('thanh so sánh nổi không hiện ở chính trang so sánh', async () => {
    seed(a, b);
    mockServer(handlers());
    renderApp('/so-sanh');
    await screen.findByRole('table');

    expect(screen.queryByRole('region', { name: 'Sản phẩm đang so sánh' })).not.toBeInTheDocument();
  });
});
