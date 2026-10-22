/**
 * @feature [F02] Kiểm thử giao diện quản lý danh mục và thương hiệu của Admin (US-06, US-07).
 * Danh mục và thương hiệu dùng chung một component nên chạy cùng bộ test cho cả hai (describe.each).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

const resources = [
  {
    noun: 'danh mục',
    title: 'Danh mục sản phẩm',
    route: '/danh-muc',
    api: '/admin/categories',
    imageField: 'imageUrl',
    imageLabel: 'Ảnh đại diện (đường dẫn)',
    hasDescription: true,
  },
  {
    noun: 'thương hiệu',
    title: 'Thương hiệu',
    route: '/thuong-hieu',
    api: '/admin/brands',
    imageField: 'logoUrl',
    imageLabel: 'Logo (đường dẫn)',
    hasDescription: false,
  },
];

const item = (overrides = {}) => ({
  id: 1,
  name: 'Apple',
  slug: 'apple',
  isActive: true,
  productCount: 3,
  ...overrides,
});

// Đăng nhập sẵn bằng admin, giả lập danh sách ban đầu và mở trang
const openPage = async ({ route, api }, { items = [item()], handlers = {} } = {}) => {
  tokenStorage.setTokens(adminSession);
  const state = { items: [...items] };
  const calls = mockServer({
    'GET /users/me': [200, admin],
    [`GET ${api}`]: (config) => {
      const search = config.params?.search?.toLowerCase();
      return [
        200,
        search ? state.items.filter((i) => i.name.toLowerCase().includes(search)) : state.items,
      ];
    },
    ...handlers,
  });
  renderApp(route);
  await screen.findByRole('heading', { level: 1 });
  // Chờ tải xong danh sách rồi mới thao tác, nếu không các nút trong bảng chưa xuất hiện
  await waitFor(() => expect(screen.queryByText('Đang tải...')).not.toBeInTheDocument());
  return { calls, state };
};

beforeEach(() => vi.restoreAllMocks());

describe('Menu quản trị', () => {
  it('có mục Danh mục và Thương hiệu, bấm vào chuyển trang', async () => {
    tokenStorage.setTokens(adminSession);
    mockServer({
      'GET /users/me': [200, admin],
      'GET /health': [200, { status: 'ok' }],
      'GET /admin/categories': [200, []],
      'GET /admin/brands': [200, []],
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('link', { name: 'Danh mục' }));
    expect(await screen.findByRole('heading', { name: 'Danh mục sản phẩm' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Thương hiệu' }));
    expect(await screen.findByRole('heading', { name: 'Thương hiệu' })).toBeInTheDocument();
  });
});

describe.each(resources)('Quản lý $noun', (resource) => {
  const { noun, title, api, imageField, imageLabel, hasDescription } = resource;

  it('hiện bảng với tên, slug, số sản phẩm và trạng thái', async () => {
    await openPage(resource, {
      items: [
        item(),
        item({ id: 2, name: 'Samsung', slug: 'samsung', isActive: false, productCount: 0 }),
      ],
    });

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Apple')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Đang hiện')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Samsung')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Đang ẩn')).toBeInTheDocument();
  });

  it('chưa có dữ liệu thì hiện gợi ý thêm mới', async () => {
    await openPage(resource, { items: [] });

    expect(await screen.findByText(new RegExp(`Chưa có ${noun} nào`))).toBeInTheDocument();
  });

  it('báo lỗi khi tải danh sách thất bại', async () => {
    tokenStorage.setTokens(adminSession);
    mockServer({
      'GET /users/me': [200, admin],
      [`GET ${api}`]: [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')],
    });
    renderApp(resource.route);

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
  });

  describe('tìm kiếm', () => {
    it('gửi từ khóa lên máy chủ và hiện kết quả', async () => {
      const { calls } = await openPage(resource, {
        items: [item(), item({ id: 2, name: 'Samsung', slug: 'samsung' })],
      });

      await userEvent.type(screen.getByLabelText(`Tìm ${noun}`), 'sam');

      await waitFor(() => expect(screen.queryByText('Apple')).not.toBeInTheDocument());
      expect(screen.getByText('Samsung')).toBeInTheDocument();
      expect(calls.filter((c) => c.key === `GET ${api}`).length).toBeGreaterThan(1);
    });

    it('không có kết quả thì báo rõ từ khóa', async () => {
      await openPage(resource);

      await userEvent.type(screen.getByLabelText(`Tìm ${noun}`), 'zzz');

      expect(
        await screen.findByText(new RegExp(`Không có ${noun} nào khớp "zzz"`)),
      ).toBeInTheDocument();
    });
  });

  describe('thêm mới', () => {
    const openForm = async () => {
      await userEvent.click(screen.getByRole('button', { name: `Thêm ${noun}` }));
      return screen.getByRole('form', { name: `Thêm ${noun}` });
    };

    it('báo lỗi khi tên trống và không gọi API', async () => {
      const { calls } = await openPage(resource);
      await openForm();

      await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

      expect(screen.getByText('Vui lòng nhập tên')).toBeInTheDocument();
      expect(calls.some((c) => c.key === `POST ${api}`)).toBe(false);
    });

    it('báo lỗi khi đường dẫn ảnh không phải http(s)', async () => {
      const { calls } = await openPage(resource);
      await openForm();

      await userEvent.type(screen.getByLabelText('Tên'), 'Mới');
      await userEvent.type(screen.getByLabelText(imageLabel), 'javascript:alert(1)');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

      expect(
        screen.getByText('Đường dẫn phải bắt đầu bằng http:// hoặc https://'),
      ).toBeInTheDocument();
      expect(calls.some((c) => c.key === `POST ${api}`)).toBe(false);
    });

    it('gửi đúng dữ liệu, đóng form và danh sách có mục mới', async () => {
      const { calls, state } = await openPage(resource, {
        items: [],
        handlers: {
          [`POST ${api}`]: (_config, body) => {
            state.items.push(item({ id: 5, name: body.name, slug: 'moi', productCount: 0 }));
            return [201, state.items[0]];
          },
        },
      });
      await openForm();

      await userEvent.type(screen.getByLabelText('Tên'), '  Mới  ');
      await userEvent.type(screen.getByLabelText(imageLabel), 'https://example.com/a.png');
      if (hasDescription) await userEvent.type(screen.getByLabelText('Mô tả'), 'Mô tả ngắn');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

      expect(await screen.findByRole('cell', { name: 'Mới' })).toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(calls.find((c) => c.key === `POST ${api}`).body).toEqual({
        name: 'Mới',
        [imageField]: 'https://example.com/a.png',
        isActive: true,
        ...(hasDescription && { description: 'Mô tả ngắn' }),
      });
    });

    it('trùng tên: hiện thông báo của máy chủ và giữ form để sửa lại', async () => {
      await openPage(resource, {
        handlers: { [`POST ${api}`]: [409, apiError('NAME_TAKEN', `${noun} này đã tồn tại`)] },
      });
      await openForm();

      await userEvent.type(screen.getByLabelText('Tên'), 'Apple');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('đã tồn tại');
      expect(screen.getByRole('form', { name: `Thêm ${noun}` })).toBeInTheDocument();
    });

    it('nút Hủy đóng form', async () => {
      await openPage(resource);
      await openForm();

      await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));

      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });
  });

  describe('sửa, ẩn/hiện, xóa', () => {
    it('sửa: form có sẵn dữ liệu cũ và gửi PATCH', async () => {
      const { calls } = await openPage(resource, {
        handlers: { [`PATCH ${api}/1`]: (_config, body) => [200, item({ ...body })] },
      });

      await userEvent.click(screen.getByRole('button', { name: 'Sửa' }));
      expect(screen.getByLabelText('Tên')).toHaveValue('Apple');
      await userEvent.clear(screen.getByLabelText('Tên'));
      await userEvent.type(screen.getByLabelText('Tên'), 'Apple Inc');
      await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

      await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
      expect(calls.find((c) => c.key === `PATCH ${api}/1`).body.name).toBe('Apple Inc');
    });

    it('bấm Ẩn gửi isActive=false, bấm Hiện gửi isActive=true', async () => {
      const { calls, state } = await openPage(resource, {
        handlers: {
          [`PATCH ${api}/1`]: (_config, body) => {
            state.items[0] = { ...state.items[0], ...body };
            return [200, state.items[0]];
          },
        },
      });

      await userEvent.click(screen.getByRole('button', { name: 'Ẩn' }));
      expect(await screen.findByText('Đang ẩn')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Hiện' }));
      expect(await screen.findByText('Đang hiện')).toBeInTheDocument();

      const bodies = calls.filter((c) => c.key === `PATCH ${api}/1`).map((c) => c.body);
      expect(bodies).toEqual([{ isActive: false }, { isActive: true }]);
    });

    it('xóa chỉ khi người dùng xác nhận', async () => {
      const confirm = vi.spyOn(window, 'confirm');
      const { calls, state } = await openPage(resource, {
        handlers: {
          [`DELETE ${api}/1`]: () => {
            state.items.length = 0;
            return [204, null];
          },
        },
      });

      confirm.mockReturnValueOnce(false);
      await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
      expect(calls.some((c) => c.key === `DELETE ${api}/1`)).toBe(false);

      confirm.mockReturnValueOnce(true);
      await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));
      expect(await screen.findByText(new RegExp(`Chưa có ${noun} nào`))).toBeInTheDocument();
    });

    it('đã có sản phẩm thì máy chủ từ chối xóa và thông báo hiện ra (US-06 AC2)', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      await openPage(resource, {
        handlers: {
          [`DELETE ${api}/1`]: [
            409,
            apiError(
              'HAS_PRODUCTS',
              `${noun} đang có 3 sản phẩm nên không thể xóa, hãy ẩn nó thay vì xóa`,
            ),
          ],
        },
      });

      await userEvent.click(screen.getByRole('button', { name: 'Xóa' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('hãy ẩn nó thay vì xóa');
      expect(screen.getByText('Apple')).toBeInTheDocument();
    });
  });
});
