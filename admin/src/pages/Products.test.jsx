/**
 * @feature [F03] Kiểm thử giao diện quản lý sản phẩm của Admin: danh sách, form thêm/sửa, ảnh (US-08, US-09).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

const categories = [
  { id: 1, name: 'Điện thoại', slug: 'dien-thoai', isActive: true, productCount: 2 },
  { id: 2, name: 'Laptop', slug: 'laptop', isActive: true, productCount: 1 },
];
const brands = [
  { id: 1, name: 'Apple', slug: 'apple', isActive: true, productCount: 2 },
  { id: 2, name: 'Dell', slug: 'dell', isActive: true, productCount: 1 },
];

const listItem = (overrides = {}) => ({
  id: 1,
  sku: 'IP15-128',
  name: 'iPhone 15',
  slug: 'iphone-15',
  price: 19990000,
  salePrice: null,
  stock: 25,
  isActive: true,
  thumbnail: null,
  category: { id: 1, name: 'Điện thoại' },
  brand: { id: 1, name: 'Apple' },
  ...overrides,
});

const detail = (overrides = {}) => ({
  id: 1,
  sku: 'IP15-128',
  name: 'iPhone 15',
  slug: 'iphone-15',
  description: 'Mô tả cũ',
  categoryId: 1,
  brandId: 1,
  price: 19990000,
  salePrice: 18490000,
  stock: 25,
  specs: { 'Màn hình': '6.1 inch', RAM: '6GB' },
  isActive: true,
  images: [
    { id: 11, url: '/uploads/products/a.png', sortOrder: 0 },
    { id: 12, url: 'https://example.com/b.png', sortOrder: 1 },
  ],
  category: { id: 1, name: 'Điện thoại' },
  brand: { id: 1, name: 'Apple' },
  ...overrides,
});

const baseHandlers = {
  'GET /users/me': [200, admin],
  'GET /admin/categories': [200, categories],
  'GET /admin/brands': [200, brands],
};

beforeEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// Danh sách
// ---------------------------------------------------------------------------
describe('Danh sách sản phẩm (US-09)', () => {
  // Mở trang danh sách; paramsLog ghi lại tham số của mỗi lần gọi API
  const openList = async ({ items = [listItem()], total = items.length, handlers = {} } = {}) => {
    tokenStorage.setTokens(adminSession);
    const paramsLog = [];
    const calls = mockServer({
      ...baseHandlers,
      'GET /admin/products': (config) => {
        paramsLog.push(config.params);
        return [200, { items, page: config.params.page, pageSize: 10, total }];
      },
      ...handlers,
    });
    renderApp('/san-pham');
    await screen.findByRole('heading', { name: 'Sản phẩm', level: 1 });
    await waitFor(() => expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument());
    return { calls, paramsLog };
  };

  it('menu có mục Sản phẩm', async () => {
    await openList();

    expect(screen.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/san-pham');
  });

  it('hiện tên, SKU, danh mục, thương hiệu, giá và tồn kho', async () => {
    await openList();

    const row = screen.getAllByRole('row')[1];
    expect(within(row).getByText('iPhone 15')).toBeInTheDocument();
    expect(within(row).getByText('IP15-128')).toBeInTheDocument();
    expect(within(row).getByText('Điện thoại')).toBeInTheDocument();
    expect(within(row).getByText('Apple')).toBeInTheDocument();
    expect(within(row).getByText('19.990.000 ₫')).toBeInTheDocument();
    expect(within(row).getByText('Đang bán')).toBeInTheDocument();
    expect(within(row).getByText('Chưa có')).toBeInTheDocument(); // chưa có ảnh
  });

  it('có giá khuyến mãi thì hiện giá khuyến mãi và gạch giá gốc; có ảnh thì hiện ảnh', async () => {
    await openList({
      items: [listItem({ salePrice: 18490000, thumbnail: '/uploads/products/a.png' })],
    });

    expect(screen.getByText('18.490.000 ₫')).toBeInTheDocument();
    expect(screen.getByText('19.990.000 ₫')).toHaveClass('line-through');
    expect(screen.getByRole('img', { name: 'iPhone 15' })).toHaveAttribute(
      'src',
      '/uploads/products/a.png',
    );
  });

  it('tồn kho thấp (từ 5 trở xuống) được tô đỏ', async () => {
    await openList({ items: [listItem({ stock: 3 })] });

    expect(screen.getByText('3')).toHaveClass('text-red-600');
  });

  it('chưa có dữ liệu thì gợi ý thêm mới', async () => {
    await openList({ items: [] });

    expect(await screen.findByText(/Chưa có sản phẩm nào/)).toBeInTheDocument();
  });

  it('báo lỗi khi tải danh sách thất bại', async () => {
    tokenStorage.setTokens(adminSession);
    mockServer({
      ...baseHandlers,
      'GET /admin/products': [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')],
    });
    renderApp('/san-pham');

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
  });

  describe('tìm kiếm, lọc và phân trang', () => {
    it('tìm theo từ khóa gửi tham số search sau khi ngừng gõ', async () => {
      const { paramsLog } = await openList();

      await userEvent.type(screen.getByLabelText('Tìm sản phẩm'), 'iphone');

      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ search: 'iphone', page: 1 }));
    });

    it('lọc theo danh mục và theo trạng thái', async () => {
      const { paramsLog } = await openList();

      await userEvent.selectOptions(screen.getByLabelText('Lọc theo danh mục'), 'Laptop');
      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ categoryId: '2' }));

      await userEvent.selectOptions(screen.getByLabelText('Lọc theo trạng thái'), 'Đang ẩn');
      await waitFor(() =>
        expect(paramsLog.at(-1)).toMatchObject({ categoryId: '2', isActive: 'false' }),
      );
    });

    it('không có kết quả khi đang lọc thì báo khớp bộ lọc', async () => {
      await openList({ items: [] });

      await userEvent.type(screen.getByLabelText('Tìm sản phẩm'), 'zzz');

      expect(await screen.findByText('Không có sản phẩm nào khớp bộ lọc.')).toBeInTheDocument();
    });

    it('phân trang: hiện tổng số, sang trang sau và quay lại; đổi bộ lọc thì về trang 1', async () => {
      const { paramsLog } = await openList({ items: [listItem()], total: 25 });

      expect(screen.getByText('Tổng 25 sản phẩm · Trang 1/3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();

      await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ page: 2 }));
      expect(await screen.findByText('Tổng 25 sản phẩm · Trang 2/3')).toBeInTheDocument();

      await userEvent.selectOptions(screen.getByLabelText('Lọc theo danh mục'), 'Laptop');
      await waitFor(() => expect(paramsLog.at(-1)).toMatchObject({ page: 1, categoryId: '2' }));
    });

    it('ở trang cuối thì khóa nút Trang sau', async () => {
      await openList({ items: [listItem()], total: 10 });

      expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
    });
  });

  describe('thao tác', () => {
    it('bấm Ẩn gửi isActive=false', async () => {
      const { calls } = await openList({
        handlers: { 'PATCH /admin/products/1': [200, detail({ isActive: false })] },
      });

      await userEvent.click(screen.getByRole('button', { name: 'Ẩn' }));

      await waitFor(() =>
        expect(calls).toContainEqual({ key: 'PATCH /admin/products/1', body: { isActive: false } }),
      );
    });

    it('có liên kết sang trang sửa', async () => {
      await openList();

      expect(screen.getByRole('link', { name: 'Sửa iPhone 15' })).toHaveAttribute(
        'href',
        '/san-pham/1',
      );
      expect(screen.getByRole('link', { name: 'Thêm sản phẩm' })).toHaveAttribute(
        'href',
        '/san-pham/them',
      );
    });

    it('xóa chỉ khi người dùng xác nhận', async () => {
      const confirm = vi.spyOn(window, 'confirm');
      const { calls } = await openList({
        handlers: { 'DELETE /admin/products/1': [204, null] },
      });

      confirm.mockReturnValueOnce(false);
      await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
      expect(calls.some((c) => c.key === 'DELETE /admin/products/1')).toBe(false);

      confirm.mockReturnValueOnce(true);
      await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
      await waitFor(() =>
        expect(calls.some((c) => c.key === 'DELETE /admin/products/1')).toBe(true),
      );
    });

    it('sản phẩm đã có trong đơn thì máy chủ từ chối xóa và thông báo hiện ra (US-09 AC2)', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await openList({
        handlers: {
          'DELETE /admin/products/1': [
            409,
            apiError(
              'HAS_ORDERS',
              'Sản phẩm đã có trong 2 đơn hàng nên không thể xóa, hãy ẩn nó thay vì xóa',
            ),
          ],
        },
      });

      await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('hãy ẩn nó thay vì xóa');
      expect(screen.getByText('iPhone 15')).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Form thêm / sửa
// ---------------------------------------------------------------------------
describe('Form sản phẩm (US-08)', () => {
  const openCreate = async (handlers = {}) => {
    tokenStorage.setTokens(adminSession);
    const calls = mockServer({ ...baseHandlers, ...handlers });
    renderApp('/san-pham/them');
    await screen.findByRole('form', { name: 'Thêm sản phẩm' });
    return calls;
  };

  const openEdit = async (product = detail(), handlers = {}) => {
    tokenStorage.setTokens(adminSession);
    const calls = mockServer({
      ...baseHandlers,
      [`GET /admin/products/${product.id}`]: [200, product],
      ...handlers,
    });
    renderApp(`/san-pham/${product.id}`);
    await screen.findByRole('form', { name: 'Sửa sản phẩm' });
    return calls;
  };

  const fillRequired = async (overrides = {}) => {
    const values = {
      'Tên sản phẩm': 'Samsung S24',
      'SKU (mã sản phẩm)': 'ss-s24',
      'Giá gốc (đồng)': '29990000',
      ...overrides,
    };
    for (const [label, value] of Object.entries(values)) {
      await userEvent.type(screen.getByLabelText(label), value);
    }
    await userEvent.selectOptions(screen.getByLabelText('Danh mục'), 'Điện thoại');
    await userEvent.selectOptions(screen.getByLabelText('Thương hiệu'), 'Apple');
  };

  describe('thêm mới', () => {
    it('báo lỗi từng ô khi để trống và không gọi API', async () => {
      const calls = await openCreate();

      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));

      expect(screen.getByText('Vui lòng nhập SKU')).toBeInTheDocument();
      expect(screen.getByText('Vui lòng nhập tên sản phẩm')).toBeInTheDocument();
      expect(screen.getByText('Vui lòng chọn danh mục')).toBeInTheDocument();
      expect(screen.getByText('Vui lòng chọn thương hiệu')).toBeInTheDocument();
      expect(screen.getByText('Giá gốc phải là số nguyên lớn hơn 0')).toBeInTheDocument();
      expect(calls.some((c) => c.key === 'POST /admin/products')).toBe(false);
    });

    it('từ chối SKU có ký tự lạ và tồn kho âm', async () => {
      await openCreate();

      await fillRequired({ 'SKU (mã sản phẩm)': 'AB CD!' });
      await userEvent.clear(screen.getByLabelText('Tồn kho'));
      await userEvent.type(screen.getByLabelText('Tồn kho'), '-3');
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));

      expect(screen.getByText('SKU chỉ gồm chữ, số và các ký tự . _ -')).toBeInTheDocument();
      expect(screen.getByText('Tồn kho phải là số nguyên không âm')).toBeInTheDocument();
    });

    it('giá khuyến mãi phải thấp hơn giá gốc (US-08 AC3)', async () => {
      await openCreate();

      await fillRequired();
      await userEvent.type(
        screen.getByLabelText('Giá khuyến mãi (đồng, để trống nếu không giảm)'),
        '30000000',
      );
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));

      expect(screen.getByText('Giá khuyến mãi phải thấp hơn giá gốc')).toBeInTheDocument();
    });

    it('từ chối giá có phần thập phân', async () => {
      await openCreate();

      await fillRequired({ 'Giá gốc (đồng)': '1999.5' });
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));

      expect(screen.getByText('Giá gốc phải là số nguyên lớn hơn 0')).toBeInTheDocument();
    });

    it('thông số: dòng có giá trị mà thiếu tên, hoặc tên trùng đều bị báo lỗi (US-08 AC5)', async () => {
      await openCreate();
      await fillRequired();

      await userEvent.click(screen.getByRole('button', { name: 'Thêm thông số' }));
      await userEvent.type(screen.getByLabelText('Giá trị thông số 1'), '8GB');
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));
      expect(screen.getByText('Mỗi thông số phải có tên')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('Tên thông số 1'), 'RAM');
      await userEvent.click(screen.getByRole('button', { name: 'Thêm thông số' }));
      await userEvent.type(screen.getByLabelText('Tên thông số 2'), 'RAM');
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));
      expect(screen.getByText('Tên thông số bị trùng nhau')).toBeInTheDocument();
    });

    it('thêm và xóa dòng thông số', async () => {
      await openCreate();

      await userEvent.click(screen.getByRole('button', { name: 'Thêm thông số' }));
      await userEvent.click(screen.getByRole('button', { name: 'Thêm thông số' }));
      expect(screen.getByLabelText('Tên thông số 2')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Xóa thông số 1' }));
      expect(screen.queryByLabelText('Tên thông số 2')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Tên thông số 1')).toBeInTheDocument();
    });

    it('gửi đúng dữ liệu (số là số, thông số thành object, bỏ dòng trống) rồi chuyển sang trang sửa để thêm ảnh', async () => {
      const created = detail({ id: 7, images: [], sku: 'SS-S24', name: 'Samsung S24', specs: {} });
      const calls = await openCreate({
        'POST /admin/products': [201, created],
        'GET /admin/products/7': [200, created],
      });

      await fillRequired();
      await userEvent.type(screen.getByLabelText('Mô tả'), '  Mô tả mới  ');
      await userEvent.click(screen.getByRole('button', { name: 'Thêm thông số' }));
      await userEvent.type(screen.getByLabelText('Tên thông số 1'), ' RAM ');
      await userEvent.type(screen.getByLabelText('Giá trị thông số 1'), '8GB');
      await userEvent.click(screen.getByRole('button', { name: 'Thêm thông số' })); // dòng trống bị bỏ qua
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));

      expect(await screen.findByRole('form', { name: 'Sửa sản phẩm' })).toBeInTheDocument();
      expect(
        screen.getByText('Đã tạo sản phẩm. Hãy thêm ảnh ở phần bên dưới.'),
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Ảnh sản phẩm/ })).toBeInTheDocument();
      expect(calls.find((c) => c.key === 'POST /admin/products').body).toEqual({
        sku: 'ss-s24',
        name: 'Samsung S24',
        categoryId: 1,
        brandId: 1,
        price: 29990000,
        salePrice: null,
        stock: 0,
        description: 'Mô tả mới',
        specs: { RAM: '8GB' },
        isActive: true,
      });
    });

    it('SKU trùng: hiện thông báo của máy chủ và giữ nguyên form', async () => {
      await openCreate({
        'POST /admin/products': [
          409,
          apiError('SKU_TAKEN', 'SKU này đã được dùng cho sản phẩm khác'),
        ],
      });

      await fillRequired();
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('SKU này đã được dùng');
      expect(screen.getByRole('form', { name: 'Thêm sản phẩm' })).toBeInTheDocument();
    });

    it('máy chủ báo lỗi theo ô thì hiện ngay dưới ô đó', async () => {
      await openCreate({
        'POST /admin/products': [
          400,
          apiError('VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { name: ['Tên tối đa 200 ký tự'] }),
        ],
      });

      await fillRequired();
      await userEvent.click(screen.getByRole('button', { name: 'Tạo sản phẩm' }));

      expect(await screen.findByLabelText('Tên sản phẩm')).toHaveAccessibleDescription(
        'Tên tối đa 200 ký tự',
      );
    });

    it('trang thêm mới không có phần ảnh (cần tạo sản phẩm trước)', async () => {
      await openCreate();

      expect(screen.queryByRole('heading', { name: /Ảnh sản phẩm/ })).not.toBeInTheDocument();
    });
  });

  describe('sửa', () => {
    it('điền sẵn dữ liệu hiện có', async () => {
      await openEdit();

      expect(screen.getByLabelText('Tên sản phẩm')).toHaveValue('iPhone 15');
      expect(screen.getByLabelText('SKU (mã sản phẩm)')).toHaveValue('IP15-128');
      expect(screen.getByLabelText('Danh mục')).toHaveValue('1');
      expect(screen.getByLabelText('Thương hiệu')).toHaveValue('1');
      expect(screen.getByLabelText('Giá gốc (đồng)')).toHaveValue(19990000);
      expect(screen.getByLabelText('Giá khuyến mãi (đồng, để trống nếu không giảm)')).toHaveValue(
        18490000,
      );
      expect(screen.getByLabelText('Tồn kho')).toHaveValue(25);
      expect(screen.getByLabelText('Mô tả')).toHaveValue('Mô tả cũ');
      expect(screen.getByLabelText('Tên thông số 1')).toHaveValue('Màn hình');
      expect(screen.getByLabelText('Giá trị thông số 2')).toHaveValue('6GB');
    });

    it('lưu thay đổi, xóa giá khuyến mãi thì gửi null', async () => {
      const calls = await openEdit(detail(), {
        'PATCH /admin/products/1': [200, detail({ salePrice: null })],
      });

      await userEvent.clear(
        screen.getByLabelText('Giá khuyến mãi (đồng, để trống nếu không giảm)'),
      );
      await userEvent.clear(screen.getByLabelText('Tồn kho'));
      await userEvent.type(screen.getByLabelText('Tồn kho'), '30');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

      expect(await screen.findByText('Đã lưu thay đổi')).toBeInTheDocument();
      expect(calls.find((c) => c.key === 'PATCH /admin/products/1').body).toMatchObject({
        salePrice: null,
        stock: 30,
        price: 19990000,
        specs: { 'Màn hình': '6.1 inch', RAM: '6GB' },
      });
    });

    it('sản phẩm không tồn tại thì báo lỗi', async () => {
      tokenStorage.setTokens(adminSession);
      mockServer({
        ...baseHandlers,
        'GET /admin/products/99': [404, apiError('NOT_FOUND', 'Không tìm thấy sản phẩm')],
      });
      renderApp('/san-pham/99');

      expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy sản phẩm');
    });
  });
});

// ---------------------------------------------------------------------------
// Ảnh sản phẩm
// ---------------------------------------------------------------------------
describe('Ảnh sản phẩm (US-08 AC6)', () => {
  const openImages = async (product = detail(), handlers = {}) => {
    tokenStorage.setTokens(adminSession);
    const calls = mockServer({
      ...baseHandlers,
      [`GET /admin/products/${product.id}`]: [200, product],
      ...handlers,
    });
    renderApp(`/san-pham/${product.id}`);
    await screen.findByRole('heading', { name: /Ảnh sản phẩm/ });
    return calls;
  };

  const image = (name, type, size = 1024) => new File([new Uint8Array(size)], name, { type });

  // applyAccept=false để thử cả file sai loại (mặc định user-event tự bỏ qua file không khớp thuộc tính accept)
  const user = () => userEvent.setup({ applyAccept: false });

  it('hiện số ảnh, đánh dấu ảnh đại diện duy nhất và dùng đúng đường dẫn', async () => {
    await openImages();

    expect(screen.getByRole('heading', { name: 'Ảnh sản phẩm (2/6)' })).toBeInTheDocument();
    expect(screen.getAllByText('Ảnh đại diện')).toHaveLength(1);
    expect(screen.getByAltText('Ảnh sản phẩm 1')).toHaveAttribute('src', '/uploads/products/a.png');
    expect(screen.getByAltText('Ảnh sản phẩm 2')).toHaveAttribute(
      'src',
      'https://example.com/b.png',
    );
  });

  it('chưa có ảnh thì hiện gợi ý', async () => {
    await openImages(detail({ images: [] }));

    expect(screen.getByText('Chưa có ảnh nào.')).toBeInTheDocument();
  });

  it('nút chuyển trái của ảnh đầu và chuyển phải của ảnh cuối bị khóa', async () => {
    await openImages();

    expect(screen.getByRole('button', { name: 'Chuyển ảnh 1 sang trái' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Chuyển ảnh 2 sang phải' })).toBeDisabled();
  });

  it('đổi thứ tự gửi danh sách id mới (ảnh đầu là ảnh đại diện)', async () => {
    const calls = await openImages(detail(), {
      'PUT /admin/products/1/images/order': [200, []],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Chuyển ảnh 1 sang phải' }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        key: 'PUT /admin/products/1/images/order',
        body: { imageIds: [12, 11] },
      }),
    );
  });

  it('xóa ảnh chỉ khi người dùng xác nhận', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const calls = await openImages(detail(), {
      'DELETE /admin/products/1/images/11': [204, null],
    });

    confirm.mockReturnValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa ảnh 1' }));
    expect(calls.some((c) => c.key === 'DELETE /admin/products/1/images/11')).toBe(false);

    confirm.mockReturnValueOnce(true);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa ảnh 1' }));
    await waitFor(() =>
      expect(calls.some((c) => c.key === 'DELETE /admin/products/1/images/11')).toBe(true),
    );
  });

  it('tải ảnh lên gửi các file bằng multipart', async () => {
    const calls = await openImages(detail(), {
      'POST /admin/products/1/images': [201, []],
    });

    await user().upload(screen.getByLabelText('Chọn ảnh'), [
      image('a.png', 'image/png'),
      image('b.jpg', 'image/jpeg'),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh lên' }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        key: 'POST /admin/products/1/images',
        body: { images: ['a.png', 'b.jpg'] },
      }),
    );
  });

  it('báo lỗi khi chưa chọn file', async () => {
    const calls = await openImages();

    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh lên' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng chọn ít nhất một ảnh.');
    expect(calls.some((c) => c.key === 'POST /admin/products/1/images')).toBe(false);
  });

  it('từ chối file lớn hơn 2MB và file sai loại, không gửi lên máy chủ', async () => {
    const calls = await openImages();

    await user().upload(screen.getByLabelText('Chọn ảnh'), [
      image('lon.png', 'image/png', 2 * 1024 * 1024 + 1),
      image('ghi-chu.pdf', 'application/pdf'),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh lên' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('"lon.png" lớn hơn 2MB.');
    expect(alert).toHaveTextContent('"ghi-chu.pdf" không phải ảnh jpg, png hoặc webp.');
    expect(calls.some((c) => c.key === 'POST /admin/products/1/images')).toBe(false);
  });

  it('từ chối khi tổng số ảnh vượt quá 6', async () => {
    await openImages(); // đang có 2 ảnh

    await user().upload(
      screen.getByLabelText('Chọn ảnh'),
      Array.from({ length: 5 }, (_, i) => image(`${i}.png`, 'image/png')),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh lên' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Mỗi sản phẩm tối đa 6 ảnh (hiện có 2).');
  });

  it('hiện thông báo của máy chủ khi tải ảnh thất bại', async () => {
    await openImages(detail(), {
      'POST /admin/products/1/images': [
        400,
        apiError('INVALID_IMAGE_TYPE', 'File "x.png" không phải ảnh jpg, png hoặc webp'),
      ],
    });

    await user().upload(screen.getByLabelText('Chọn ảnh'), [image('x.png', 'image/png')]);
    await userEvent.click(screen.getByRole('button', { name: 'Tải ảnh lên' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('không phải ảnh jpg, png hoặc webp');
  });
});
