/**
 * @feature [F08] Quản lý đánh giá - Kiểm thử giao diện Admin: danh sách đánh giá (tìm, lọc, phân trang), ẩn và bỏ ẩn đánh giá (US-23).
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { tokenStorage } from '../lib/api.js';
import { admin, adminSession, apiError, mockServer, renderApp } from '../test/utils.jsx';

const row = (id, overrides = {}) => ({
  id,
  rating: 5,
  comment: `Bình luận số ${id}`,
  isHidden: false,
  createdAt: '2026-10-20T03:00:00.000Z',
  updatedAt: '2026-10-20T03:00:00.000Z',
  product: { id: 10 + id, name: `Sản phẩm ${id}`, slug: `san-pham-${id}` },
  user: { id: 100 + id, email: `khach${id}@example.com`, fullName: `Khách ${id}` },
  ...overrides,
});

const listPage = (items, extra = {}) => ({
  items,
  page: 1,
  pageSize: 10,
  total: items.length,
  ...extra,
});

const open = (handlers = {}, route = '/danh-gia') => {
  tokenStorage.setTokens(adminSession);
  const paramsLog = [];
  const calls = mockServer({
    'GET /users/me': [200, admin],
    'GET /admin/reviews': (config) => {
      paramsLog.push(config.params);
      return [200, listPage([row(1), row(2, { isHidden: true, rating: 1 })])];
    },
    ...handlers,
  });
  renderApp(route);
  return { calls, paramsLog };
};

const rowOf = async (email) =>
  (await within(await screen.findByRole('table')).findByText(email)).closest('tr');

describe('Trang đánh giá (US-23)', () => {
  it('mục "Đánh giá" trong menu dẫn tới trang này', async () => {
    open({}, '/');
    const nav = await screen.findByRole('navigation', { name: 'Menu quản trị' });

    await userEvent.click(within(nav).getByRole('link', { name: 'Đánh giá' }));

    expect(await screen.findByRole('heading', { name: 'Đánh giá', level: 1 })).toBeInTheDocument();
  });

  it('hiện sản phẩm, người viết, số sao, bình luận và trạng thái của từng đánh giá', async () => {
    open();

    const visible = await rowOf('khach1@example.com');
    expect(visible).toHaveTextContent('Sản phẩm 1');
    expect(visible).toHaveTextContent('Khách 1');
    expect(visible).toHaveTextContent('Bình luận số 1');
    expect(within(visible).getByLabelText('5 trên 5 sao')).toBeInTheDocument();
    expect(within(visible).getByText('Đang hiện')).toBeInTheDocument();
    const hidden = await rowOf('khach2@example.com');
    expect(within(hidden).getByText('Đã ẩn')).toBeInTheDocument();
    expect(within(hidden).getByLabelText('1 trên 5 sao')).toBeInTheDocument();
  });

  it('đánh giá không có bình luận hiện chú thích', async () => {
    open({ 'GET /admin/reviews': [200, listPage([row(1, { comment: '' })])] });

    expect(await rowOf('khach1@example.com')).toHaveTextContent('Không có bình luận');
  });

  it('tải trang đầu với page=1, pageSize=10 và không có bộ lọc', async () => {
    const { paramsLog } = open();
    await rowOf('khach1@example.com');

    expect(paramsLog[0]).toEqual({ page: 1, pageSize: 10 });
  });

  it('gõ từ khóa thì tìm sau khi ngừng gõ (đã cắt khoảng trắng), không gửi mỗi ký tự', async () => {
    const { paramsLog } = open();
    await rowOf('khach1@example.com');

    await userEvent.type(screen.getByLabelText('Tìm đánh giá'), '  tai nghe  ');

    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ page: 1, pageSize: 10, search: 'tai nghe' }),
    );
    expect(paramsLog.filter((params) => params.search).length).toBe(1);
  });

  it('lọc theo trạng thái và số sao gửi đúng tham số', async () => {
    const { paramsLog } = open();
    await rowOf('khach1@example.com');

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo trạng thái đánh giá'), 'hidden');
    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ page: 1, pageSize: 10, status: 'hidden' }),
    );

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo số sao'), '1');
    await waitFor(() =>
      expect(paramsLog.at(-1)).toEqual({ page: 1, pageSize: 10, status: 'hidden', rating: '1' }),
    );
  });

  it('phân trang: Trang sau gửi page=2, nút bị khóa ở hai đầu', async () => {
    const { paramsLog } = open({
      'GET /admin/reviews': (config) => {
        paramsLog.push(config.params);
        return [200, listPage([row(config.params.page)], { page: config.params.page, total: 12 })];
      },
    });
    await rowOf('khach1@example.com');
    expect(screen.getByText(/Tổng 12 đánh giá · Trang 1\/2/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));

    expect(await rowOf('khach2@example.com')).toBeInTheDocument();
    expect(paramsLog.at(-1)).toMatchObject({ page: 2 });
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  });

  it('chưa có đánh giá nào, và lọc không ra kết quả: hai thông báo khác nhau', async () => {
    open({ 'GET /admin/reviews': [200, listPage([])] });
    expect(await screen.findByText('Chưa có đánh giá nào.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Lọc theo số sao'), '3');
    expect(await screen.findByText('Không có đánh giá nào khớp bộ lọc.')).toBeInTheDocument();
  });

  it('lỗi tải: báo lỗi và Thử lại tải được', async () => {
    let fail = true;
    open({
      'GET /admin/reviews': () =>
        fail ? [500, apiError('INTERNAL_ERROR', 'Lỗi máy chủ')] : [200, listPage([row(1)])],
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Lỗi máy chủ');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await rowOf('khach1@example.com')).toBeInTheDocument();
  });
});

describe('Ẩn và bỏ ẩn đánh giá (US-23 AC1)', () => {
  // Máy chủ giả có trạng thái ẩn: PATCH đổi thật rồi lần tải lại trả trạng thái mới
  const withState = (initial) => {
    let items = initial;
    return {
      'GET /admin/reviews': () => [200, listPage(items)],
      ...Object.fromEntries(
        initial.map((item) => [
          `PATCH /admin/reviews/${item.id}/visibility`,
          (_config, body) => {
            items = items.map((i) => (i.id === item.id ? { ...i, isHidden: body.isHidden } : i));
            return [200, items.find((i) => i.id === item.id)];
          },
        ]),
      ),
    };
  };

  it('Ẩn gửi isHidden=true rồi hàng chuyển sang "Đã ẩn" với nút "Bỏ ẩn"', async () => {
    const { calls } = open(withState([row(1)]));
    const target = await rowOf('khach1@example.com');

    await userEvent.click(within(target).getByRole('button', { name: /^Ẩn đánh giá của/ }));

    await waitFor(async () =>
      expect(within(await rowOf('khach1@example.com')).getByText('Đã ẩn')).toBeInTheDocument(),
    );
    expect(calls.find((call) => call.key.startsWith('PATCH')).body).toEqual({ isHidden: true });
    expect(
      within(await rowOf('khach1@example.com')).getByRole('button', {
        name: /^Bỏ ẩn đánh giá của/,
      }),
    ).toBeInTheDocument();
  });

  it('Bỏ ẩn gửi isHidden=false rồi hàng hiện lại', async () => {
    const { calls } = open(withState([row(1, { isHidden: true })]));
    const target = await rowOf('khach1@example.com');

    await userEvent.click(within(target).getByRole('button', { name: /^Bỏ ẩn đánh giá của/ }));

    await waitFor(async () =>
      expect(within(await rowOf('khach1@example.com')).getByText('Đang hiện')).toBeInTheDocument(),
    );
    expect(calls.find((call) => call.key.startsWith('PATCH')).body).toEqual({ isHidden: false });
  });

  it('máy chủ từ chối thì báo lỗi và đánh giá giữ nguyên trạng thái', async () => {
    open({
      'GET /admin/reviews': [200, listPage([row(1)])],
      'PATCH /admin/reviews/1/visibility': [
        404,
        apiError('REVIEW_NOT_FOUND', 'Không tìm thấy đánh giá'),
      ],
    });
    const target = await rowOf('khach1@example.com');

    await userEvent.click(within(target).getByRole('button', { name: /^Ẩn đánh giá của/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy đánh giá');
    expect(within(await rowOf('khach1@example.com')).getByText('Đang hiện')).toBeInTheDocument();
  });
});
